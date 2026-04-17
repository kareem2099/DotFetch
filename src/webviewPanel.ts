import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DataManager, RequestData } from './dataManager';
import { EnvironmentManager } from './environmentManager';
import { RequestService } from './requestService';
import { logger } from './logger';

export class DotFetchPanel {
    public static currentPanel: DotFetchPanel | undefined;
    private static readonly viewType = 'dotfetchEditor';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(
        extensionUri: vscode.Uri, 
        dataManager: DataManager, 
        environmentManager: EnvironmentManager,
        requestService: RequestService
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DotFetchPanel.currentPanel) {
            DotFetchPanel.currentPanel.panel.reveal(column);
            return DotFetchPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            DotFetchPanel.viewType,
            'Request Builder',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
                retainContextWhenHidden: true
            }
        );

        DotFetchPanel.currentPanel = new DotFetchPanel(panel, extensionUri, dataManager, environmentManager, requestService);
        return DotFetchPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private dataManager: DataManager,
        private environmentManager: EnvironmentManager,
        private requestService: RequestService
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'webviewReady':
                        this.handleWebviewReady();
                        break;
                    case 'sendRequest':
                        await this.handleSendRequest(message);
                        break;
                    case 'getCollections': {
                        const collections = this.dataManager.getCollections();
                        const colArray = Object.keys(collections).map(name => ({ id: name, name: name }));
                        this.panel.webview.postMessage({ type: 'collections', collections: colArray });
                        break;
                    }
                    case 'saveRequest': {
                        const requestData: RequestData = {
                            id: Date.now().toString(),
                            name: message.name || 'Untitled',
                            method: message.request?.method || 'GET',
                            url: message.request?.url || '',
                            headers: message.request?.headers || '',
                            body: message.request?.body || '',
                            notes: message.request?.notes,
                            queryParams: message.request?.queryParams,
                            createdAt: new Date().toISOString(),
                        };
                        await this.dataManager.saveToCollection(message.collectionId, requestData);
                        break;
                    }
                    case 'toggleFavorite': {
                        // Guard: ignore empty requests
                        if (!message.request?.url?.trim()) {
                            break;
                        }
                        let requestId = message.request?.id;
                        if (!requestId) {
                            // It's a completely new/unsaved request, we must save it first to have an ID
                            requestId = Date.now().toString();
                            const requestData: RequestData = {
                                ...message.request,
                                id: requestId,
                                name: message.request.name || message.request.url || 'Untitled Favorite',
                                createdAt: new Date().toISOString()
                            };
                            await this.dataManager.addHistory(requestData);
                            // Also update the UI with the new ID
                            this.panel.webview.postMessage({ type: 'loadRequest', data: requestData });
                        }
                        await this.dataManager.toggleFavorite(requestId);
                        break;
                    }
                    case 'cancelRequest':
                        this.requestService.cancelRequest();
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
            null,
            this.disposables
        );
    }

    public loadRequest(request: RequestData) {
        this.panel.webview.postMessage({ type: 'loadRequest', data: request });
    }

    private async handleSendRequest(message: any) {
        // Proxy webview to intercept response for history saving
        let capturedResponse: any = null;

        const proxyWebview = {
            postMessage: (msg: any) => {
                if (msg.type === 'response') {
                    capturedResponse = msg;
                }
                this.panel.webview.postMessage(msg);
            }
        } as vscode.Webview;

        await this.requestService.execute(message, proxyWebview);

        // Save to history on success
        if (capturedResponse) {
            const historyEntry: RequestData = {
                id: Date.now().toString(),
                name: message.url || 'Request',
                method: message.method || 'GET',
                url: message.url || '',
                headers: message.headers || '',
                body: message.body || '',
                notes: message.notes,
                queryParams: message.queryParams,
                retryCount: message.retryCount,
                timeout: message.timeout,
                status: capturedResponse.status,
                duration: capturedResponse.duration,
                createdAt: new Date().toISOString(),
                lastUsedAt: new Date().toISOString(),
            };
            await this.dataManager.addHistory(historyEntry);
        }
    }

    public updateEnvironments() {
        this.panel.webview.postMessage({
            type: 'environments',
            environments: this.environmentManager.getEnvironments(),
            activeEnvironment: this.environmentManager.getActiveEnvironment()
        });
    }

    private handleWebviewReady() {
        // Initial state loading
        this.updateEnvironments();
    }

    private update() {
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'script.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'styles.css'));
        const loggerUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'logger.js'));
        const nonce = this.getNonce();

        const htmlPath = path.join(this.extensionUri.fsPath, 'media', 'index.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Replace paths
        htmlContent = htmlContent.replace('./styles.css', styleUri.toString());
        htmlContent = htmlContent.replace('./logger.js', loggerUri.toString());
        htmlContent = htmlContent.replace('./script.js', scriptUri.toString());
        
        // Add nonce and CSP
        const csp = `
            <meta http-equiv="Content-Security-Policy" 
                  content="default-src 'none'; 
                           style-src 'unsafe-inline' ${webview.cspSource}; 
                           script-src 'nonce-${nonce}'; 
                           img-src ${webview.cspSource} https: data:; 
                           connect-src https:; 
                           font-src ${webview.cspSource};">
        `;
        htmlContent = htmlContent.replace('<head>', '<head>' + csp);
        htmlContent = htmlContent.replace(/<script src="([^"]+)">/g, `<script nonce="${nonce}" src="$1">`);

        return htmlContent;
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose() {
        DotFetchPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) { x.dispose(); }
        }
    }
}
