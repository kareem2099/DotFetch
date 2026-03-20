import * as vscode from 'vscode';
import axios, { AxiosResponse, AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { EnvironmentManager, Environment } from './environmentManager';
import { EnvironmentVariablesProvider, EnvironmentTreeItem } from './environmentTree';
import { logger } from './logger';

class DotFetchProvider implements vscode.WebviewViewProvider {
	private static readonly DEFAULT_TIMEOUT = 10000;
	private static readonly MAX_TIMEOUT = 300000;
	private static readonly MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
	private static readonly DISPLAY_THRESHOLD = 1024 * 1024; // 1MB

	private currentWebview?: vscode.WebviewView;
	private abortController?: AbortController;
	private isWebviewReady = false;

	constructor(
		private context: vscode.ExtensionContext,
		private environmentManager: EnvironmentManager
	) {
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.currentWebview = webviewView;
		this.isWebviewReady = false;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
		};

		// Generate nonce for CSP
		const nonce = this.getNonce();

		const styleUri = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css')
		);
		const scriptUri = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'script.js')
		);

		// Read the HTML file
		const htmlPath = path.join(this.context.extensionPath, 'media', 'index.html');
		let htmlContent = fs.readFileSync(htmlPath, 'utf8');

		// Add Content Security Policy (FIXED: Added unsafe-inline for framework)
		const csp = `
			<meta http-equiv="Content-Security-Policy" 
				  content="default-src 'none'; 
						   style-src 'unsafe-inline' ${webviewView.webview.cspSource}; 
						   script-src 'nonce-${nonce}'; 
						   img-src ${webviewView.webview.cspSource} https: data:; 
						   connect-src https:; 
						   font-src ${webviewView.webview.cspSource};">
		`;

		htmlContent = htmlContent.replace('<head>', '<head>' + csp);

		// Replace the stylesheet and script paths
		htmlContent = htmlContent.replace('./styles.css', styleUri.toString());
		const loggerUri = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'logger.js')
		);
		htmlContent = htmlContent.replace('./logger.js', loggerUri.toString());
		htmlContent = htmlContent.replace('./script.js', scriptUri.toString());

		// Add nonce to script tag
		htmlContent = htmlContent.replace(
			/<script src="([^"]+)">/g,
			`<script nonce="${nonce}" src="$1">`
		);

		webviewView.webview.html = htmlContent;

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.type) {
					case 'webviewReady':
						// FIXED: Wait for webview to be ready before sending state
						this.handleWebviewReady(webviewView);
						break;
					case 'sendRequest':
						await this.handleRequest(webviewView, message);
						break;
					case 'getEnvironments':
						this.sendEnvironments(webviewView);
						break;
					case 'saveState':
						await this.context.globalState.update('dotfetch', message.state);
						break;
					case 'previewVariables':
						this.handlePreview(webviewView, message);
						break;
					case 'validateVariables':
						this.handleValidation(webviewView, message);
						break;
					case 'toggleEnvironmentTree':
						await this.toggleEnvironmentTree();
						break;
					case 'cancelRequest':
						this.cancelRequest();
						break;
					case 'notify':
						if (message.level === 'error') {
							vscode.window.showErrorMessage(message.text);
						} else if (message.level === 'warning') {
							vscode.window.showWarningMessage(message.text);
						} else {
							vscode.window.showInformationMessage(message.text);
						}
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);

		// Handle webview disposal
		webviewView.onDidDispose(() => {
			this.currentWebview = undefined;
			this.isWebviewReady = false;
			this.cancelRequest();
			logger.log('Webview disposed');
		});
	}

	private handleWebviewReady(webviewView: vscode.WebviewView): void {
		this.isWebviewReady = true;
		logger.log('Webview ready, loading state');

		// Load persisted state
		const state = this.context.globalState.get('dotfetch', {
			history: [],
			collections: {},
			settings: { timeout: DotFetchProvider.DEFAULT_TIMEOUT }
		});

		webviewView.webview.postMessage({
			type: 'loadState',
			state: state
		});

		// Send environments after state is loaded
		this.sendEnvironments(webviewView);
	}

	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	private sendEnvironments(webviewView: vscode.WebviewView): void {
		const environments = this.environmentManager.getEnvironments();
		webviewView.webview.postMessage({
			type: 'environments',
			environments: environments
		});
	}

	public notifyEnvironmentsChanged(): void {
		if (this.currentWebview && this.isWebviewReady) {
			this.sendEnvironments(this.currentWebview);
		}
	}

	private cancelRequest(): void {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = undefined;
			logger.log('Request cancelled');
		}
	}

	private async handleRequest(webviewView: vscode.WebviewView, message: any) {
    const startTime = Date.now();
    const maxRetries = Math.min(Math.max(parseInt(message.retryCount) || 0, 0), 5);
    const retryableCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED'];

    this.cancelRequest();

    try {
        const selectedEnvironment = message.environment || 'none';

        // Validate URL exists
		if (!message.url || message.url.trim() === '') {
            webviewView.webview.postMessage({
				type: 'error',
				error: 'URL is required',
				duration: 0
			});
            return;
        }

        // Substitute variables in URL
		let substitutedUrl = this.environmentManager.substituteVariables(
			message.url.trim(),
			selectedEnvironment
		);

        try {
            const urlObj = new URL(substitutedUrl);
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                throw new Error('Protocol must be http or https');
            }
        } catch {
            webviewView.webview.postMessage({ type: 'error', error: 'Invalid URL format.', duration: 0 });
            return;
        }

        let substitutedHeaders: { [key: string]: string } = {};
        if (message.headers) {
            for (const line of message.headers.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) { continue; }
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmed.substring(0, colonIndex).trim();
                    if (!/^[a-zA-Z0-9\-_]+$/.test(key)) { continue; }
                    const value = trimmed.substring(colonIndex + 1).trim();
                    substitutedHeaders[key] = this.environmentManager.substituteVariables(value, selectedEnvironment) || value;
                }
            }
        }

        let substitutedBody = message.body || '';
        if (substitutedBody) {
            substitutedBody = this.environmentManager.substituteVariables(substitutedBody, selectedEnvironment);
        }

        let data: any = undefined;
        if (substitutedBody) {
            try { data = JSON.parse(substitutedBody); } catch { data = substitutedBody; }
        }

        const timeout = (message.timeout && message.timeout > 0 && message.timeout <= DotFetchProvider.MAX_TIMEOUT)
            ? message.timeout : DotFetchProvider.DEFAULT_TIMEOUT;

        // ── RETRY LOOP ──
        let lastError: any = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (attempt > 0) {
                logger.log(`Retry attempt ${attempt}/${maxRetries}`);
                webviewView.webview.postMessage({
                    type: 'retryAttempt',
                    attempt,
                    total: maxRetries
                });
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }

            this.abortController = new AbortController();

            try {
                const response: AxiosResponse = await axios({
                    method: message.method,
                    url: substitutedUrl,
                    headers: substitutedHeaders,
                    data,
                    timeout,
                    validateStatus: () => true,
                    maxContentLength: DotFetchProvider.MAX_RESPONSE_SIZE,
                    maxBodyLength: DotFetchProvider.MAX_RESPONSE_SIZE,
                    signal: this.abortController.signal
                });

                const duration = Date.now() - startTime;
                const responseSize = JSON.stringify(response.data).length;
                const isLarge = responseSize > DotFetchProvider.DISPLAY_THRESHOLD;

                logger.log('Response received:', { status: response.status, duration: `${duration}ms`, attempts: attempt + 1 });

                webviewView.webview.postMessage({
                    type: 'response',
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: isLarge
                        ? `[Response too large: ${(responseSize / 1024).toFixed(2)} KB]\n\nFirst 1000 characters:\n${JSON.stringify(response.data).substring(0, 1000)}...`
                        : response.data,
                    duration,
                    isLarge,
                    size: responseSize,
                    attempts: attempt + 1
                });
                return;

            } catch (error: unknown) {
                lastError = error;

                if (error instanceof Error && error.name === 'CanceledError') {
                    webviewView.webview.postMessage({ type: 'error', error: 'Request cancelled', duration: Date.now() - startTime, cancelled: true });
                    return;
                }

                const isRetryable = axios.isAxiosError(error) &&
                    error.request &&
                    !error.response &&
                    retryableCodes.includes((error as any).code || '');

                if (!isRetryable || attempt >= maxRetries) { break; }

                logger.log(`Attempt ${attempt + 1} failed with ${(error as any).code}, retrying...`);
            }
        }

        // All attempts failed
        const duration = Date.now() - startTime;
        let errorMessage = 'An unexpected error occurred';
        let errorHint = '';
        let rawDetails = '';

        if (axios.isAxiosError(lastError)) {
            rawDetails = lastError.message;
            if (lastError.stack) { rawDetails += '\n' + lastError.stack; }

            if (lastError.response) {
                errorMessage = `HTTP ${lastError.response.status}: ${lastError.response.statusText}`;
                if (lastError.response.status === 401 || lastError.response.status === 403) {
                    errorHint = 'Authentication failed - Verify credentials or token permissions.';
                } else if (lastError.response.status >= 500) {
                    errorHint = 'Server error - The remote server encountered an internal issue.';
                } else if (lastError.response.status === 404) {
                    errorHint = 'Not Found - Check the URL path and parameters.';
                }
            } else if (lastError.code === 'ECONNABORTED') {
                errorMessage = 'Request timeout. The server took too long to respond.';
                errorHint = 'Request timeout - Check timeout settings or server health.';
            } else if (lastError.code === 'ENOTFOUND') {
                errorMessage = 'DNS lookup failed. Could not find host.';
                errorHint = 'DNS resolution failed - Check domain spelling or your network connection.';
            } else if (lastError.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused. Server is not accepting connections.';
                errorHint = 'Connection refused - Check if the host and port are correct and the service is running.';
            } else {
                errorMessage = `Network error: ${lastError.code || 'Unknown'}`;
            }
            if (maxRetries > 0) {
                errorMessage += ` (failed after ${maxRetries + 1} attempts)`;
            }
        } else if (lastError instanceof Error) {
            errorMessage = lastError.message;
            rawDetails = lastError.stack || lastError.message;
        } else {
            rawDetails = String(lastError);
        }

        webviewView.webview.postMessage({ type: 'error', error: errorMessage, hint: errorHint, rawDetails, duration });

    } catch (error: unknown) {
        const duration = Date.now() - startTime;
        webviewView.webview.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
            hint: 'A critical extension error occurred before the request could be sent.',
            rawDetails: error instanceof Error ? error.stack || error.message : String(error),
            duration
        });
    } finally {
        this.abortController = undefined;
    }
}

	private handlePreview(webviewView: vscode.WebviewView, message: any): void {
		const { environment, inputs } = message;

		let urlResult: string | null = null;
		let headersResult: string | null = null;
		let bodyResult: string | null = null;

		const errors = { url: false, headers: false, body: false };

		// Preview URL
		try {
			if (inputs.url && inputs.url.trim()) {
				const result = this.environmentManager.substituteVariables(
					inputs.url.trim(),
					environment
				);

				if (result && result !== inputs.url.trim()) {
					urlResult = result;
				} else if (!result) {
					errors.url = true;
				}
			}
		} catch (e) {
			logger.error('URL preview error:', e);
			errors.url = true;
		}

		// Preview Headers
		try {
			if (inputs.headers && inputs.headers.trim()) {
				const headerLines = inputs.headers.split('\n');
				const substitutedLines: string[] = [];

				for (const line of headerLines) {
					const trimmedLine = line.trim();
					if (!trimmedLine || trimmedLine.startsWith('#')) {
						substitutedLines.push(line);
						continue;
					}

					const colonIndex = trimmedLine.indexOf(':');
					if (colonIndex > 0) {
						const key = trimmedLine.substring(0, colonIndex).trim();

						// Validate header key
						if (!/^[a-zA-Z0-9\-_]+$/.test(key)) {
						logger.warn(`Invalid header key in preview: ${key}`);
						}

						const value = trimmedLine.substring(colonIndex + 1).trim();

						const substitutedValue = this.environmentManager.substituteVariables(
							value,
							environment
						);

						const resolvedValue = substitutedValue || value;
						substitutedLines.push(`${key}: ${resolvedValue}`);
					} else {
						substitutedLines.push(line);
					}
				}

				headersResult = substitutedLines.join('\n');
			}
		} catch (e) {
			logger.error('Headers preview error:', e);
			errors.headers = true;
		}

		// Preview Body
		try {
			if (inputs.body && inputs.body.trim()) {
				const result = this.environmentManager.substituteVariables(
					inputs.body,
					environment
				);

				if (result && result !== inputs.body) {
					bodyResult = result;
				} else if (!result) {
					errors.body = true;
				}
			}
		} catch (e) {
			logger.error('Body preview error:', e);
			errors.body = true;
		}

		webviewView.webview.postMessage({
			type: 'previewResult',
			url: urlResult,
			headers: headersResult,
			body: bodyResult,
			errors: errors
		});
	}

	private handleValidation(webviewView: vscode.WebviewView, message: any): void {
		const { environment, inputs } = message;

		if (environment === 'none') {
			webviewView.webview.postMessage({
				type: 'validationResult',
				valid: true,
				message: 'No environment selected - validation skipped'
			});
			return;
		}

		const allContent = [
			inputs.url || '',
			inputs.headers || '',
			inputs.body || ''
		].join('\n');

		const validation = this.environmentManager.validateVariables(allContent, environment);

		if (validation.valid) {
			webviewView.webview.postMessage({
				type: 'validationResult',
				valid: true,
				message: 'All variables resolved successfully!'
			});
		} else {
			webviewView.webview.postMessage({
				type: 'validationResult',
				valid: false,
				message: `Missing variables: ${validation.missing.join(', ')}`
			});
		}
	}

	private async toggleEnvironmentTree(): Promise<void> {
		try {
			await vscode.commands.executeCommand('workbench.view.extension.dotfetch-container');
			await vscode.commands.executeCommand('dotfetchEnvironments.focus');
		} catch (error) {
			logger.error('Failed to toggle environment tree:', error);
			vscode.window.showWarningMessage('Could not open environment variables panel');
		}
	}

	public dispose(): void {
		this.cancelRequest();
	}
}

