import { state } from './state.js';
import { initApi, post, notify } from './api.js';
import {
    switchTab, renderQueryParams, renderHeaders,
    updateEnvironmentIndicator, syntaxHighlightJson,
    hideModals, constructFullUrl, serializeHeaders, parseHeadersIntoState
} from './ui.js';
import { exportToCurl, showCurlImportModal, executeCurlImport } from './curl.js';

window.addEventListener('load', () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
    renderHeaders();
    post({ type: 'webviewReady' });
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Send / Cancel
    document.getElementById('send')?.addEventListener('click', sendRequest);

    // Add param row
    document.getElementById('add-param')?.addEventListener('click', () => {
        state.queryParams.push({ key: '', value: '' });
        renderQueryParams();
    });

    // Add header row
    document.getElementById('add-header')?.addEventListener('click', () => {
        state.headers.push({ key: '', value: '' });
        renderHeaders();
    });

    // Auth type switcher
    document.getElementById('auth-type')?.addEventListener('change', e => {
        renderAuthFields(e.target.value);
        state.authConfig.type = e.target.value;
    });

    // Export cURL
    document.getElementById('export-curl')?.addEventListener('click', exportToCurl);

    // Import cURL
    document.getElementById('import-curl')?.addEventListener('click', showCurlImportModal);
    document.getElementById('confirm-curl-import')?.addEventListener('click', executeCurlImport);
    document.getElementById('cancel-curl-import')?.addEventListener('click', hideModals);

    // Favorite
    document.getElementById('favorite-btn')?.addEventListener('click', () => {
        // ✅ validate before favoriting
        const url = document.getElementById('url')?.value?.trim();
        if (!url) {
            notify('error', 'Add a URL before saving to favorites');
            return;
        }

        post({ type: 'toggleFavorite', request: getRequestData() });
        const btn = document.getElementById('favorite-btn');
        const isFav = btn.textContent === '🌟';
        btn.textContent = isFav ? '⭐' : '🌟';
        notify('info', isFav ? 'Removed from favorites' : 'Added to favorites');
    });

    // Save modal
    document.getElementById('save-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('save-modal');
        if (modal) { 
            modal.style.display = 'flex'; 
            const nameInput = document.getElementById('save-name');
            if (nameInput) {
                nameInput.value = state.currentRequest?.name || '';
                nameInput.focus();
            }
        }
        post({ type: 'getCollections' });
    });
    document.getElementById('confirm-save')?.addEventListener('click', () => {
        const name = document.getElementById('save-name')?.value?.trim();
        const collectionId = document.getElementById('save-collection')?.value;
        const requestData = getRequestData();

        if (!name) return notify('error', 'Please enter a name');
        if (!collectionId) return notify('error', 'Please select a collection');
        
        // Ensure request is not empty (at least has a URL)
        if (!requestData.url || requestData.url.trim() === '') {
            return notify('error', 'Cannot save an empty request (URL is required)');
        }

        post({ type: 'saveRequest', request: requestData, name, collectionId });
        hideModals();
    });
    document.getElementById('cancel-save')?.addEventListener('click', hideModals);

    // Copy response
    document.getElementById('copy-response')?.addEventListener('click', () => {
        const body = document.getElementById('response-body')?.textContent || '';
        navigator.clipboard.writeText(body);
        notify('info', 'Response copied to clipboard');
    });

    // Ctrl+Enter shortcut
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendRequest();
    });

    // Extension messages
    window.addEventListener('message', handleMessage);
}

// --- Auth field renderer ---

