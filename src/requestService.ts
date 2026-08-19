import * as vscode from 'vscode';
import * as https from 'https';
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

            // Handle API Key in query parameter mode
            if (message.auth?.type === 'apikey' && message.auth?.keyIn === 'query') {
                const keyName = this.environmentManager.substituteVariables(message.auth.keyName || '', selectedEnvironment).trim();
                const keyValue = this.environmentManager.substituteVariables(message.auth.keyValue || '', selectedEnvironment).trim();
                if (keyName) {
                    try {
                        const parsedUrl = new URL(substitutedUrl);
                        parsedUrl.searchParams.append(keyName, keyValue);
                        substitutedUrl = parsedUrl.toString();
                    } catch {
                        const sep = substitutedUrl.includes('?') ? '&' : '?';
                        substitutedUrl = `${substitutedUrl}${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
                    }
                }
            }

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

            // If Basic Auth is configured, perform server-side variable substitution before Base64 encoding
            if (message.auth?.type === 'basic') {
                const rawUser = message.auth.username || '';
                const rawPass = message.auth.password || '';
                const user = this.environmentManager.substituteVariables(rawUser, selectedEnvironment);
                const pass = this.environmentManager.substituteVariables(rawPass, selectedEnvironment);
                if (user || pass) {
                    const basicCreds = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
                    substitutedHeaders['Authorization'] = `Basic ${basicCreds}`;
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

            // SSL verification toggle (rejectUnauthorized: false for localhost/self-signed certs)
            const httpsAgent = message.sslVerify === false || message.rejectUnauthorized === false
                ? new https.Agent({ rejectUnauthorized: false })
                : undefined;

            let lastError: any = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                if (attempt > 0) {
                    webview.postMessage({ type: 'retryAttempt', attempt, total: maxRetries });
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }

                try {
                    this.abortController = new AbortController();
                    const response = await axios({
                        method: message.method,
                        url: substitutedUrl,
                        headers: substitutedHeaders,
                        data,
                        timeout,
                        httpsAgent,
                        signal: this.abortController.signal,
                        validateStatus: () => true,
                        maxContentLength: RequestService.MAX_RESPONSE_SIZE,
                        maxBodyLength: RequestService.MAX_RESPONSE_SIZE
                    });

                    const duration = Date.now() - startTime;
                    const serializedResponse = typeof response.data === 'string'
                        ? response.data
                        : JSON.stringify(response.data ?? '');

                    const responseSize = Buffer.byteLength(serializedResponse, 'utf8');
                    const isLarge = responseSize > RequestService.DISPLAY_THRESHOLD;

                    webview.postMessage({
                        type: 'response',
                        status: response.status,
                        statusText: response.statusText,
                        duration,
                        size: responseSize,
                        headers: response.headers,
                        isLarge,
                        data: isLarge
                            ? `[Response too large: ${(responseSize / 1024).toFixed(2)} KB]\n\nFirst 1000 characters:\n${serializedResponse.substring(0, 1000)}...`
                            : response.data
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
            let errorMessage = 'Network request failed';

            if (axios.isAxiosError(lastError)) {
                const message = typeof lastError.message === 'string' ? lastError.message.trim() : '';
                const causeMessage = lastError.cause instanceof Error ? lastError.cause.message.trim() : '';
                const code = lastError.code || (lastError.cause as any)?.code || '';

                errorMessage = message || causeMessage || (code ? `Network error: ${code}` : 'Network request failed');
                if (code && !errorMessage.includes(code)) {
                    errorMessage += ` (${code})`;
                }
            } else if (lastError instanceof Error) {
                errorMessage = lastError.message?.trim() || lastError.name || 'Network request failed';
            } else if (lastError) {
                errorMessage = String(lastError);
            }

            webview.postMessage({ type: 'error', error: errorMessage, duration: durationArr });

        } catch (error: unknown) {
            const durationArr = Date.now() - startTime;
            let errorMessage = 'Network request failed';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (error) {
                errorMessage = String(error);
            }
            webview.postMessage({ type: 'error', error: errorMessage, duration: durationArr });
        }
    }

    public async fetchOAuthToken(message: any, webview: vscode.Webview) {
        try {
            const selectedEnvironment = message.environment || 'none';
            const rawTokenUrl = message.tokenUrl || '';
            const rawClientId = message.clientId || '';
            const rawClientSecret = message.clientSecret || '';
            const rawScope = message.scope || '';

            const tokenUrl = this.environmentManager.substituteVariables(rawTokenUrl, selectedEnvironment).trim();
            const clientId = this.environmentManager.substituteVariables(rawClientId, selectedEnvironment).trim();
            const clientSecret = this.environmentManager.substituteVariables(rawClientSecret, selectedEnvironment).trim();
            const scope = this.environmentManager.substituteVariables(rawScope, selectedEnvironment).trim();

            if (!tokenUrl) {
                webview.postMessage({ type: 'oauthTokenResult', success: false, error: 'Token URL is required' });
                return;
            }

            try {
                const parsed = new URL(tokenUrl);
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    throw new Error('Protocol must be http or https');
                }
            } catch {
                webview.postMessage({ type: 'oauthTokenResult', success: false, error: 'Invalid Token URL format' });
                return;
            }

            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            if (scope) { params.append('scope', scope); }

            const headers: Record<string, string> = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            };

            // RFC 6749 §2.3.1: client_id and client_secret are application/x-www-form-urlencoded before Base64 encoding
            if (clientId && clientSecret) {
                const formEncode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+');
                const encodedClientId = formEncode(clientId);
                const encodedClientSecret = formEncode(clientSecret);
                const basicCreds = Buffer.from(`${encodedClientId}:${encodedClientSecret}`, 'utf8').toString('base64');
                headers['Authorization'] = `Basic ${basicCreds}`;
            } else if (clientId) {
                params.append('client_id', clientId);
                if (clientSecret) { params.append('client_secret', clientSecret); }
            }

            const httpsAgent = message.sslVerify === false || message.rejectUnauthorized === false
                ? new https.Agent({ rejectUnauthorized: false })
                : undefined;

            const response = await axios.post(tokenUrl, params.toString(), {
                headers,
                timeout: 15000,
                httpsAgent,
                validateStatus: () => true
            });

            if (response.status >= 200 && response.status < 300 && response.data?.access_token) {
                webview.postMessage({
                    type: 'oauthTokenResult',
                    success: true,
                    accessToken: response.data.access_token,
                    tokenType: response.data.token_type || 'Bearer',
                    expiresIn: response.data.expires_in,
                    scope: response.data.scope || scope
                });
            } else {
                const errData = response.data;
                let errMsg = 'Failed to fetch OAuth token';
                if (typeof errData === 'object' && errData !== null) {
                    errMsg = errData.error_description || errData.error || JSON.stringify(errData);
                } else if (typeof errData === 'string' && errData.length > 0) {
                    errMsg = errData;
                }
                webview.postMessage({
                    type: 'oauthTokenResult',
                    success: false,
                    error: `HTTP ${response.status}: ${errMsg}`
                });
            }
        } catch (error: any) {
            webview.postMessage({
                type: 'oauthTokenResult',
                success: false,
                error: error?.message || 'Network error fetching OAuth token'
            });
        }
    }
}

