import { state, createDefaultAuthConfig } from './state.js';
import { post, notify } from './api.js';

export function renderAuthFields(type) {
    const container = document.getElementById('auth-fields');
    if (!container) {return;}

    state.authConfig.type = type || 'none';

    switch (type) {
        case 'basic':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username or {{USER}}" autocomplete="off" value="${state.authConfig.username || ''}">
                    <div class="auth-input-group">
                        <input type="password" id="auth-password" class="url-input" placeholder="Password or {{PASS}}" autocomplete="off" value="${state.authConfig.password || ''}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-password" title="Show/Hide Password">👁️</button>
                    </div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
            setupBasicAuthListeners();
            updateBasicAuthPreview();
            break;

        case 'bearer':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <div class="auth-input-group">
                        <input type="password" id="auth-token" class="url-input" placeholder="Bearer token or {{TOKEN}}" autocomplete="off" value="${state.authConfig.token || ''}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-token" title="Show/Hide Token">👁️</button>
                    </div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
            setupBearerAuthListeners();
            updateBearerAuthPreview();
            break;

        case 'apikey':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-key-name" class="url-input" placeholder="Key name (e.g. X-API-Key)" autocomplete="off" value="${state.authConfig.keyName || ''}">
                    <div class="auth-input-group">
                        <input type="password" id="auth-key-value" class="url-input" placeholder="Value or {{API_KEY}}" autocomplete="off" value="${state.authConfig.keyValue || ''}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-key" title="Show/Hide Value">👁️</button>
                    </div>
                    <select id="auth-key-in" class="method-select" style="width:160px;">
                        <option value="header" ${state.authConfig.keyIn === 'header' ? 'selected' : ''}>Add to Header</option>
                        <option value="query" ${state.authConfig.keyIn === 'query' ? 'selected' : ''}>Add to Query Params</option>
                    </select>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
            setupApiKeyListeners();
            updateApiKeyPreview();
            break;

        case 'oauth2':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="oauth-token-url" class="url-input" placeholder="Token URL (e.g. https://auth.example.com/oauth/token)" autocomplete="off" value="${state.authConfig.tokenUrl || ''}">
                    <input type="text" id="oauth-client-id" class="url-input" placeholder="Client ID or {{CLIENT_ID}}" autocomplete="off" value="${state.authConfig.clientId || ''}">
                    <div class="auth-input-group">
                        <input type="password" id="oauth-client-secret" class="url-input" placeholder="Client Secret or {{CLIENT_SECRET}}" autocomplete="off" value="${state.authConfig.clientSecret || ''}">
                        <button type="button" class="auth-toggle-btn" id="toggle-oauth-secret" title="Show/Hide Secret">👁️</button>
                    </div>
                    <input type="text" id="oauth-scope" class="url-input" placeholder="Scope (optional, e.g. read:users)" autocomplete="off" value="${state.authConfig.scope || ''}">
                    
                    <button type="button" id="fetch-oauth-btn" class="oauth-fetch-btn">⚡ Fetch & Inject Token</button>

                    <div id="oauth-token-display"></div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
            setupOAuth2Listeners();
            renderOAuthTokenCard();
            updateOAuthPreview();
            break;

        default:
            container.innerHTML = '';
            break;
    }
}

// --- Toggle Password Visibility Helper ---

function setupPasswordToggle(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input || !btn) {return;}

    btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? '🙈' : '👁️';
    });
}

// --- Basic Auth ---

function setupBasicAuthListeners() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');

    usernameInput?.addEventListener('input', e => {
        state.authConfig.username = e.target.value;
        updateBasicAuthPreview();
    });
    passwordInput?.addEventListener('input', e => {
        state.authConfig.password = e.target.value;
        updateBasicAuthPreview();
    });
    setupPasswordToggle('auth-password', 'toggle-auth-password');
}

