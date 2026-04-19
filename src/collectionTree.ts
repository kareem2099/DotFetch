import * as vscode from 'vscode';
import { DataManager, RequestData } from './dataManager';

export class CollectionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly collectionName?: string,
        public readonly request?: RequestData,
        public readonly isTemplateFolder: boolean = false
    ) {
        super(label, collapsibleState);
        
        if (request) {
            this.iconPath = this.getIcon(request.method);
            this.description = request.method;
            this.contextValue = 'collectionRequest';
            this.command = {
                command: 'dotfetch.openRequestBuilder',
                title: 'Open Request',
                arguments: [request, collectionName]
            };
        } else if (isTemplateFolder) {
            this.iconPath = new vscode.ThemeIcon('symbol-parameter', new vscode.ThemeColor('charts.orange'));
            this.contextValue = 'templateFolder';
        } else {
            this.iconPath = new vscode.ThemeIcon('folder-library');
            this.contextValue = 'collectionFolder';
        }
    }

    private getIcon(method: string): vscode.ThemeIcon {
        switch (method.toUpperCase()) {
            case 'GET': return new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.blue'));
            case 'POST': return new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.green'));
            case 'PUT': return new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.yellow'));
            case 'DELETE': return new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('charts.red'));
            default: return new vscode.ThemeIcon('symbol-method');
        }
    }
}

export class CollectionProvider implements vscode.TreeDataProvider<CollectionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CollectionTreeItem | undefined | void> = new vscode.EventEmitter<CollectionTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CollectionTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private dataManager: DataManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CollectionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CollectionTreeItem): Thenable<CollectionTreeItem[]> {
        if (!element) {
            // Root level: Templates folder + Collections
            const items: CollectionTreeItem[] = [];
            
            // Templates Folder (Always first)
            items.push(new CollectionTreeItem('🧩 Templates', vscode.TreeItemCollapsibleState.Collapsed, 'Templates', undefined, true));
            
            // Other Collections
            const collections = this.dataManager.getCollections();
            Object.keys(collections).filter(name => name !== 'Templates').sort().forEach(name => {
                items.push(new CollectionTreeItem(name, vscode.TreeItemCollapsibleState.Collapsed, name));
            });
            
            return Promise.resolve(items);
        }
        
        if (element.collectionName) {
            // Inside a collection/template folder
            const collections = this.dataManager.getCollections();
            const requests = collections[element.collectionName] || [];
            return Promise.resolve(requests.map(req => new CollectionTreeItem(req.name, vscode.TreeItemCollapsibleState.None, element.collectionName, req)));
        }

        return Promise.resolve([]);
    }
}
