import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';

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
	private static readonly DEBOUNCE_DELAY = 300; // milliseconds
	private static readonly MAX_SUBSTITUTION_ITERATIONS = 10;
	
	private environments: Environment[] = [];
	private watchers: vscode.FileSystemWatcher[] = [];
	private callbacks: Array<(environments: Environment[]) => void> = [];
	private reloadTimeout?: NodeJS.Timeout;
	private isReloading = false;

	constructor() {
		this.loadEnvironments();
		this.setupFileWatchers();
	}

	private log(message: string): void {
		logger.log(message);
	}

	private logError(message: string, error?: any): void {
		logger.error(message, error);
	}

	private getWorkspacePath(): string | null {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		return workspaceFolder?.uri.fsPath || null;
	}

	private loadEnvironments(): void {
		const workspacePath = this.getWorkspacePath();
		if (!workspacePath) {
			this.environments = [];
			return;
		}

		const newEnvironments: Environment[] = [];
		const envFiles = this.findEnvironmentFiles(workspacePath);

		this.log(`Found ${envFiles.length} environment file(s)`);

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

				this.log(`Loaded ${name}: ${Object.keys(variables).length} variables`);
			} catch (error) {
				this.logError(`Failed to load ${envFile}`, error);
			}
		}

		this.environments = newEnvironments;
	}

	private findEnvironmentFiles(workspacePath: string): string[] {
		const files: string[] = [];

		try {
			// Find all files starting with .env
			const allFiles = fs.readdirSync(workspacePath);
			const envFiles = allFiles.filter(file => {
				// Must start with .env
				if (!file.startsWith('.env')) {
					return false;
				}
				
				// Ignore common non-environment files
				const ignorePatterns = [
					'.swp',      // Vim swap files
					'.bak',      // Backup files
					'~',         // Temp files
					'.example',  // Example files
					'.sample',   // Sample files
					'.template', // Template files
					'.schema',   // Schema files
					'.lock',     // Lock files
				];
				
				return !ignorePatterns.some(pattern => file.endsWith(pattern));
			});

			envFiles.forEach(file => {
				const filePath = path.join(workspacePath, file);
				try {
					const stats = fs.statSync(filePath);
					if (stats.isFile()) {
						files.push(filePath);
					}
				} catch (error) {
					this.logError(`Could not stat file ${file}`, error);
				}
			});

			// Sort for consistent ordering
			files.sort();
		} catch (error) {
			this.logError('Error finding environment files', error);
		}

		return files;
	}

	private parseEnvironmentFile(filePath: string): EnvironmentVariables {
		try {
			// Check if file still exists
			if (!fs.existsSync(filePath)) {
				this.log(`File no longer exists: ${path.basename(filePath)}`);
				return {};
			}

			const content = fs.readFileSync(filePath, 'utf8');
			const variables: EnvironmentVariables = {};

			const lines = content.split('\n');
			let currentKey: string | null = null;
			let currentValue = '';
			let inMultiline = false;
			let multilineQuote: string | null = null;

			for (let i = 0; i < lines.length; i++) {
				let line = lines[i];
				
				// Handle multiline values
				if (inMultiline) {
					currentValue += '\n' + line;
					
					// Check if line ends with the matching quote (unescaped)
					const trimmedLine = line.trim();
					if (trimmedLine.endsWith(multilineQuote!) && 
					    !trimmedLine.endsWith('\\' + multilineQuote!)) {
						inMultiline = false;
						if (currentKey) {
							variables[currentKey] = this.processValue(currentValue.trim());
						}
						currentKey = null;
						currentValue = '';
						multilineQuote = null;
					}
					continue;
				}

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

					// Validate key (must be valid variable name)
					if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
						this.log(`Invalid variable name: "${key}" in ${path.basename(filePath)}`);
						continue;
					}

					// Check for multiline start (quoted value that doesn't close)
					if (value.length > 0 && (value[0] === '"' || value[0] === "'")) {
						const quoteChar = value[0];
						let escaped = false;
						let quoteCount = 0;
						
						for (let j = 0; j < value.length; j++) {
							if (value[j] === '\\' && !escaped) {
								escaped = true;
								continue;
							}
							if (value[j] === quoteChar && !escaped) {
								quoteCount++;
							}
							escaped = false;
						}
						
						// If we have odd number of quotes, it's multiline
						if (quoteCount === 1) {
							inMultiline = true;
							multilineQuote = quoteChar;
							currentKey = key;
							currentValue = value;
							continue;
						}
					}

					variables[key] = this.processValue(value);
				}
			}

			// Handle unclosed multiline at end of file
			if (inMultiline && currentKey) {
				this.log(`Unclosed multiline value for "${currentKey}" in ${path.basename(filePath)}`);
				variables[currentKey] = this.processValue(currentValue.trim());
			}

			return variables;

		} catch (error) {
			if (error instanceof Error) {
				if (error.message.includes('ENOENT')) {
					this.log(`File not found: ${path.basename(filePath)}`);
				} else if (error.message.includes('EACCES')) {
					this.logError(`Permission denied reading ${path.basename(filePath)}`, error);
					vscode.window.showErrorMessage(`Permission denied: ${path.basename(filePath)}`);
				} else {
					this.logError(`Failed to parse ${path.basename(filePath)}`, error);
					vscode.window.showErrorMessage(
						`Failed to read ${path.basename(filePath)}: ${error.message}`
					);
				}
			}
			return {};
		}
	}

	private processValue(value: string): string {
		// Remove surrounding quotes if present
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			value = value.substring(1, value.length - 1);
			
			// Handle escape sequences (single-pass replacement)
			if (value.includes('\\')) {
				value = value.replace(/\\(.)/g, (match, char) => {
					switch (char) {
						case 'n': return '\n';
						case 'r': return '\r';
						case 't': return '\t';
						case '\\': return '\\';
						case '"': return '"';
						case "'": return "'";
						default: return match; // Keep unknown escapes as-is
					}
				});
			}
		}

		return value;
	}

	private getEnvironmentName(fileName: string): string {
		// .env -> default
		if (fileName === '.env') {
			return 'default';
		}

		// .env.local -> local
		if (fileName === '.env.local') {
			return 'local';
		}

		// .env.{name}.local -> {name}-local
		// .env.{name} -> {name}
		if (fileName.startsWith('.env.')) {
			const suffix = fileName.substring(5); // Remove '.env.'
			const hasLocal = suffix.endsWith('.local');
			const baseName = hasLocal ? suffix.substring(0, suffix.length - 6) : suffix;
			
			// Handle common patterns (case-insensitive)
			const mapping: {[key: string]: string} = {
				'development': 'development',
				'dev': 'development',
				'production': 'production',
				'prod': 'production',
				'staging': 'staging',
				'stage': 'staging',
				'test': 'test',
				'testing': 'test'
			};

			const normalizedBase = baseName.toLowerCase();
			const mapped = mapping[normalizedBase] || baseName;
			
			return hasLocal ? `${mapped}-local` : mapped;
		}

		return fileName;
	}

	private setupFileWatchers(): void {
		// Clean up existing watchers
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers = [];

		const workspacePath = this.getWorkspacePath();
		if (!workspacePath) { return; }

		// Debounced reload function
		const debouncedReload = () => {
			if (this.reloadTimeout) {
				clearTimeout(this.reloadTimeout);
			}
			this.reloadTimeout = setTimeout(() => {
				this.log('Reloading environments...');
				this.reloadEnvironments();
			}, EnvironmentManager.DEBOUNCE_DELAY);
		};

		// Watch for environment file changes
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(workspacePath, '.env*'),
			false, // Don't ignore creates
			false, // Don't ignore changes
			false  // Don't ignore deletes
		);

		watcher.onDidChange(uri => {
			this.log(`File changed: ${path.basename(uri.fsPath)}`);
			debouncedReload();
		});
		
		watcher.onDidCreate(uri => {
			this.log(`File created: ${path.basename(uri.fsPath)}`);
			debouncedReload();
		});
		
		watcher.onDidDelete(uri => {
			this.log(`File deleted: ${path.basename(uri.fsPath)}`);
			debouncedReload();
		});

		this.watchers.push(watcher);
	}

	private reloadEnvironments(): void {
		// Prevent concurrent reloads
		if (this.isReloading) {
			this.log('Reload already in progress, skipping...');
			return;
		}

		this.isReloading = true;
		
		try {
			this.loadEnvironments();
			
			// Notify all callbacks (make a copy to avoid modification during iteration)
			const callbacksCopy = [...this.callbacks];
			callbacksCopy.forEach(callback => {
				try {
					callback(this.environments);
				} catch (error) {
					this.logError('Callback error', error);
				}
			});
		} finally {
			this.isReloading = false;
		}
	}

	public getEnvironments(): Environment[] {
		return [...this.environments];
	}

	public getEnvironmentByName(name: string): Environment | undefined {
		return this.environments.find(env => env.name === name);
	}

	public substituteVariables(
		text: string | null | undefined, 
		environmentName: string
	): string {
		// Always return string, never null
		if (text === null || text === undefined || text === '') {
			return '';
		}

		if (typeof text !== 'string') {
			return String(text);
		}

		const environment = this.getEnvironmentByName(environmentName);
		if (!environment) {
			return text;
		}

		// Replace {{VAR_NAME}} patterns
		let result = text;
		let iterations = 0;
		const substitutionHistory: string[] = [];

		// Keep replacing until no more variables found (supports nested variables)
		while (iterations < EnvironmentManager.MAX_SUBSTITUTION_ITERATIONS) {
			const before = result;
			
			// Check for circular reference
			if (substitutionHistory.includes(result)) {
				this.log(`Circular reference detected in variable substitution: ${text}`);
				break;
			}
			substitutionHistory.push(result);
			
			result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
				const trimmedVarName = varName.trim();
				const value = environment.variables[trimmedVarName];
				return value !== undefined ? value : match;
			});
			
			if (result === before) {
				break; // No more substitutions
			}
			iterations++;
		}

		if (iterations >= EnvironmentManager.MAX_SUBSTITUTION_ITERATIONS) {
			this.log(`Max iterations reached in variable substitution (possible circular reference): ${text}`);
		}

		return result;
	}

	public validateVariables(
		text: string | null | undefined, 
		environmentName: string
	): { valid: boolean; missing: string[] } {
		if (text === null || typeof text !== 'string' || text === '') {
			return { valid: true, missing: [] };
		}

		const environment = this.getEnvironmentByName(environmentName);
		if (!environment) {
			return { valid: true, missing: [] };
		}

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

	/**
	 * Add a callback to be notified when environments change
	 */
	public addEnvironmentsChangedCallback(
		callback: (environments: Environment[]) => void
	): void {
		// Prevent duplicate callbacks
		if (!this.callbacks.includes(callback)) {
			this.callbacks.push(callback);
		}
	}

	/**
	 * Remove a callback
	 */
	public removeEnvironmentsChangedCallback(
		callback: (environments: Environment[]) => void
	): void {
		const index = this.callbacks.indexOf(callback);
		if (index > -1) {
			this.callbacks.splice(index, 1);
		}
	}

	/**
	 * Get all unique variable names across all environments
	 */
	public getAllVariableNames(): Set<string> {
		const names = new Set<string>();
		this.environments.forEach(env => {
			Object.keys(env.variables).forEach(name => names.add(name));
		});
		return names;
	}

	/**
	 * Check if a variable exists in any environment
	 */
	public hasVariable(variableName: string): boolean {
		return this.environments.some(env => variableName in env.variables);
	}

	/**
	 * Get variable value from a specific environment
	 */
	public getVariable(environmentName: string, variableName: string): string | undefined {
		const env = this.getEnvironmentByName(environmentName);
		return env?.variables[variableName];
	}

	public dispose(): void {
		this.log('Disposing...');
		
		if (this.reloadTimeout) {
			clearTimeout(this.reloadTimeout);
		}
		
		this.watchers.forEach(watcher => watcher.dispose());
		this.watchers = [];
		this.callbacks = [];
		this.environments = [];
	}
}