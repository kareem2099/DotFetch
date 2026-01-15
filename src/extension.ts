import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { EnvironmentManager, Environment } from './environmentManager';
import { EnvironmentVariablesProvider, EnvironmentTreeItem } from './environmentTree';

class DotFetchProvider implements vscode.WebviewViewProvider {
	constructor(private context: vscode.ExtensionContext, private environmentManager: EnvironmentManager) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
		};

		const styleUri = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css')
		);
		const scriptUri = webviewView.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'script.js')
		);

		// Read the HTML file
		const htmlPath = path.join(this.context.extensionPath, 'media', 'index.html');
		let htmlContent = fs.readFileSync(htmlPath, 'utf8');
		
		// Replace the stylesheet and script paths
		htmlContent = htmlContent.replace('./styles.css', styleUri.toString());
		htmlContent = htmlContent.replace('./script.js', scriptUri.toString());

		webviewView.webview.html = htmlContent;

		// Load persisted state
		const state = this.context.globalState.get('dotfetch', {
			history: [],
			collections: {},
			settings: { timeout: 10000 }
		});

		webviewView.webview.postMessage({
			type: 'loadState',
			state: state
		});

		// Handle messages from the webview
		webviewView.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.type) {
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
						this.toggleEnvironmentTree();
						break;
					case 'notify':
						if (message.level === 'error') {
							vscode.window.showErrorMessage(message.text);
						} else {
							vscode.window.showInformationMessage(message.text);
						}
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	private sendEnvironments(webviewView: vscode.WebviewView): void {
		const environments = this.environmentManager.getEnvironments();
		webviewView.webview.postMessage({
			type: 'environments',
			environments: environments
		});
	}

	private async handleRequest(webviewView: vscode.WebviewView, message: any) {
		const startTime = Date.now();

		try {
			// Validate and substitute variables
			const selectedEnvironment = message.environment || 'local';

			// Substitute variables in URL
			let substitutedUrl = message.url;
			if (substitutedUrl) {
				substitutedUrl = this.environmentManager.substituteVariables(substitutedUrl, selectedEnvironment);
			}

			// Substitute variables in headers
			let substitutedHeaders: {[key: string]: string} = {};
			if (message.headers) {
				const headerLines = message.headers.split('\n');
				for (const line of headerLines) {
					const colonIndex = line.indexOf(':');
					if (colonIndex > 0) {
						const key = line.substring(0, colonIndex).trim();
						const value = line.substring(colonIndex + 1).trim();
						const substitutedValue = this.environmentManager.substituteVariables(value, selectedEnvironment);
						// Only add header if substitution succeeded (not null)
						if (substitutedValue !== null) {
							substitutedHeaders[key] = substitutedValue;
						}
					}
				}
			}

			// Substitute variables in body
			let substitutedBody = message.body || '';
			if (substitutedBody) {
				substitutedBody = this.environmentManager.substituteVariables(substitutedBody, selectedEnvironment);
			}

			// Validate all variables are present
			const fieldsToCheck = [
				substitutedUrl,
				JSON.stringify(substitutedHeaders),
				substitutedBody
			];

			let allFieldsValid = true;
			const missingVariables: string[] = [];

			for (const field of fieldsToCheck) {
				if (field) {
					const validation = this.environmentManager.validateVariables(field, selectedEnvironment);
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

			const response: AxiosResponse = await axios({
				method: message.method,
				url: substitutedUrl,
				headers: substitutedHeaders,
				data: data,
				timeout: message.timeout || 10000,
				validateStatus: () => true // Accept any status code
			});

			const duration = Date.now() - startTime;

			webviewView.webview.postMessage({
				type: 'response',
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: response.data,
				duration: duration
			});

		} catch (error: any) {
			const duration = Date.now() - startTime;
			
			webviewView.webview.postMessage({
				type: 'error',
				error: error.response?.data || error.message,
				duration: duration
			});
		}
	}

	private handlePreview(webviewView: vscode.WebviewView, message: any): void {
		const { environment, inputs } = message;

		let urlResult: string | null = null;
		let headersResult: string | null = null;
		let bodyResult: string | null = null;

		const errors = { url: false, headers: false, body: false };

		try {
			if (inputs.url) {
				const result = this.environmentManager.substituteVariables(inputs.url, environment);
				urlResult = typeof result === 'string' ? result : null;
				if (!urlResult && inputs.url) {errors.url = true;}
			}
		} catch (e) {
			errors.url = true;
		}

		try {
			if (inputs.headers) {
				// Parse headers and substitute variables in each header value
				const headerLines = inputs.headers.split('\n');
				const substitutedLines: string[] = [];

				for (const line of headerLines) {
					const colonIndex = line.indexOf(':');
					if (colonIndex > 0) {
						const key = line.substring(0, colonIndex).trim();
						const value = line.substring(colonIndex + 1).trim();
						const substitutedValue = this.environmentManager.substituteVariables(value, environment);
						const resolvedValue = substitutedValue !== null ? substitutedValue : value;
						substitutedLines.push(`${key}: ${resolvedValue}`);
					} else {
						substitutedLines.push(line);
					}
				}

				headersResult = substitutedLines.join('\n');
				if (!headersResult && inputs.headers) {errors.headers = true;}
			}
		} catch (e) {
			errors.headers = true;
		}

		try {
			if (inputs.body) {
				const result = this.environmentManager.substituteVariables(inputs.body, environment);
				bodyResult = typeof result === 'string' ? result : null;
				if (!bodyResult && inputs.body) {errors.body = true;}
			}
		} catch (e) {
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

	private toggleEnvironmentTree(): void {
		// Use VS Code's built-in view commands to toggle the environment tree
		// First try to focus it, if it's already focused, toggle the view container
		vscode.commands.executeCommand('workbench.view.extension.dotfetch-container').then(() => {
			// After revealing the container, focus the specific tree view
		vscode.commands.executeCommand('dotfetchEnvironments.focus');
		});
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('DotFetch extension is now active!');

	// Initialize environment manager
	const environmentManager = new EnvironmentManager();

	// Setup environment change callback to notify webview
	environmentManager.setEnvironmentsChangedCallback((environments: Environment[]) => {
		// This will be used to notify the webview when environments change
		console.log('Environments updated:', environments.length);
	});

	const provider = new DotFetchProvider(context, environmentManager);

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

	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.refreshEnvironments', () => {
			treeProvider.refresh();
		})
	);

	// Clean up on deactivation
	context.subscriptions.push({
		dispose: () => environmentManager.dispose()
	});
}

export function deactivate() {}
