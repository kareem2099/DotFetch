import * as vscode from 'vscode';

/**
 * Logger utility for DotFetch extension
 * Uses VSCode output channel for clean logging
 * Set isDevelopment to false in production to avoid performance overhead
 */
class Logger {
  private outputChannel: vscode.OutputChannel;
  private isDevelopment: boolean = false; // Set to false for production

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('DotFetch');
  }

  /**
   * Log informational message
   * Only outputs if isDevelopment is true
   */
  log(message: string, data?: any): void {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    const logMessage = data ? `[${timestamp}] [INFO] ${message} ${JSON.stringify(data)}` : `[${timestamp}] [INFO] ${message}`;
    this.outputChannel.appendLine(logMessage);
  }

  /**
   * Log warning message
   * Only outputs if isDevelopment is true
   */
  warn(message: string, data?: any): void {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    const logMessage = data ? `[${timestamp}] [WARN] ${message} ${JSON.stringify(data)}` : `[${timestamp}] [WARN] ${message}`;
    this.outputChannel.appendLine(logMessage);
  }

  /**
   * Log error message
   * Only outputs if isDevelopment is true
   */
  error(message: string, error?: any): void {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
    const logMessage = error ? `[${timestamp}] [ERROR] ${message} - ${errorStr}` : `[${timestamp}] [ERROR] ${message}`;
    this.outputChannel.appendLine(logMessage);
  }

  /**
   * Show output channel to user
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Set development mode (true = log all messages, false = no logging for production)
   */
  setDevelopment(isDev: boolean): void {
    this.isDevelopment = isDev;
  }

  /**
   * Get current development mode status
   */
  isDev(): boolean {
    return this.isDevelopment;
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Dispose of output channel (cleanup)
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

// Export singleton instance
export const logger = new Logger();