export function updateBasicAuthPreview() {
    const preview = document.getElementById('auth-preview');
    if (!preview) {return;}
    const user = state.authConfig.username || '';
    const pass = state.authConfig.password || '';
    if (user || pass) {
        const hasVariables = user.includes('{{') || pass.includes('{{');
        if (hasVariables) {
            preview.innerHTML = `<span>Authorization: Basic &lt;resolved from env on send&gt;</span>`;
            preview.classList.remove('hidden');
            return;
        }

        let encoded = '';
        try {
            encoded = btoa(unescape(encodeURIComponent(`${user}:${pass}`)));
        } catch {
            encoded = '...';
        }

        preview.innerHTML = `<span>Authorization: Basic ${encoded}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
        preview.classList.remove('hidden');
        document.getElementById('copy-auth-preview')?.addEventListener('click', () => {
            navigator.clipboard.writeText(`Authorization: Basic ${encoded}`);
            notify('info', 'Auth header copied to clipboard');
        });
    } else {
        preview.classList.add('hidden');
    }
}

// --- Bearer Auth ---

function setupBearerAuthListeners() {
    const tokenInput = document.getElementById('auth-token');
    tokenInput?.addEventListener('input', e => {
        state.authConfig.token = e.target.value;
        updateBearerAuthPreview();
    });
    setupPasswordToggle('auth-token', 'toggle-auth-token');
}

export function updateBearerAuthPreview() {
    const preview = document.getElementById('auth-preview');
    if (!preview) {return;}
    const token = state.authConfig.token || '';
    if (token) {
        preview.innerHTML = `<span>Authorization: Bearer ${token}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
        preview.classList.remove('hidden');
        document.getElementById('copy-auth-preview')?.addEventListener('click', () => {
            navigator.clipboard.writeText(`Authorization: Bearer ${token}`);
            notify('info', 'Auth header copied to clipboard');
        });
    } else {
        preview.classList.add('hidden');
    }
}

// --- API Key Auth ---

function setupApiKeyListeners() {
    const keyNameInput = document.getElementById('auth-key-name');
    const keyValueInput = document.getElementById('auth-key-value');
    const keyInSelect = document.getElementById('auth-key-in');

    keyNameInput?.addEventListener('input', e => {
        state.authConfig.keyName = e.target.value;
        updateApiKeyPreview();
    });
    keyValueInput?.addEventListener('input', e => {
        state.authConfig.keyValue = e.target.value;
        updateApiKeyPreview();
    });
    keyInSelect?.addEventListener('change', e => {
        state.authConfig.keyIn = e.target.value;
        updateApiKeyPreview();
    });
    setupPasswordToggle('auth-key-value', 'toggle-auth-key');
}

export function updateApiKeyPreview() {
    const preview = document.getElementById('auth-preview');
    if (!preview) {return;}
    const keyName = state.authConfig.keyName || '';
    const keyValue = state.authConfig.keyValue || '';
    const keyIn = state.authConfig.keyIn || 'header';

    if (keyName && keyValue) {
        const text = keyIn === 'header' ? `${keyName}: ${keyValue}` : `?${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
        preview.innerHTML = `<span>${keyIn === 'header' ? 'Header' : 'Query Param'}: ${text}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
        preview.classList.remove('hidden');
        document.getElementById('copy-auth-preview')?.addEventListener('click', () => {
            navigator.clipboard.writeText(text);
            notify('info', 'Copied to clipboard');
        });
    } else {
        preview.classList.add('hidden');
    }
}

// --- OAuth 2.0 (Client Credentials) ---

function setupOAuth2Listeners() {
    document.getElementById('oauth-token-url')?.addEventListener('input', e => {
        state.authConfig.tokenUrl = e.target.value;
    });
    document.getElementById('oauth-client-id')?.addEventListener('input', e => {
        state.authConfig.clientId = e.target.value;
    });
    document.getElementById('oauth-client-secret')?.addEventListener('input', e => {
        state.authConfig.clientSecret = e.target.value;
    });
    document.getElementById('oauth-scope')?.addEventListener('input', e => {
        state.authConfig.scope = e.target.value;
    });
    setupPasswordToggle('oauth-client-secret', 'toggle-oauth-secret');

    document.getElementById('fetch-oauth-btn')?.addEventListener('click', triggerFetchOAuthToken);
}

