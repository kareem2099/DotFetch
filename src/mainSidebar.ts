import * as vscode from 'vscode';
import { DataManager, RequestData } from './dataManager';

export class MainTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'action' | 'favorite' | 'header' | 'section',
        public readonly commandId?: string,
        public readonly request?: RequestData
    ) {
        super(label, collapsibleState);

        switch (type) {
            case 'action':
                if (commandId) {
                    this.command = { command: commandId, title: label };
                    this.iconPath = this.getIconForAction(commandId);
                }
                this.contextValue = 'mainAction';
                break;

            case 'favorite':
                if (request) {
                    this.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
                    this.description = request.method;
                    this.command = {
                        command: 'dotfetch.openRequestBuilder',
                        title: 'Open Request',
                        arguments: [request]
                    };
                }
                this.contextValue = 'favoriteItem';
                break;

            case 'section':
                // Collapsible section header — no command, just a container
                this.iconPath = new vscode.ThemeIcon('star', new vscode.ThemeColor('charts.yellow'));
                this.contextValue = 'favoritesSection';   // <-- key: used in getChildren
                break;

            case 'header':
                // Non-collapsible info/empty-state row
                this.contextValue = 'infoRow';
                break;
        }
    }

    private getIconForAction(cmd: string): vscode.ThemeIcon {
        switch (cmd) {
            case 'dotfetch.openRequestBuilder': return new vscode.ThemeIcon('rocket');
            case 'dotfetch.importCurl': return new vscode.ThemeIcon('terminal');
            default: return new vscode.ThemeIcon('circle-outline');
        }
    }
}

export class MainSidebarProvider implements vscode.TreeDataProvider<MainTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<MainTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private dataManager: DataManager) { }

    refresh(): void { this._onDidChangeTreeData.fire(); }

    getTreeItem(element: MainTreeItem): vscode.TreeItem { return element; }

    getChildren(element?: MainTreeItem): Thenable<MainTreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new MainTreeItem('New Request', vscode.TreeItemCollapsibleState.None, 'action', 'dotfetch.openRequestBuilder'),
                new MainTreeItem('Import cURL', vscode.TreeItemCollapsibleState.None, 'action', 'dotfetch.importCurl'),
                new MainTreeItem('Favorites', vscode.TreeItemCollapsibleState.Expanded, 'section'),
            ]);
        }

        // Use contextValue — never compare labels (labels can change/be localised)
        if (element.contextValue === 'favoritesSection') {
            const favorites = this.dataManager.getFavorites();
            if (favorites.length === 0) {
                const empty = new MainTreeItem('No favorites yet', vscode.TreeItemCollapsibleState.None, 'header');
                empty.iconPath = new vscode.ThemeIcon('info');
                return Promise.resolve([empty]);
            }
            return Promise.resolve(
                favorites.map(req =>
                    new MainTreeItem(req.name, vscode.TreeItemCollapsibleState.None, 'favorite', undefined, req)
                )
            );
        }

        return Promise.resolve([]);
    }
}