function renderAuthFields(type) {
    const container = document.getElementById('auth-fields');
    if (!container) return;
    switch (type) {
        case 'basic':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username" autocomplete="off">
                    <input type="password" id="auth-password" class="url-input" placeholder="Password" autocomplete="off">
                </div>`;
            document.getElementById('auth-username').addEventListener('input', e => state.authConfig.username = e.target.value);
            document.getElementById('auth-password').addEventListener('input', e => state.authConfig.password = e.target.value);
            break;
        case 'bearer':
            container.innerHTML = `<input type="text" id="auth-token" class="url-input" placeholder="Bearer token" autocomplete="off">`;
            document.getElementById('auth-token').addEventListener('input', e => state.authConfig.token = e.target.value);
            break;
        case 'apikey':
            container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-key-name" class="url-input" placeholder="Key name (e.g. X-API-Key)" autocomplete="off">
                    <input type="text" id="auth-key-value" class="url-input" placeholder="Value" autocomplete="off">
                    <select id="auth-key-in" class="method-select" style="width:140px;">
                        <option value="header">Add to Header</option>
                        <option value="query">Add to Query</option>
                    </select>
                </div>`;
            document.getElementById('auth-key-name').addEventListener('input', e => state.authConfig.keyName = e.target.value);
            document.getElementById('auth-key-value').addEventListener('input', e => state.authConfig.keyValue = e.target.value);
            document.getElementById('auth-key-in').addEventListener('change', e => state.authConfig.keyIn = e.target.value);
            break;
        default:
            container.innerHTML = '';
    }
}

// --- Core request logic ---

function sendRequest() {
    const btn = document.getElementById('send');
    if (state.isRequestInProgress) {
        post({ type: 'cancelRequest' });
        btn.textContent = 'Send';
        btn.classList.remove('loading');
        state.isRequestInProgress = false;
        return;
    }
    state.isRequestInProgress = true;
    btn.textContent = 'Cancel ✕';
    btn.classList.add('loading');
    post({ type: 'sendRequest', ...getRequestData() });
}

function getRequestData() {
    const envBadge = document.getElementById('env-badge');
    const activeEnv = envBadge?.textContent === 'No Environment' ? 'none' : (envBadge?.textContent || 'none');

    // Serialize headers from state (key-value rows)
    let headers = serializeHeaders();

    // Inject auth header
    const authType = state.authConfig.type;
    if (authType === 'bearer') {
        const token = document.getElementById('auth-token')?.value || '';
        if (token) headers = `Authorization: Bearer ${token}\n` + headers;
    } else if (authType === 'basic') {
        const user = document.getElementById('auth-username')?.value || '';
        const pass = document.getElementById('auth-password')?.value || '';
        if (user || pass) headers = `Authorization: Basic ${btoa(`${user}:${pass}`)}\n` + headers;
    } else if (authType === 'apikey') {
        const keyName = document.getElementById('auth-key-name')?.value || '';
        const keyValue = document.getElementById('auth-key-value')?.value || '';
        const keyIn = document.getElementById('auth-key-in')?.value || 'header';
        if (keyName && keyValue && keyIn === 'header') headers = `${keyName}: ${keyValue}\n` + headers;
        // query-param injection handled server-side via queryParams array
    }

    return {
        id: state.currentRequest?.id,
        name: state.currentRequest?.name,
        method: document.getElementById('method')?.value || 'GET',
        url: constructFullUrl(),
        headers,
        body: document.getElementById('body')?.value || '',
        notes: document.getElementById('notes')?.value || '',
        queryParams: state.queryParams,
        auth: state.authConfig,
        environment: activeEnv,
        retryCount: parseInt(document.getElementById('retry-count')?.value || '0', 10),
        timeout: parseInt(document.getElementById('timeout')?.value || '10000', 10)
    };
}

// --- Extension message handler ---

function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
        case 'environments':
            state.environments = msg.environments || [];
            updateEnvironmentIndicator(msg.activeEnvironment || 'none');
            break;
        case 'loadRequest':
            loadRequestIntoUI(msg.data || msg.request, msg.collectionName);
            break;
        case 'response':
            handleResponse(msg);
            break;
        case 'error':
            handleError(msg);
            break;
        case 'retryAttempt':
            document.getElementById('send').textContent = `Retrying (${msg.attempt}/${msg.total})...`;
            break;
        case 'collections':
            populateCollectionsDropdown(msg.collections);
            break;
    }
}