export function triggerFetchOAuthToken() {
    const btn = document.getElementById('fetch-oauth-btn');
    const envBadge = document.getElementById('env-badge');
    const activeEnv = envBadge?.textContent === 'No Environment' ? 'none' : (envBadge?.textContent || 'none');

    const tokenUrl = document.getElementById('oauth-token-url')?.value?.trim();
    const clientId = document.getElementById('oauth-client-id')?.value?.trim();
    const clientSecret = document.getElementById('oauth-client-secret')?.value?.trim();
    const scope = document.getElementById('oauth-scope')?.value?.trim();

    if (!tokenUrl) {
        notify('error', 'Token URL is required');
        return;
    }

    if (btn) {
        btn.textContent = '⏳ Fetching Token...';
        btn.classList.add('loading');
    }

    post({
        type: 'fetchOAuthToken',
        tokenUrl,
        clientId,
        clientSecret,
        scope,
        environment: activeEnv,
        sslVerify: state.settings.sslVerify !== false
    });
}

export function handleOAuthTokenResult(msg) {
    const btn = document.getElementById('fetch-oauth-btn');
    if (btn) {
        btn.textContent = '⚡ Fetch & Inject Token';
        btn.classList.remove('loading');
    }

    if (msg.success && msg.accessToken) {
        state.authConfig.accessToken = msg.accessToken;
        state.authConfig.tokenType = msg.tokenType || 'Bearer';
        state.authConfig.expiresIn = msg.expiresIn || null;
        state.authConfig.tokenReceivedAt = Date.now();

        notify('info', 'OAuth token fetched and injected successfully!');
        renderOAuthTokenCard();
        updateOAuthPreview();
    } else {
        notify('error', msg.error || 'Failed to fetch OAuth token');
    }
}

function renderOAuthTokenCard() {
    const container = document.getElementById('oauth-token-display');
    if (!container) {return;}

    if (!state.authConfig.accessToken) {
        container.innerHTML = '';
        return;
    }

    const isExpired = state.authConfig.expiresIn && state.authConfig.tokenReceivedAt
        ? (Date.now() - state.authConfig.tokenReceivedAt) > (state.authConfig.expiresIn * 1000)
        : false;

    const expiryText = state.authConfig.expiresIn
        ? `Expires: ${state.authConfig.expiresIn}s`
        : 'No expiration specified';

    container.innerHTML = `
        <div class="oauth-token-card">
            <div class="oauth-token-header">
                <span style="font-weight:600;font-size:11px;">Active Access Token</span>
                <span class="token-status-badge ${isExpired ? 'expired' : 'valid'}">${isExpired ? 'Expired' : 'Valid'}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--fg-muted);">
                ${state.authConfig.accessToken.substring(0, 32)}...
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <span class="fg-muted" style="font-size:10px;">${expiryText}</span>
                <div style="display:flex;gap:6px;">
                    <button type="button" class="tool-btn" id="copy-oauth-token" style="padding:2px 8px;font-size:10px;">Copy Token</button>
                    <button type="button" class="tool-btn" id="clear-oauth-token" style="padding:2px 8px;font-size:10px;color:var(--error);">Clear</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('copy-oauth-token')?.addEventListener('click', () => {
        navigator.clipboard.writeText(state.authConfig.accessToken);
        notify('info', 'Access token copied to clipboard');
    });

    document.getElementById('clear-oauth-token')?.addEventListener('click', () => {
        state.authConfig.accessToken = '';
        state.authConfig.expiresIn = null;
        state.authConfig.tokenReceivedAt = null;
        renderOAuthTokenCard();
        updateOAuthPreview();
        notify('info', 'OAuth token cleared');
    });
}

export function updateOAuthPreview() {
    const preview = document.getElementById('auth-preview');
    if (!preview) {return;}
    const token = state.authConfig.accessToken;
    const type = state.authConfig.tokenType || 'Bearer';

    if (token) {
        preview.innerHTML = `<span>Authorization: ${type} ${token.substring(0, 24)}...</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
        preview.classList.remove('hidden');
        document.getElementById('copy-auth-preview')?.addEventListener('click', () => {
            navigator.clipboard.writeText(`Authorization: ${type} ${token}`);
            notify('info', 'Auth header copied to clipboard');
        });
    } else {
        preview.classList.add('hidden');
    }
}

