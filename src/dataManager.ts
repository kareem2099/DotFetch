import * as vscode from 'vscode';

export interface RequestData {
    id: string;
    name: string;
    method: string;
    url: string;
    headers: string;
    headerRows?: any[];
    body: string;
    notes?: string;
    queryParams?: any[];
    auth?: any;
    createdAt: string;
    lastUsedAt?: string;
    usageCount?: number;
    status?: number;
    duration?: number;
    retryCount?: number;
    timeout?: number;
    sslVerify?: boolean;
}

export interface Collection {
    id: string;
    name: string;
    requests: RequestData[];
    folders?: Collection[];
}

export interface DotFetchState {
    history: RequestData[];
    collections: { [key: string]: RequestData[] };
    favorites: string[]; // IDs of pinned requests
}

export class DataManager {
    private static readonly STATE_KEY = 'dotfetch';
    private state: DotFetchState;

    constructor(private context: vscode.ExtensionContext) {
        this.state = this.context.globalState.get<DotFetchState>(DataManager.STATE_KEY, {
            history: [],
            collections: { 'Templates': [] },
            favorites: []
        });

        // Fallback for older states that might be missing these
        if (!this.state.favorites) {this.state.favorites = [];}
        if (!this.state.history) {this.state.history = [];}
        if (!this.state.collections) {this.state.collections = { 'Templates': [] };}
    }

    // --- History ---

    getHistory(): RequestData[] {
        return this.state.history;
    }

    async addHistory(request: RequestData) {
        const maxHistory = vscode.workspace.getConfiguration('dotfetch').get<number>('maxHistory', 50);
        this.state.history.unshift(request);
        if (this.state.history.length > maxHistory) {
            this.state.history = this.state.history.slice(0, maxHistory);
        }
        await this.save();
    }

    async clearHistory() {
        this.state.history = [];
        await this.save();
    }

    // --- Collections ---

    getCollections(): { [key: string]: RequestData[] } {
        return this.state.collections;
    }

    async createCollection(name: string) {
        if (!this.state.collections[name]) {
            this.state.collections[name] = [];
            await this.save();
        }
    }

    async deleteCollection(name: string) {
        delete this.state.collections[name];
        await this.save();
    }

    async saveToCollection(collectionName: string, request: RequestData) {
        if (!this.state.collections[collectionName]) {
            this.state.collections[collectionName] = [];
        }
        
        // Update if existing (by ID or Name)
        const index = this.state.collections[collectionName].findIndex(r => r.id === request.id || r.name === request.name);
        if (index !== -1) {
            this.state.collections[collectionName][index] = request;
        } else {
            this.state.collections[collectionName].push(request);
        }
        await this.save();
    }

    async removeFromCollection(collectionName: string, requestId: string) {
        if (this.state.collections[collectionName]) {
            this.state.collections[collectionName] = this.state.collections[collectionName].filter(r => r.id !== requestId);
            await this.save();
        }
    }

    async duplicateRequest(collectionName: string, requestId: string) {
        if (!this.state.collections[collectionName]) { return; }
        const original = this.state.collections[collectionName].find(r => r.id === requestId);
        if (!original) { return; }

        const duplicate: RequestData = {
            ...original,
            id: Date.now().toString(),
            name: `${original.name || 'Request'} (Copy)`,
            createdAt: new Date().toISOString()
        };

        this.state.collections[collectionName].push(duplicate);
        await this.save();
    }

    // --- Favorites ---

    getFavorites(): RequestData[] {
        const favorites: RequestData[] = [];
        // Search in all collections and history? 
        // Actually, let's just store the full request data in favorites for simplicity 
        // or a reference. Reference is better but harder to manage if source is deleted.
        // For now, let's just use IDs and search.
        const allRequests = [
            ...this.state.history,
            ...Object.values(this.state.collections).flat()
        ];
        
        return this.state.favorites.map(id => allRequests.find(r => r.id === id)).filter(Boolean) as RequestData[];
    }

    async toggleFavorite(requestId: string) {
        const index = this.state.favorites.indexOf(requestId);
        if (index !== -1) {
            this.state.favorites.splice(index, 1);
        } else {
            this.state.favorites.push(requestId);
        }
        await this.save();
    }

    // --- Templates ---

    getTemplates(): RequestData[] {
        return this.state.collections['Templates'] || [];
    }

    // --- Persistence ---

    private async save() {
        await this.context.globalState.update(DataManager.STATE_KEY, this.state);
        // Notify any listeners (TreeDataProviders)
        vscode.commands.executeCommand('dotfetch.refreshAllTrees');
    }

    // Migration from old state structure if necessary
    async migrate(oldState: any) {
        if (oldState && oldState.collections && !this.state.collections['Templates']) {
            // Merge logic...
        }
    }
}
