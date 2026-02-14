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

		// Cancel any pending request
		this.cancelRequest();

		// Create new abort controller
		this.abortController = new AbortController();

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

			// Validate URL after substitution
			if (!substitutedUrl || substitutedUrl.trim() === '') {
				webviewView.webview.postMessage({
					type: 'error',
					error: 'URL is empty after variable substitution',
					duration: 0
				});
				return;
			}

			// FIXED: Stricter URL validation
			try {
				const urlObj = new URL(substitutedUrl);
				if (!['http:', 'https:'].includes(urlObj.protocol)) {
					throw new Error('Protocol must be http or https');
				}
			} catch (urlError) {
				webviewView.webview.postMessage({
					type: 'error',
					error: 'Invalid URL format. URL must start with http:// or https:// and be properly formatted.',
					duration: 0
				});
				return;
			}

			// Substitute variables in headers
			let substitutedHeaders: { [key: string]: string } = {};
			if (message.headers) {
				const headerLines = message.headers.split('\n');
				for (const line of headerLines) {
					const trimmedLine = line.trim();
					if (!trimmedLine || trimmedLine.startsWith('#')) {
						continue; // Skip empty lines and comments
					}

					const colonIndex = trimmedLine.indexOf(':');
					if (colonIndex > 0) {
						const key = trimmedLine.substring(0, colonIndex).trim();

						// FIXED: Validate header key
						if (!/^[a-zA-Z0-9\-_]+$/.test(key)) {
							logger.warn(`Invalid header key: ${key}`);
							continue;
						}

						const value = trimmedLine.substring(colonIndex + 1).trim();

						const substitutedValue = this.environmentManager.substituteVariables(
							value,
							selectedEnvironment
						);

						// Use substituted value, or fallback to original if substitution failed
						substitutedHeaders[key] = substitutedValue || value;
					}
				}
			}

			// Substitute variables in body
			let substitutedBody = message.body || '';
			if (substitutedBody) {
				substitutedBody = this.environmentManager.substituteVariables(
					substitutedBody,
					selectedEnvironment
				);
			}

			// Validate all variables are present (only if environment is selected)
			if (selectedEnvironment !== 'none') {
				const fieldsToCheck = [
					substitutedUrl,
					JSON.stringify(substitutedHeaders),
					substitutedBody
				];

				let allFieldsValid = true;
				const missingVariables: string[] = [];

				for (const field of fieldsToCheck) {
					if (field) {
						const validation = this.environmentManager.validateVariables(
							field,
							selectedEnvironment
						);
						if (!validation.valid) {
							allFieldsValid = false;
							missingVariables.push(...validation.missing);
						}
					}
				}

				if (!allFieldsValid) {
					const uniqueMissing = [...new Set(missingVariables)];
					throw new Error(`Missing environment variables: ${uniqueMissing.join(', ')}`);
				}
			}

			// Parse body if it exists
			let data: any = undefined;
			if (substitutedBody) {
				try {
					data = JSON.parse(substitutedBody);
				} catch (e) {
					// If not valid JSON, send as string
					data = substitutedBody;
				}
			}

			// Validate and sanitize timeout
			const timeout = (message.timeout && message.timeout > 0 && message.timeout <= DotFetchProvider.MAX_TIMEOUT)
				? message.timeout
				: DotFetchProvider.DEFAULT_TIMEOUT;

			// Log request
			logger.log('Sending request:', {
				method: message.method,
				url: substitutedUrl,
				environment: selectedEnvironment,
				timeout: `${timeout}ms`
			});

			// Make the request
			const response: AxiosResponse = await axios({
				method: message.method,
				url: substitutedUrl,
				headers: substitutedHeaders,
				data: data,
				timeout: timeout,
				validateStatus: () => true, // Accept any status code
				maxContentLength: DotFetchProvider.MAX_RESPONSE_SIZE,
				maxBodyLength: DotFetchProvider.MAX_RESPONSE_SIZE,
				signal: this.abortController.signal
			});

			const duration = Date.now() - startTime;

			// Check response size
			const responseSize = JSON.stringify(response.data).length;
			const isLarge = responseSize > DotFetchProvider.DISPLAY_THRESHOLD;

			// Log response
			logger.log('Response received:', {
				status: response.status,
				duration: `${duration}ms`,
				size: `${(responseSize / 1024).toFixed(2)} KB`
			});

			if (isLarge) {
				// For large responses, send a truncated version
				webviewView.webview.postMessage({
					type: 'response',
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
					data: `[Response too large to display: ${(responseSize / 1024).toFixed(2)} KB]\n\nFirst 1000 characters:\n${JSON.stringify(response.data).substring(0, 1000)}...`,
					duration: duration,
					isLarge: true,
					size: responseSize
				});
			} else {
				webviewView.webview.postMessage({
					type: 'response',
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
					data: response.data,
					duration: duration,
					isLarge: false,
					size: responseSize
				});
			}

		} catch (error: unknown) {
			const duration = Date.now() - startTime;

			// Check if request was cancelled
			if (error instanceof Error && error.name === 'CanceledError') {
			logger.log('Request cancelled by user');
				webviewView.webview.postMessage({
					type: 'error',
					error: 'Request cancelled',
					duration: duration,
					cancelled: true
				});
				return;
			}

			// Log error
			logger.error('Request error:', error);

			// Handle different types of errors
			let errorMessage: string;
			let fullError: any = undefined;

			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError;

				if (axiosError.response) {
					// Server responded with error status
					errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`;

					if (axiosError.response.data) {
						const dataStr = typeof axiosError.response.data === 'string'
							? axiosError.response.data
							: JSON.stringify(axiosError.response.data);

						// Only include response data if it's small
						if (dataStr.length < 500) {
							errorMessage += `\n\n${dataStr}`;
						} else {
							errorMessage += `\n\n${dataStr.substring(0, 500)}...`;
						}

						fullError = axiosError.response.data;
					}
				} else if (axiosError.request) {
					// Request was made but no response received
					if (axiosError.code === 'ECONNABORTED') {
						errorMessage = 'Request timeout. The server took too long to respond.';
					} else if (axiosError.code === 'ENOTFOUND') {
						errorMessage = 'DNS lookup failed. Could not find host.';
					} else if (axiosError.code === 'ECONNREFUSED') {
						errorMessage = 'Connection refused. Server is not accepting connections.';
					} else if (axiosError.code === 'ENOTFOUND') {
						errorMessage = 'Network error. Please check your internet connection.';
					} else {
						errorMessage = `Network error: ${axiosError.code || 'Unknown'}. Check your connection and try again.`;
					}
				} else {
					// Something else went wrong
					errorMessage = axiosError.message;
				}
			} else if (error instanceof Error) {
				// Standard Error object
				errorMessage = error.message || 'Unknown error occurred';
			} else {
				// Non-Error object
				errorMessage = 'An unexpected error occurred';
			}

			webviewView.webview.postMessage({
				type: 'error',
				error: errorMessage,
				duration: duration,
				fullError: fullError
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