import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface EnvironmentVariables {
	[key: string]: string;
}

export interface Environment {
	name: string;
	fileName: string;
	filePath: string;
	variables: EnvironmentVariables;
}

export class EnvironmentManager {
	private environments: Environment[] = [];
	private watchers: vscode.FileSystemWatcher[] = [];
	private onEnvironmentsChanged?: (environments: Environment[]) => void;

	constructor() {
		this.loadEnvironments();
		this.setupFileWatchers();
	}

	private getWorkspacePath(): string | null {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		return workspaceFolder?.uri.fsPath || null;
	}

	private loadEnvironments(): void {
		const workspacePath = this.getWorkspacePath();
		if (!workspacePath) {return;}

		const newEnvironments: Environment[] = [];
		const envFiles = this.findEnvironmentFiles(workspacePath);

		for (const envFile of envFiles) {
			try {
				const variables = this.parseEnvironmentFile(envFile);
				const fileName = path.basename(envFile);
				const name = this.getEnvironmentName(fileName);

				newEnvironments.push({
					name,
					fileName,
					filePath: envFile,
					variables
				});
			} catch (error) {
				console.warn(`Failed to parse environment file ${envFile}:`, error);
			}
		}

		this.environments = newEnvironments;
	}

	private findEnvironmentFiles(workspacePath: string): string[] {
		const files: string[] = [];

		// Common environment file patterns
		const patterns = [
			'.env',
			'.env.local',
			'.env.development',
			'.env.staging',
			'.env.production',
			'.env.test'
		];

		for (const pattern of patterns) {
			const filePath = path.join(workspacePath, pattern);
			if (fs.existsSync(filePath)) {
				files.push(filePath);
			}
		}

		return files;
	}

	private parseEnvironmentFile(filePath: string): EnvironmentVariables {
		const content = fs.readFileSync(filePath, 'utf8');
		const variables: EnvironmentVariables = {};

		const lines = content.split('\n');
		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			// Parse key=value pairs
			const equalIndex = trimmed.indexOf('=');
			if (equalIndex > 0) {
				const key = trimmed.substring(0, equalIndex).trim();
				let value = trimmed.substring(equalIndex + 1).trim();

				// Remove surrounding quotes if present
				if ((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))) {
					value = value.substring(1, value.length - 1);
				}

				variables[key] = value;
			}
		}

		return variables;
	}

	private getEnvironmentName(fileName: string): string {
		switch (fileName) {
			case '.env':
				return 'default';  // Base environment file
			case '.env.local':
				return 'local';    // Local development overrides
			case '.env.development':
				return 'development';
			case '.env.production':
				return 'production';
			case '.env.staging':
				return 'staging';
			case '.env.test':
				return 'test';
			default:
				// For unknown .env.* patterns, extract the suffix
				if (fileName.startsWith('.env.')) {
					return fileName.substring(5); // Remove '.env.' prefix
				}
				return fileName; // Fallback
		}
	}

	private setupFileWatchers(): void {
		// Clean up existing watchers
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers = [];

		const workspacePath = this.getWorkspacePath();
		if (!workspacePath) {return;}

		// Watch for environment file changes
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(workspacePath, '.env*'),
			false, // Don't ignore creates
			false, // Don't ignore changes
			false  // Don't ignore deletes
		);

		watcher.onDidChange(() => this.reloadEnvironments());
		watcher.onDidCreate(() => this.reloadEnvironments());
		watcher.onDidDelete(() => this.reloadEnvironments());

		this.watchers.push(watcher);
	}

	private reloadEnvironments(): void {
		this.loadEnvironments();
		this.onEnvironmentsChanged?.(this.environments);
	}

	public getEnvironments(): Environment[] {
		return [...this.environments];
	}

	public getEnvironmentByName(name: string): Environment | undefined {
		return this.environments.find(env => env.name === name);
	}

	public substituteVariables(text: string | null | undefined, environmentName: string): string | null {
		if (text === null) {return null;}
		if (typeof text !== 'string') {return String(text);}

		const environment = this.getEnvironmentByName(environmentName);
		if (!environment) {return text;}

		// Replace {{VAR_NAME}} patterns
		return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
			const trimmedVarName = varName.trim();
			return environment.variables[trimmedVarName] || match;
		});
	}

	public validateVariables(text: string | null | undefined, environmentName: string): { valid: boolean; missing: string[] } {
		if (text === null || typeof text !== 'string') {
			return { valid: true, missing: [] };
		}

		const environment = this.getEnvironmentByName(environmentName);
		if (!environment) {return { valid: true, missing: [] };}

		const missing: string[] = [];
		const matches = text.match(/\{\{([^}]+)\}\}/g);

		if (matches) {
			const uniqueVars = new Set<string>();
			for (const match of matches) {
				const varName = match.substring(2, match.length - 2).trim();
				if (!uniqueVars.has(varName)) {
					uniqueVars.add(varName);
					if (!(varName in environment.variables)) {
						missing.push(varName);
					}
				}
			}
		}

		return { valid: missing.length === 0, missing };
	}

	public setEnvironmentsChangedCallback(callback: (environments: Environment[]) => void): void {
		this.onEnvironmentsChanged = callback;
	}

	public dispose(): void {
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers = [];
	}
}
