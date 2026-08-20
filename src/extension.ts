
import * as vscode from 'vscode';
import { EnvironmentManager } from './environmentManager';
import { EnvironmentVariablesProvider } from './environmentTree';
import { DataManager, RequestData } from './dataManager';
import { MainSidebarProvider } from './mainSidebar';
import { CollectionProvider, CollectionTreeItem } from './collectionTree';
import { HistoryProvider } from './historyTree';
import { DotFetchPanel } from './webviewPanel';
import { RequestService } from './requestService';
import { logger } from './logger';
import { EnvironmentTreeItem } from './environmentTree';
import { parseCurl } from './utils/curlParser';

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
		vscode.commands.registerCommand('dotfetch.openRequestBuilder', (request?: RequestData, collectionName?: string) => {
			const panel = DotFetchPanel.createOrShow(context.extensionUri, dataManager, environmentManager, requestService);
			if (request) {
				panel.loadRequest(request, collectionName);
			}
		}),

		vscode.commands.registerCommand('dotfetch.importCurl', async () => {
			const curlString = await vscode.window.showInputBox({
				prompt: 'Paste a cURL command to import',
				placeHolder: "curl -X POST 'https://api.example.com/v1' -H 'Content-Type: application/json' -d '{}'",
				ignoreFocusOut: true
			});
			if (!curlString) { return; }

			const parsed = parseCurl(curlString);
			const request: RequestData = {
				id: Date.now().toString(),
				name: 'Imported from cURL',
				method: parsed.method || 'GET',
				url: parsed.url || '',
				headers: parsed.headers || '',
				body: parsed.body || '',
				queryParams: parsed.queryParams || [],
				createdAt: new Date().toISOString()
			};

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
		}),

		vscode.commands.registerCommand('dotfetch.deleteRequestFromCollection', async (item: CollectionTreeItem) => {
			if (!item.collectionName || !item.request) { return; }
			const confirmed = await vscode.window.showWarningMessage(
				`Are you sure you want to delete "${item.request.name}" from "${item.collectionName}"?`,
				{ modal: true },
				'Delete'
			);
			if (confirmed === 'Delete') {
				await dataManager.removeFromCollection(item.collectionName, item.request.id);
				collectionProvider.refresh();
				vscode.window.showInformationMessage(`Deleted "${item.request.name}"`);
			}
		}),

		vscode.commands.registerCommand('dotfetch.deleteCollection', async (item: CollectionTreeItem) => {
			if (!item.collectionName) { return; }
			if (item.collectionName === 'Templates') {
				return vscode.window.showErrorMessage('The Templates collection cannot be deleted.');
			}
			const confirmed = await vscode.window.showWarningMessage(
				`Are you sure you want to delete the entire "${item.collectionName}" collection?`,
				{ modal: true },
				'Delete Collection'
			);
			if (confirmed === 'Delete Collection') {
				await dataManager.deleteCollection(item.collectionName);
				collectionProvider.refresh();
				vscode.window.showInformationMessage(`Collection "${item.collectionName}" deleted`);
			}
		}),

		vscode.commands.registerCommand('dotfetch.editRequestInCollection', (item: CollectionTreeItem) => {
			if (item.request) {
				vscode.commands.executeCommand('dotfetch.openRequestBuilder', item.request, item.collectionName);
			}
		}),

		vscode.commands.registerCommand('dotfetch.newRequest', () => {
			vscode.commands.executeCommand('dotfetch.openRequestBuilder');
		}),

		vscode.commands.registerCommand('dotfetch.duplicateRequest', async (item: CollectionTreeItem) => {
			if (!item.collectionName || !item.request) { return; }
			await dataManager.duplicateRequest(item.collectionName, item.request.id);
			collectionProvider.refresh();
			vscode.window.showInformationMessage(`Duplicated "${item.request.name}"`);
		}),

		vscode.commands.registerCommand('dotfetch.focusUrl', () => {
			DotFetchPanel.currentPanel?.postMessage({ type: 'focusUrl' });
		}),

		vscode.commands.registerCommand('dotfetch.sendRequest', () => {
			DotFetchPanel.currentPanel?.postMessage({ type: 'triggerSend' });
		}),

		vscode.commands.registerCommand('dotfetch.clearForm', () => {
			DotFetchPanel.currentPanel?.postMessage({ type: 'triggerClear' });
		}),

		vscode.commands.registerCommand('dotfetch.saveRequest', () => {
			DotFetchPanel.currentPanel?.postMessage({ type: 'triggerSave' });
		}),

		vscode.commands.registerCommand('dotfetch.selectEnvironment', async () => {
			const envs = environmentManager.getEnvironments();
			const current = environmentManager.getActiveEnvironment();
			const items = [
				{ label: '$(circle-slash) No Environment', description: current === 'none' ? '(Active)' : '', envName: 'none' },
				...envs.map(e => ({
					label: `$(symbol-variable) ${e.name}`,
					description: e.name === current ? '(Active)' : '',
					envName: e.name
				}))
			];
			const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select active environment for DotFetch' });
			if (selected) {
				await environmentManager.setActiveEnvironment(selected.envName);
				environmentTreeProvider.refresh();
				DotFetchPanel.currentPanel?.updateEnvironments();
			}
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