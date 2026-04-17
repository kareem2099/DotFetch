import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import { EnvironmentManager } from './environmentManager';
import { logger } from './logger';

export class RequestService {
    private abortController?: AbortController;
    private static readonly DEFAULT_TIMEOUT = 10000;
    private static readonly MAX_TIMEOUT = 300000;
    private static readonly MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
    private static readonly DISPLAY_THRESHOLD = 1024 * 1024; // 1MB

    constructor(private environmentManager: EnvironmentManager) {}

    public cancelRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = undefined;
            logger.log('Request cancelled');
        }
    }

    public async execute(message: any, webview: vscode.Webview) {
        const startTime = Date.now();
        const maxRetries = Math.min(Math.max(parseInt(message.retryCount) || 0, 0), 5);
        const retryableCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNABORTED'];

        this.cancelRequest();

        try {
            const selectedEnvironment = message.environment || 'none';

            if (!message.url || message.url.trim() === '') {
                webview.postMessage({ type: 'error', error: 'URL is required', duration: 0 });
                return;
            }

            let substitutedUrl = this.environmentManager.substituteVariables(message.url.trim(), selectedEnvironment);

            try {
                const urlObj = new URL(substitutedUrl);
                if (!['http:', 'https:'].includes(urlObj.protocol)) {
                    throw new Error('Protocol must be http or https');
                }
            } catch {
                webview.postMessage({ type: 'error', error: 'Invalid URL format.', duration: 0 });
                return;
            }

            let substitutedHeaders: { [key: string]: string } = {};
            if (message.headers) {
                for (const line of message.headers.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) { continue; }
                    const colonIndex = trimmed.indexOf(':');
                    if (colonIndex > 0) {
                        const key = trimmed.substring(0, colonIndex).trim();
                        if (!/^[a-zA-Z0-9\-_]+$/.test(key)) { continue; }
                        const value = trimmed.substring(colonIndex + 1).trim();
                        substitutedHeaders[key] = this.environmentManager.substituteVariables(value, selectedEnvironment) || value;
                    }
                }
            }

            let substitutedBody = message.body || '';
            if (substitutedBody) {
                substitutedBody = this.environmentManager.substituteVariables(substitutedBody, selectedEnvironment);
            }

            let data: any = undefined;
            if (substitutedBody) {
                try { data = JSON.parse(substitutedBody); } catch { data = substitutedBody; }
            }

            const timeout = (message.timeout && message.timeout > 0 && message.timeout <= RequestService.MAX_TIMEOUT)
                ? message.timeout : RequestService.DEFAULT_TIMEOUT;

            let lastError: any = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                if (attempt > 0) {
                    webview.postMessage({ type: 'retryAttempt', attempt, total: maxRetries });
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }

                this.abortController = new AbortController();

                try {
                    const response: AxiosResponse = await axios({
                        method: message.method,
                        url: substitutedUrl,
                        headers: substitutedHeaders,
                        data,
                        timeout,
                        validateStatus: () => true,
                        maxContentLength: RequestService.MAX_RESPONSE_SIZE,
                        maxBodyLength: RequestService.MAX_RESPONSE_SIZE,
                        signal: this.abortController.signal
                    });

                    const duration = Date.now() - startTime;
                    const responseSize = JSON.stringify(response.data).length;
                    const isLarge = responseSize > RequestService.DISPLAY_THRESHOLD;

                    webview.postMessage({
                        type: 'response',
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        data: isLarge
                            ? `[Response too large: ${(responseSize / 1024).toFixed(2)} KB]\n\nFirst 1000 characters:\n${JSON.stringify(response.data).substring(0, 1000)}...`
                            : response.data,
                        duration,
                        isLarge,
                        size: responseSize,
                        attempts: attempt + 1
                    });
                    return;

                } catch (error: unknown) {
                    lastError = error;
                    if (error instanceof Error && error.name === 'CanceledError') {
                        webview.postMessage({ type: 'error', error: 'Request cancelled', duration: Date.now() - startTime, cancelled: true });
                        return;
                    }
                    const isRetryable = axios.isAxiosError(error) && !error.response && retryableCodes.includes((error as any).code || '');
                    if (!isRetryable || attempt >= maxRetries) { break; }
                }
            }

            // All attempts failed
            const durationArr = Date.now() - startTime;
            let errorMessage = 'An error occurred';
            if (axios.isAxiosError(lastError)) {
                errorMessage = lastError.message;
            } else if (lastError instanceof Error) {
                errorMessage = lastError.message;
            }
            webview.postMessage({ type: 'error', error: errorMessage, duration: durationArr });

        } catch (error: unknown) {
            webview.postMessage({ type: 'error', error: String(error), duration: Date.now() - startTime });
        }
    }
}