// --- General Auth Header Builder ---

export function isOAuthTokenExpired() {
    if (state.authConfig.type !== 'oauth2') {
        return false;
    }
    if (!state.authConfig.accessToken) {
        return true;
    }
    if (!state.authConfig.expiresIn || !state.authConfig.tokenReceivedAt) {
        return false;
    }
    return (Date.now() - state.authConfig.tokenReceivedAt) > (state.authConfig.expiresIn * 1000);
}

export function removeHeader(rawHeaders, headerName) {
    const target = headerName.toLowerCase();
    return (rawHeaders || '')
        .split('\n')
        .filter(line => {
            const idx = line.indexOf(':');
            if (idx < 1) {
                return true;
            }
            return line.substring(0, idx).trim().toLowerCase() !== target;
        })
        .join('\n');
}

export function buildAuthHeader() {
    const type = state.authConfig.type;
    // Basic Auth is backend-owned in RequestService after variable substitution
    if (type === 'basic') {
        return null;
    } else if (type === 'bearer') {
        const t = state.authConfig.token || '';
        if (t) {
            return `Authorization: Bearer ${t}`;
        }
    } else if (type === 'apikey') {
        const n = state.authConfig.keyName || '';
        const v = state.authConfig.keyValue || '';
        const inHeader = (state.authConfig.keyIn || 'header') === 'header';
        if (n && v && inHeader) {
            return `${n}: ${v}`;
        }
    } else if (type === 'oauth2') {
        if (isOAuthTokenExpired()) {
            return null;
        }
        const t = state.authConfig.accessToken || '';
        const prefix = state.authConfig.tokenType || 'Bearer';
        if (t) {
            return `Authorization: ${prefix} ${t}`;
        }
    }
    return null;
}

export function applyAuthHeaderToRawHeaders(rawHeaders) {
    const type = state.authConfig.type;
    let cleanHeaders = rawHeaders || '';

    // Auth tab owns Authorization whenever one of these modes is active
    if (type === 'basic' || type === 'bearer' || type === 'oauth2') {
        cleanHeaders = removeHeader(cleanHeaders, 'authorization');
    }

    // Basic Auth is injected only by RequestService after environment-variable substitution
    if (type === 'basic') {
        return cleanHeaders;
    }

    const authHeader = buildAuthHeader();
    if (!authHeader) {
        return cleanHeaders;
    }

    const authKey = authHeader.split(':')[0].trim().toLowerCase();
    cleanHeaders = removeHeader(cleanHeaders, authKey);

    return cleanHeaders.trim()
        ? `${authHeader}\n${cleanHeaders.trim()}`
        : authHeader;
}

// --- Restore Auth UI ---

export function restoreAuthUI(savedAuth) {
    state.authConfig = savedAuth
        ? { ...createDefaultAuthConfig(), ...savedAuth }
        : createDefaultAuthConfig();

    const authTypeSelect = document.getElementById('auth-type');
    if (authTypeSelect) {
        authTypeSelect.value = state.authConfig.type;
    }
    renderAuthFields(state.authConfig.type);
}