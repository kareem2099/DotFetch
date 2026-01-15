import * as vscode from 'vscode';
import { EnvironmentManager, Environment } from './environmentManager';

export class EnvironmentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly environment?: Environment,
        public readonly variableName?: string,
        public readonly variableValue?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();

        // Add command for variable items to copy value
        if (variableName && variableValue) {
            this.command = {
                command: 'dotfetch.copyVariable',
                title: 'Copy Variable Value',
                arguments: [variableName, variableValue]
            };
        }
    }

    private getTooltip(): string {
        if (this.variableName && this.variableValue) {
            return `${this.variableName}: ${this.variableValue}`;
        }
        if (this.environment) {
            const varCount = Object.keys(this.environment.variables).length;
            return `${this.environment.name} (${varCount} variables)\n${this.environment.filePath}`;
        }
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.variableName) {
            return new vscode.ThemeIcon('symbol-variable');
        }
        if (this.environment) {
            return new vscode.ThemeIcon('file');
        }
        return new vscode.ThemeIcon('folder');
    }

    private getContextValue(): string {
        if (this.variableName) {
            return 'environmentVariable';
        }
        if (this.environment) {
            return 'environmentFile';
        }
        return 'environmentRoot';
    }
}

export class EnvironmentVariablesProvider implements vscode.TreeDataProvider<EnvironmentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EnvironmentTreeItem | undefined | void> = new vscode.EventEmitter<EnvironmentTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<EnvironmentTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private environmentManager: EnvironmentManager) {
        // Listen for environment changes
        this.environmentManager.setEnvironmentsChangedCallback(() => {
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EnvironmentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EnvironmentTreeItem): Thenable<EnvironmentTreeItem[]> {
        if (!element) {
            // Root level - show all environments
            return this.getEnvironments();
        }

        if (element.environment) {
            // Environment level - show variables
            return this.getEnvironmentVariables(element.environment);
        }

        return Promise.resolve([]);
    }

    private async getEnvironments(): Promise<EnvironmentTreeItem[]> {
        const environments = this.environmentManager.getEnvironments();
        const items: EnvironmentTreeItem[] = [];

        // Group environments by type (might be useful for sorting/filtering)
        const grouped = environments.reduce((acc, env) => {
            const type = env.name === 'default' ? 'default' : 'other';
            if (!acc[type]) {acc[type] = [];}
            acc[type].push(env);
            return acc;
        }, {} as Record<string, Environment[]>);

        // Add default environment first
        if (grouped.default && grouped.default.length > 0) {
            grouped.default.forEach(env => {
                items.push(new EnvironmentTreeItem(
                    `Default Environment (${Object.keys(env.variables).length} vars)`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    env
                ));
            });
        }

        // Add other environments
        if (grouped.other && grouped.other.length > 0) {
            grouped.other.forEach(env => {
                const varCount = Object.keys(env.variables).length;
                const label = `${env.name.charAt(0).toUpperCase() + env.name.slice(1)} (${varCount} vars)`;
                items.push(new EnvironmentTreeItem(
                    label,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    env
                ));
            });
        }

        return items;
    }

    private async getEnvironmentVariables(environment: Environment): Promise<EnvironmentTreeItem[]> {
        const items: EnvironmentTreeItem[] = [];

        // Get variable entries and sort them
        const variables = Object.entries(environment.variables).sort(([a], [b]) => a.localeCompare(b));

        variables.forEach(([name, value]) => {
            // Truncate long values for display
            const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;

            const item = new EnvironmentTreeItem(
                `${name}: ${displayValue}`,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                name,
                value
            );

            // Set description to show the value again (VS Code shows this next to label)
            item.description = value;
            item.tooltip = `${name}: ${value}`;

            items.push(item);
        });

        return items;
    }
}
