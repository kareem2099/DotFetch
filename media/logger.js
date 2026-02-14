/**
 * Logger utility for DotFetch webview
 * Set isDevelopment to false in production to avoid performance overhead
 */
class WebViewLogger {
  constructor() {
    this.isDevelopment = false; // Set to false for production
  }

  /**
   * Log informational message
   * Only outputs if isDevelopment is true
   */
  log(message, data = null) {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    if (data) {
      console.log(`[${timestamp}] [INFO] [DotFetch] ${message}`, data);
    } else {
      console.log(`[${timestamp}] [INFO] [DotFetch] ${message}`);
    }
  }

  /**
   * Log warning message
   * Only outputs if isDevelopment is true
   */
  warn(message, data = null) {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    if (data) {
      console.warn(`[${timestamp}] [WARN] [DotFetch] ${message}`, data);
    } else {
      console.warn(`[${timestamp}] [WARN] [DotFetch] ${message}`);
    }
  }

  /**
   * Log error message
   * Only outputs if isDevelopment is true
   */
  error(message, error = null) {
    if (!this.isDevelopment) {return;}
    const timestamp = new Date().toISOString();
    if (error) {
      const errorStr = error instanceof Error ? error.message : JSON.stringify(error);
      console.error(`[${timestamp}] [ERROR] [DotFetch] ${message} - ${errorStr}`);
    } else {
      console.error(`[${timestamp}] [ERROR] [DotFetch] ${message}`);
    }
  }

  /**
   * Set development mode (true = log all messages, false = no logging for production)
   */
  setDevelopment(isDev) {
    this.isDevelopment = isDev;
  }

  /**
   * Get current development mode status
   */
  isDev() {
    return this.isDevelopment;
  }
}

// Export singleton instance
const logger = new WebViewLogger();
