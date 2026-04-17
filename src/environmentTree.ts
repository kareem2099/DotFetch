import * as vscode from 'vscode';
import { EnvironmentManager, Environment } from './environmentManager';

export class EnvironmentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly environment?: Environment,
        public readonly variableName?: string,
        public readonly variableValue?: string,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);

        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();

        // Add command for variable items to copy value
        if (variableName && variableValue) {
            this.command = command || {
                command: 'dotfetch.copyVariable',
                title: 'Copy Variable Value',
                arguments: [variableName, variableValue]
            };
        } else if (environment) {
            // Add command to open environment file
            this.command = {
                command: 'dotfetch.openEnvironmentFile',
                title: 'Open Environment File',
                arguments: [environment.filePath]
            };
        } else if (command) {
            this.command = command;
        }
    }

    private getTooltip(): string | vscode.MarkdownString {
        if (this.variableName && this.variableValue) {
            // Use MarkdownString for better formatting
            const tooltip = new vscode.MarkdownString();
            tooltip.appendMarkdown(`**Variable:** \`${this.variableName}\`\n\n`);
            tooltip.appendMarkdown('**Value:**\n');
            tooltip.appendCodeblock(this.variableValue, 'text');
            tooltip.appendMarkdown('\n\n*Click to copy*');
            tooltip.isTrusted = true;
            return tooltip;
        }
        
        if (this.environment) {
            const varCount = Object.keys(this.environment.variables).length;
            const tooltip = new vscode.MarkdownString();
            tooltip.appendMarkdown(`**${this.environment.name}**\n\n`);
            tooltip.appendMarkdown(`📊 Variables: **${varCount}**\n\n`);
            tooltip.appendMarkdown(`📁 File: \`${this.environment.filePath}\`\n\n`);
            tooltip.appendMarkdown('*Click to open file*');
            tooltip.isTrusted = true;
            return tooltip;
        }
        
        return this.label;
    }

    private getIcon(): vscode.ThemeIcon {
        if (this.variableName) {
            return new vscode.ThemeIcon('symbol-variable', new vscode.ThemeColor('symbolIcon.variableForeground'));
        }
        if (this.environment) {
            // Different icons for different environments
            const envName = this.environment.name.toLowerCase();
            
            if (envName === 'default' || envName === '.env') {
                return new vscode.ThemeIcon('file-code');
            } else if (envName.includes('prod')) {
                return new vscode.ThemeIcon('lock', new vscode.ThemeColor('errorForeground'));
            } else if (envName.includes('dev')) {
                return new vscode.ThemeIcon('beaker', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
            } else if (envName.includes('staging') || envName.includes('stage')) {
                return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('notificationsWarningIcon.foreground'));
            } else if (envName.includes('test')) {
                return new vscode.ThemeIcon('flask', new vscode.ThemeColor('testing.iconPassed'));
            }
            return new vscode.ThemeIcon('file');
        }
        return new vscode.ThemeIcon('folder-opened');
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
    private static readonly MAX_LABEL_LENGTH = 50;
    private static readonly MAX_DESCRIPTION_LENGTH = 30;
    private static readonly TRUNCATE_SUFFIX = '...';

    private _onDidChangeTreeData: vscode.EventEmitter<EnvironmentTreeItem | undefined | void> = 
        new vscode.EventEmitter<EnvironmentTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<EnvironmentTreeItem | undefined | void> = 
        this._onDidChangeTreeData.event;

    private expansionState: Map<string, boolean> = new Map();

    constructor(private environmentManager: EnvironmentManager) {
        // Listen for environment changes
        this.environmentManager.addEnvironmentsChangedCallback(() => {
            this.refresh();
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

        // Check if no environments found
        if (environments.length === 0) {
            const emptyItem = new EnvironmentTreeItem(
                'No .env files found',
                vscode.TreeItemCollapsibleState.None
            );
            emptyItem.description = 'Create a .env file in your workspace';
            emptyItem.iconPath = new vscode.ThemeIcon('info');
            emptyItem.contextValue = 'empty';
            return [emptyItem];
        }

        // Sort environments: default first, then alphabetically
        const sortedEnvironments = environments.sort((a, b) => {
            if (a.name === 'default') { return -1; }
            if (b.name === 'default') { return 1; }
            return a.name.localeCompare(b.name);
        });

        // Create tree items
        const activeEnv = this.environmentManager.getActiveEnvironment();
        
        // Add "No Environment" option
        const noEnvIsActive = activeEnv === 'none';
        const noEnvItem = new EnvironmentTreeItem(
            noEnvIsActive ? '✓ No Environment' : 'No Environment',
            vscode.TreeItemCollapsibleState.None,
            undefined, // No environment
            undefined, // No variableName
            undefined, // No variableValue
            {
                command: 'dotfetch.clearActiveEnvironment',
                title: 'Clear Active Environment'
            }
        );
        noEnvItem.description = noEnvIsActive ? 'Active' : 'Clear active environment';
        noEnvItem.contextValue = noEnvIsActive ? 'environmentClearActive' : 'environmentClear';
        noEnvItem.iconPath = noEnvIsActive 
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'))
            : new vscode.ThemeIcon('circle-slash');
        items.push(noEnvItem);

        sortedEnvironments.forEach(env => {
            const varCount = Object.keys(env.variables).length;
            const isActive = env.name === activeEnv;
            
            // Create label
            let label = env.name;
            if (isActive) {
                label = `✓ ${env.name}`;
            }

            // Determine expansion state
            let collapsibleState: vscode.TreeItemCollapsibleState;
            if (varCount === 0) {
                collapsibleState = vscode.TreeItemCollapsibleState.None;
            } else {
                const isExpanded = this.expansionState.get(env.name) ?? false;
                collapsibleState = isExpanded 
                    ? vscode.TreeItemCollapsibleState.Expanded 
                    : vscode.TreeItemCollapsibleState.Collapsed;
            }

            const item = new EnvironmentTreeItem(label, collapsibleState, env);
            item.description = isActive ? 'Active' : (varCount === 1 ? '1 var' : `${varCount} vars`);
            item.contextValue = isActive ? 'environmentFileActive' : 'environmentFile';
            
            if (isActive) {
                item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            }

            items.push(item);
        });

        return items;
    }

    private async getEnvironmentVariables(environment: Environment): Promise<EnvironmentTreeItem[]> {
        const items: EnvironmentTreeItem[] = [];

        // Get variable entries and sort them alphabetically
        const variables = Object.entries(environment.variables)
            .sort(([a], [b]) => a.localeCompare(b));

        // Check if environment has no variables
        if (variables.length === 0) {
            const emptyItem = new EnvironmentTreeItem(
                'No variables defined',
                vscode.TreeItemCollapsibleState.None
            );
            emptyItem.iconPath = new vscode.ThemeIcon('warning');
            emptyItem.contextValue = 'emptyEnvironment';
            return [emptyItem];
        }

        variables.forEach(([name, value]) => {
            // Truncate long values for display in label
            const displayValue = this.truncateValue(value, EnvironmentVariablesProvider.MAX_LABEL_LENGTH);

            const item = new EnvironmentTreeItem(
                `${name}: ${displayValue}`,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                name,
                value
            );

            // Only add description if value is long (show character count)
            if (value.length > EnvironmentVariablesProvider.MAX_LABEL_LENGTH) {
                item.description = `(${value.length} chars)`;
            }

            items.push(item);
        });

        return items;
    }

    private truncateValue(value: string, maxLength: number): string {
        if (value.length <= maxLength) {
            return value;
        }
        const truncateLength = maxLength - EnvironmentVariablesProvider.TRUNCATE_SUFFIX.length;
        return value.substring(0, truncateLength) + EnvironmentVariablesProvider.TRUNCATE_SUFFIX;
    }

    /**
     * Set expansion state for an environment
     */
    public setExpanded(envName: string, expanded: boolean): void {
        this.expansionState.set(envName, expanded);
    }

    /**
     * Get expansion state for an environment
     */
    public isExpanded(envName: string): boolean {
        return this.expansionState.get(envName) ?? false;
    }

    /**
     * Get total count of all variables across all environments
     */
    public getTotalVariableCount(): number {
        const environments = this.environmentManager.getEnvironments();
        return environments.reduce((total, env) => {
            return total + Object.keys(env.variables).length;
        }, 0);
    }

    /**
     * Search for a variable by name across all environments
     */
    public async findVariable(variableName: string): Promise<{env: string, value: string}[]> {
        const environments = this.environmentManager.getEnvironments();
        const results: {env: string, value: string}[] = [];

        environments.forEach(env => {
            // FIXED: Use 'in' operator to check for key existence (handles empty strings)
            if (variableName in env.variables) {
                results.push({
                    env: env.name,
                    value: env.variables[variableName]
                });
            }
        });

        return results;
    }

    /**
     * Get all unique variable names across all environments
     */
    public getUniqueVariableNames(): string[] {
        const environments = this.environmentManager.getEnvironments();
        const nameSet = new Set<string>();

        environments.forEach(env => {
            Object.keys(env.variables).forEach(name => nameSet.add(name));
        });

        return Array.from(nameSet).sort();
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this._onDidChangeTreeData.dispose();
    }
}