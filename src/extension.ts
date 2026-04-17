
import * as vscode from 'vscode';
import { EnvironmentManager } from './environmentManager';
import { EnvironmentVariablesProvider } from './environmentTree';
import { DataManager, RequestData } from './dataManager';
import { MainSidebarProvider } from './mainSidebar';
import { CollectionProvider } from './collectionTree';
import { HistoryProvider } from './historyTree';
import { DotFetchPanel } from './webviewPanel';
import { RequestService } from './requestService';
import { logger } from './logger';
import { EnvironmentTreeItem } from './environmentTree';

export function activate(context: vscode.ExtensionContext) {
	logger.log('DotSuite (DotFetch) is now active!');

	// Initialize Managers & Services
	const environmentManager = new EnvironmentManager(context);
	const dataManager = new DataManager(context);
	const requestService = new RequestService(environmentManager);

	// Initialize Tree Providers
	const mainSidebarProvider = new MainSidebarProvider(dataManager);
	const collectionProvider = new CollectionProvider(dataManager);
	const historyProvider = new HistoryProvider(dataManager);
	const environmentTreeProvider = new EnvironmentVariablesProvider(environmentManager);

	// Register Tree Views
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider('dotfetchLaunch', mainSidebarProvider),
		vscode.window.registerTreeDataProvider('dotfetchCollections', collectionProvider),
		vscode.window.registerTreeDataProvider('dotfetchHistory', historyProvider),
		vscode.window.registerTreeDataProvider('dotfetchEnvironments', environmentTreeProvider)
	);

	// Register Internal Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.refreshAllTrees', () => {
			mainSidebarProvider.refresh();
			collectionProvider.refresh();
			historyProvider.refresh();
		})
	);

	// Register User Commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.openRequestBuilder', (request?: RequestData) => {
			const panel = DotFetchPanel.createOrShow(context.extensionUri, dataManager, environmentManager, requestService);
			if (request) {
				panel.loadRequest(request);
			}
		}),

		vscode.commands.registerCommand('dotfetch.importCurl', async () => {
			const curlString = await vscode.window.showInputBox({
				prompt: 'Paste a cURL command to import',
				placeHolder: "curl -X POST 'https://api.example.com/v1' -H 'Content-Type: application/json' -d '{}'",
				ignoreFocusOut: true
			});
			if (!curlString) { return; }

			// Basic cURL parser
			const request: RequestData = {
				id: Date.now().toString(),
				name: 'Imported from cURL',
				method: 'GET',
				url: '',
				headers: '',
				body: '',
				createdAt: new Date().toISOString()
			};

			// Extract method
			const methodMatch = curlString.match(/-X\s+([A-Z]+)/);
			if (methodMatch) { request.method = methodMatch[1]; }

			// Extract URL (first quoted string or bare URL)
			const urlMatch = curlString.match(/curl.*?['"]([^'"]+)['"]/);
			if (urlMatch) { request.url = urlMatch[1]; }

			// Extract headers
			const headerMatches = [...curlString.matchAll(/-H\s+['"]([^'"]+)['"]/g)];
			request.headers = headerMatches.map(m => m[1]).join('\n');

			// Extract body
			const bodyMatch = curlString.match(/(?:-d|--data(?:-raw)?)\s+['"](.+?)['"]\s*(?:-|$)/s);
			if (bodyMatch) {
				request.body = bodyMatch[1];
				if (!methodMatch) { request.method = 'POST'; } // default to POST if body present
			}

			const panel = DotFetchPanel.createOrShow(context.extensionUri, dataManager, environmentManager, requestService);
			panel.loadRequest(request);
			vscode.window.showInformationMessage(`cURL imported: ${request.method} ${request.url}`);
		}),

		vscode.commands.registerCommand('dotfetch.createCollection', async () => {
			const name = await vscode.window.showInputBox({ prompt: 'Enter collection name' });
			if (name) {
				await dataManager.createCollection(name);
				collectionProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('dotfetch.clearHistory', async () => {
			const confirmed = await vscode.window.showWarningMessage('Are you sure you want to clear all history?', { modal: true }, 'Clear');
			if (confirmed === 'Clear') {
				await dataManager.clearHistory();
				historyProvider.refresh();
			}
		}),

		vscode.commands.registerCommand('dotfetch.refreshCollections', () => collectionProvider.refresh()),
		vscode.commands.registerCommand('dotfetch.refreshHistory', () => historyProvider.refresh()),
		vscode.commands.registerCommand('dotfetch.refreshEnvironments', () => environmentTreeProvider.refresh()),

		vscode.commands.registerCommand('dotfetch.copyVariable', (name: string, value: string) => {
			vscode.env.clipboard.writeText(value);
			vscode.window.showInformationMessage(`Copied: ${name}`);
		}),

		vscode.commands.registerCommand('dotfetch.openEnvironmentFile', (filePath: string) => {
			vscode.workspace.openTextDocument(filePath).then(doc => vscode.window.showTextDocument(doc));
		}),

		vscode.commands.registerCommand('dotfetch.setActiveEnvironment', async (item: EnvironmentTreeItem) => {
			if (item.environment) {
				await environmentManager.setActiveEnvironment(item.environment.name);
				environmentTreeProvider.refresh();
				// Notify open webviews
				DotFetchPanel.currentPanel?.updateEnvironments();
			}
		}),

		vscode.commands.registerCommand('dotfetch.clearActiveEnvironment', async () => {
			await environmentManager.setActiveEnvironment('none');
			environmentTreeProvider.refresh();
			DotFetchPanel.currentPanel?.updateEnvironments();
		})
	);

	// Environment variable specific commands
	context.subscriptions.push(
		vscode.commands.registerCommand('dotfetch.copyVariableName', (name: string) => vscode.env.clipboard.writeText(name)),
		vscode.commands.registerCommand('dotfetch.copyVariablePlaceholder', (name: string) => vscode.env.clipboard.writeText(`{{${name}}}`)),
		vscode.commands.registerCommand('dotfetch.searchVariable', async () => {
			const variableName = await vscode.window.showInputBox({
				prompt: 'Enter variable name to search',
				placeHolder: 'e.g., API_KEY'
			});

			if (variableName) {
				const results = await environmentTreeProvider.findVariable(variableName);
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

	logger.log('Extension components registered successfully!');
}

export function deactivate() {
	logger.log('Extension deactivated');
}