// --- Load request into UI ---
function loadRequestIntoUI(req, collectionName) {
    if (!req) return;
    state.currentRequest = req;
    state.lastLoadedCollection = collectionName || null;

    const method = document.getElementById('method');
    const url = document.getElementById('url');
    const body = document.getElementById('body');
    const notes = document.getElementById('notes');

    if (method) method.value = req.method || 'GET';
    if (url) url.value = (req.url || '').split('?')[0];
    if (body) body.value = req.body || '';
    if (notes) notes.value = req.notes || '';

    // Parse headers string → key-value state
    parseHeadersIntoState(req.headers || '');
    renderHeaders();

    // Parse query params from saved array or URL
    if (req.queryParams?.length) {
        state.queryParams = req.queryParams.map(p => ({ ...p }));
    } else {
        try {
            const urlObj = new URL(req.url || '');
            state.queryParams = [];
            urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
            if (url) url.value = urlObj.origin + urlObj.pathname;
        } catch {
            state.queryParams = [];
        }
    }
    renderQueryParams();

    // Retry / timeout
    if (req.retryCount !== undefined) {
        const rc = document.getElementById('retry-count');
        if (rc) rc.value = req.retryCount;
    }
    if (req.timeout !== undefined) {
        const to = document.getElementById('timeout');
        if (to) to.value = req.timeout;
    }

    // Restore Auth
    if (req.auth) {
        state.authConfig = { ...req.auth };
        const authTypeSelect = document.getElementById('auth-type');
        if (authTypeSelect) authTypeSelect.value = state.authConfig.type;
        renderAuthFields(state.authConfig.type);
        
        if (state.authConfig.type === 'basic') {
            const u = document.getElementById('auth-username');
            const p = document.getElementById('auth-password');
            if (u) u.value = state.authConfig.username || '';
            if (p) p.value = state.authConfig.password || '';
        } else if (state.authConfig.type === 'bearer') {
            const t = document.getElementById('auth-token');
            if (t) t.value = state.authConfig.token || '';
        } else if (state.authConfig.type === 'apikey') {
            const n = document.getElementById('auth-key-name');
            const v = document.getElementById('auth-key-value');
            const i = document.getElementById('auth-key-in');
            if (n) n.value = state.authConfig.keyName || '';
            if (v) v.value = state.authConfig.keyValue || '';
            if (i) i.value = state.authConfig.keyIn || 'header';
        }
    }

    notify('info', `Loaded: ${req.name || 'Request'}`);
}

// --- Response handling ---

function handleResponse(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById('send');
    if (btn) {
        btn.textContent = 'Send';
        btn.classList.remove('loading');
    }

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const sizeBadge = document.getElementById('size-badge');
    const responseBody = document.getElementById('response-body');

    if (statusBadge) {
        statusBadge.textContent = `${res.status} ${res.statusText}`;
        statusBadge.className = `badge ${res.status < 300 ? 'badge-2xx' : res.status < 500 ? 'badge-4xx' : 'badge-5xx'}`;
    }
    if (timeBadge) timeBadge.textContent = `${res.duration} ms`;
    if (sizeBadge) sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : '-- KB';

    if (responseBody) {
        try {
            if (typeof res.data === 'object' && res.data !== null) {
                responseBody.innerHTML = `<pre style="margin:0">${syntaxHighlightJson(JSON.stringify(res.data, null, 2))}</pre>`;
            } else {
                responseBody.textContent = String(res.data);
            }
        } catch {
            responseBody.textContent = String(res.data);
        }
    }
}

function handleError(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById('send');
    if (btn) {
        btn.textContent = 'Send';
        btn.classList.remove('loading');
    }

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const responseBody = document.getElementById('response-body');

    if (statusBadge) {
        statusBadge.textContent = res.cancelled ? 'Cancelled' : 'Error';
        statusBadge.className = 'badge badge-5xx';
    }
    if (timeBadge) timeBadge.textContent = res.duration ? `${res.duration} ms` : '--';
    if (responseBody) responseBody.innerHTML = `<div style="color:#f85149;padding:8px;">⚠️ ${res.error || 'Unknown error'}</div>`;
}

// --- Collections dropdown ---

function populateCollectionsDropdown(collections) {
    const select = document.getElementById('save-collection');
    if (!select || !Array.isArray(collections)) return;
    select.innerHTML = collections.length
        ? collections.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        : '<option value="">No collections yet — create one first</option>';
    
    // Auto-select the collection if we loaded from one
    if (state.lastLoadedCollection) {
        select.value = state.lastLoadedCollection;
    }
}