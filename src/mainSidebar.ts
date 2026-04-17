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
        
        if (type === 'action' && commandId) {
            this.command = {
                command: commandId,
                title: label
            };
            this.iconPath = this.getIconForAction(commandId);
            this.contextValue = 'mainAction';
        } else if (type === 'favorite' && request) {
            this.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
            this.description = request.method;
            this.contextValue = 'favoriteItem';
            this.command = {
                command: 'dotfetch.openRequestBuilder',
                title: 'Open Request',
                arguments: [request]
            };
        } else if (type === 'header' || type === 'section') {
            this.contextValue = type;
        }
    }

    private getIconForAction(cmd: string): vscode.ThemeIcon {
        if (cmd === 'dotfetch.openRequestBuilder') return new vscode.ThemeIcon('rocket');
        if (cmd === 'dotfetch.importCurl') return new vscode.ThemeIcon('terminal');
        return new vscode.ThemeIcon('star');
    }
}

export class MainSidebarProvider implements vscode.TreeDataProvider<MainTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MainTreeItem | undefined | void> = new vscode.EventEmitter<MainTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MainTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private dataManager: DataManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MainTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MainTreeItem): Thenable<MainTreeItem[]> {
        if (element) {
            if (element.label === '⭐ Favorites') {
                const favorites = this.dataManager.getFavorites();
                if (favorites.length === 0) {
                    const empty = new MainTreeItem('No favorites yet', vscode.TreeItemCollapsibleState.None, 'header');
                    empty.iconPath = new vscode.ThemeIcon('info');
                    return Promise.resolve([empty]);
                }
                return Promise.resolve(favorites.map(req => 
                    new MainTreeItem(req.name, vscode.TreeItemCollapsibleState.None, 'favorite', undefined, req)
                ));
            }
            return Promise.resolve([]);
        }
        
        const items: MainTreeItem[] = [];
        
        // Quick Actions
        items.push(new MainTreeItem('🚀 New Request', vscode.TreeItemCollapsibleState.None, 'action', 'dotfetch.openRequestBuilder'));
        items.push(new MainTreeItem('📥 Import cURL', vscode.TreeItemCollapsibleState.None, 'action', 'dotfetch.importCurl'));
        
        // Pinned / Favorites Section
        items.push(new MainTreeItem('⭐ Favorites', vscode.TreeItemCollapsibleState.Expanded, 'section'));
        
        return Promise.resolve(items);
    }
}
