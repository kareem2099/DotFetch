import { state, createDefaultAuthConfig, createPersistableAuthConfig } from './state.js';
import { post, notify } from './api.js';
import { constructFullUrl, renderQueryParams, renderHeaders, serializeHeaders, parseHeadersIntoState, hideModals, updateSslIndicator } from './ui.js';
import { restoreAuthUI, renderAuthFields, applyAuthHeaderToRawHeaders, isOAuthTokenExpired } from './auth.js';

export function getRequestData({ forSend = false } = {}) {
    const activeEnv = state.activeEnvironment || 'none';

    // Separate draft headers from wire/injected headers
    const rawHeaders = serializeHeaders();
    const headers = forSend ? applyAuthHeaderToRawHeaders(rawHeaders) : rawHeaders;

    // Runtime credentials for live send vs persistable safe schema (no saved plaintext secrets)
    const auth = forSend ? { ...state.authConfig } : createPersistableAuthConfig();

    return {
        id: state.currentRequest?.id,
        name: state.currentRequest?.name,
        method: document.getElementById('method')?.value || 'GET',
        url: constructFullUrl(),
        headers,
        body: document.getElementById('body')?.value || '',
        notes: document.getElementById('notes')?.value || '',
        queryParams: [...state.queryParams],
        auth,
        environment: activeEnv,
        retryCount: parseInt(document.getElementById('retry-count')?.value || '0', 10),
        timeout: parseInt(document.getElementById('timeout')?.value || '10000', 10),
        sslVerify: state.settings.sslVerify !== false
    };
}

export function sendRequest() {
    const sendButton = document.getElementById('send');
    
    if (state.isRequestInProgress) {
        post({ type: 'cancelRequest' });
        if (sendButton) {
            sendButton.textContent = 'Send';
            sendButton.classList.remove('loading');
        }
        state.isRequestInProgress = false;
        return;
    }

    // Validate URL
    const url = constructFullUrl();
    if (!url || url.trim() === '') {
        notify('error', 'URL is required');
        return;
    }

    // Validate Bearer Token
    if (state.authConfig.type === 'bearer' && !state.authConfig.token?.trim()) {
        notify('error', 'Bearer token is required');
        return;
    }

    // Validate API Key
    if (state.authConfig.type === 'apikey' && (!state.authConfig.keyName?.trim() || !state.authConfig.keyValue?.trim())) {
        notify('error', 'API Key Name and Value are required');
        return;
    }

    // Validate OAuth Token Expiry
    if (state.authConfig.type === 'oauth2') {
        if (!state.authConfig.accessToken) {
            notify('error', 'Please fetch an OAuth token before sending');
            return;
        }
        if (isOAuthTokenExpired()) {
            notify('error', 'OAuth token expired — please fetch a new token');
            return;
        }
    }

    const requestData = getRequestData({ forSend: true });
    // Safe snapshot used for History persistence (no raw secrets, no injected headers)
    const historyData = getRequestData({ forSend: false });

    state.currentRequest = { ...requestData };
    state.isRequestInProgress = true;

    if (sendButton) {
        sendButton.textContent = 'Cancel ✕';
        sendButton.classList.add('loading');
    }

    post({
        type: 'sendRequest',
        ...requestData,
        historyData
    });
}

export function clearRequestForm() {
    const methodSelect = document.getElementById('method');
    const urlInput = document.getElementById('url');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('notes');

    if (methodSelect) { methodSelect.value = 'GET'; }
    if (urlInput) { urlInput.value = ''; }
    if (bodyTextarea) { bodyTextarea.value = ''; }
    if (notesTextarea) { notesTextarea.value = ''; }

    state.queryParams = [];
    state.headers = [];
    renderQueryParams();
    renderHeaders();

    // Canonical v2.1 authConfig reset
    state.authConfig = createDefaultAuthConfig();
    const authTypeSelect = document.getElementById('auth-type');
    if (authTypeSelect) {
        authTypeSelect.value = 'none';
    }
    renderAuthFields('none');
}

export function loadRequestIntoForm(item, collectionName) {
    if (!item) { return; }

    state.currentRequest = item;
    state.lastLoadedCollection = collectionName || null;

    const methodSelect = document.getElementById('method');
    const urlInput = document.getElementById('url');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('notes');

    if (methodSelect) { methodSelect.value = item.method || 'GET'; }
    if (urlInput) { urlInput.value = (item.url || '').split('?')[0]; }
    if (bodyTextarea) { bodyTextarea.value = item.body || ''; }
    if (notesTextarea) { notesTextarea.value = item.notes || ''; }

    // Parse headers string into key-value state
    parseHeadersIntoState(item.headers || '');
    renderHeaders();

    // Parse query params
    if (item.queryParams && item.queryParams.length > 0) {
        state.queryParams = item.queryParams.map(p => ({ ...p }));
    } else {
        try {
            const urlObj = new URL(item.url || '');
            state.queryParams = [];
            urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
            if (urlInput) { urlInput.value = urlObj.origin + urlObj.pathname; }
        } catch {
            state.queryParams = [];
        }
    }
    renderQueryParams();

    // Settings
    if (item.retryCount !== undefined) {
        const rc = document.getElementById('retry-count');
        if (rc) { rc.value = item.retryCount; }
    }
    if (item.timeout !== undefined) {
        const to = document.getElementById('timeout');
        if (to) { to.value = item.timeout; }
    }

    // SSL Verify: Secure default (true) on every load unless explicitly false
    const sslVerify = item.sslVerify !== false;
    state.settings.sslVerify = sslVerify;
    const sslCheckbox = document.getElementById('ssl-verify');
    if (sslCheckbox) { sslCheckbox.checked = sslVerify; }
    updateSslIndicator(sslVerify);

    // Restore Auth or reset cleanly to default schema
    restoreAuthUI(item.auth || createDefaultAuthConfig());

    notify('info', `Loaded: ${item.name || 'Request'}`);
}

export function saveRequest() {
    const nameInput = document.getElementById('save-name');
    const collSelect = document.getElementById('save-collection');

    const name = nameInput?.value?.trim();
    const collectionId = collSelect?.value;
    const requestData = getRequestData({ forSend: false });

    if (!name) {
        notify('error', 'Please enter a request name');
        return;
    }
    if (!collectionId) {
        notify('error', 'Please select a collection');
        return;
    }
    if (!requestData.url || requestData.url.trim() === '') {
        notify('error', 'Cannot save an empty request (URL is required)');
        return;
    }

    post({
        type: 'saveRequest',
        request: requestData,
        name,
        collectionId
    });

    hideModals();
}