export function activate(context: vscode.ExtensionContext) {
	logger.log('Extension is now active!');

	// Initialize environment manager
	const environmentManager = new EnvironmentManager();

	// Create provider
	const provider = new DotFetchProvider(context, environmentManager);

	// Setup environment change callback to notify webview
	environmentManager.addEnvironmentsChangedCallback((environments: Environment[]) => {
		logger.log(`Environments updated: ${environments.length} environment(s)`);
		provider.notifyEnvironmentsChanged();
	});

	// Register webview
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('dotfetchView', provider)
	);

	// Register tree view for environment variables
	const treeProvider = new EnvironmentVariablesProvider(environmentManager);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('dotfetchEnvironments', treeProvider)
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.newRequest', () => {
			vscode.window.showInformationMessage('DotFetch: Ready to send requests!');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.copyVariable', (name: string, value: string) => {
			vscode.env.clipboard.writeText(`${name}: ${value}`).then(() => {
				vscode.window.showInformationMessage(`Copied: ${name} = ${value}`);
			});
		})
	);

	// Copy variable name
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.copyVariableName', (name: string) => {
			vscode.env.clipboard.writeText(name).then(() => {
				vscode.window.showInformationMessage(`Copied variable name: ${name}`);
			});
		})
	);

	// Copy variable placeholder
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.copyVariablePlaceholder', (name: string) => {
			vscode.env.clipboard.writeText(`{{${name}}}`).then(() => {
				vscode.window.showInformationMessage(`Copied: {{${name}}}`);
			});
		})
	);

	// Search variable
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.searchVariable', async () => {
			const variableName = await vscode.window.showInputBox({
				prompt: 'Enter variable name to search',
				placeHolder: 'e.g., API_KEY'
			});

			if (variableName) {
				const results = await treeProvider.findVariable(variableName);
				if (results.length === 0) {
					vscode.window.showInformationMessage(`Variable "${variableName}" not found`);
				} else {
					const message = results.map(r => `${r.env}: ${r.value}`).join('\n');
					vscode.window.showInformationMessage(
						`Found "${variableName}" in ${results.length} environment(s):\n${message}`
					);
				}
			}
		})
	);

	// Show all variable names
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.showAllVariables', () => {
			const names = treeProvider.getUniqueVariableNames();
			vscode.window.showQuickPick(names, {
				placeHolder: 'All variable names across environments'
			});
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.refreshEnvironments', () => {
			treeProvider.refresh();
			vscode.window.showInformationMessage('Environments refreshed');
		})
	);

	// Clean up on deactivation
	context.subscriptions.push({
		dispose: () => {
			logger.log('Extension deactivating...');
			environmentManager.dispose();
			provider.dispose();
		}
	});

	logger.log('Extension activated successfully!');
}

export function deactivate() {
	logger.log('Extension deactivated');
}