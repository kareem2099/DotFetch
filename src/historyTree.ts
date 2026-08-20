import * as vscode from 'vscode';
import { DataManager, RequestData } from './dataManager';

export class HistoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly request: RequestData
    ) {
        let displayPath = request.name;
        if (!displayPath || displayPath === request.url) {
            try {
                const parsed = new URL(request.url);
                displayPath = parsed.pathname + (parsed.search ? parsed.search : '');
            } catch {
                displayPath = request.url;
            }
        }

        super(`${request.method.toUpperCase()} ${displayPath || '/'}`, vscode.TreeItemCollapsibleState.None);
        
        this.description = request.status ? `${request.status}  ${request.duration ? request.duration + 'ms' : ''}`.trim() : '';
        this.tooltip = `${request.method.toUpperCase()} ${request.url}\nStatus: ${request.status || '---'}\nDuration: ${request.duration ? request.duration + 'ms' : '--'}\nTime: ${new Date(request.createdAt).toLocaleTimeString()}`;
        this.iconPath = this.getIcon(request.method);
        this.contextValue = 'historyItem';
        
        this.command = {
            command: 'dotfetch.openRequestBuilder',
            title: 'Open Request',
            arguments: [request]
        };
    }

    private getIcon(method: string): vscode.ThemeIcon {
        switch (method.toUpperCase()) {
            case 'GET': return new vscode.ThemeIcon('cloud-download', new vscode.ThemeColor('debugIcon.breakpointForeground'));
            case 'POST': return new vscode.ThemeIcon('cloud-upload', new vscode.ThemeColor('debugIcon.breakpointDisabledForeground'));
            case 'PUT': return new vscode.ThemeIcon('edit', new vscode.ThemeColor('debugIcon.breakpointStackframeForeground'));
            case 'DELETE': return new vscode.ThemeIcon('trash', new vscode.ThemeColor('errorForeground'));
            default: return new vscode.ThemeIcon('send');
        }
    }
}

export class HistoryProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private dataManager: DataManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HistoryTreeItem): Thenable<HistoryTreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        
        const history = this.dataManager.getHistory();
        
        if (history.length === 0) {
            const emptyHistory: RequestData = {
                id: 'empty',
                name: 'No requests yet',
                method: 'GET',
                url: '',
                headers: '',
                body: '',
                createdAt: new Date().toISOString()
            };
            const emptyItem = new HistoryTreeItem(emptyHistory);
            emptyItem.label = 'No history yet';
            emptyItem.command = undefined;
            emptyItem.iconPath = new vscode.ThemeIcon('info');
            return Promise.resolve([emptyItem]);
        }
        
        return Promise.resolve(history.map(req => new HistoryTreeItem(req)));
    }
}
