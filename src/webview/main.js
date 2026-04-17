import { state } from './state.js';
import { initApi, post, notify } from './api.js';
import { switchTab, renderQueryParams, updateEnvironmentIndicator, syntaxHighlightJson, hideModals, constructFullUrl } from './ui.js';

window.addEventListener('load', () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);

    setupEventListeners();
    renderQueryParams();
    
    post({ type: 'webviewReady' });
});

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Request buttons
    document.getElementById('send')?.addEventListener('click', sendRequest);
    document.getElementById('add-param')?.addEventListener('click', () => {
        state.queryParams.push({ key: '', value: '' });
        renderQueryParams();
    });

    // Auth type switcher
    document.getElementById('auth-type')?.addEventListener('change', (e) => {
        const authFields = document.getElementById('auth-fields');
        const type = e.target.value;
        if (type === 'basic') {
            authFields.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username">
                    <input type="password" id="auth-password" class="url-input" placeholder="Password">
                </div>`;
        } else if (type === 'bearer') {
            authFields.innerHTML = `<input type="text" id="auth-token" class="url-input" placeholder="Bearer Token">`;
        } else {
            authFields.innerHTML = '';
        }
        state.authConfig.type = type;
    });

    // Export cURL
    document.getElementById('export-curl')?.addEventListener('click', () => {
        const data = getRequestData();
        let curl = `curl -X ${data.method} '${data.url}'`;
        if (data.headers) {
            data.headers.split('\n').filter(l => l.includes(':')).forEach(h => {
                curl += ` \\\n  -H '${h.trim()}'`;
            });
        }
        if (data.body && ['POST', 'PUT', 'PATCH'].includes(data.method)) {
            curl += ` \\\n  -d '${data.body.replace(/'/g, "\\'")}'`;
        }
        navigator.clipboard.writeText(curl);
        notify('info', 'cURL copied to clipboard!');
    });

    // Favorite Button
    document.getElementById('favorite-btn')?.addEventListener('click', () => {
        post({ type: 'toggleFavorite', request: getRequestData() });
        const btn = document.getElementById('favorite-btn');
        const isFav = btn.textContent === '🌟';
        btn.textContent = isFav ? '⭐' : '🌟';
        notify('info', isFav ? 'Removed from favorites' : 'Added to favorites');
    });

    // Keyboard shortcut: Ctrl+Enter to send
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            sendRequest();
        }
    });

    document.getElementById('save-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('save-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('save-name').focus();
            // Request collections to populate dropdown
            post({ type: 'getCollections' });
        }
    });

    document.getElementById('confirm-save')?.addEventListener('click', () => {
        const name = document.getElementById('save-name').value;
        const collectionId = document.getElementById('save-collection').value;
        if (!name) return notify('error', 'Please enter a name');
        
        post({
            type: 'saveRequest',
            request: getRequestData(),
            name,
            collectionId
        });
        hideModals();
    });

    document.getElementById('cancel-save')?.addEventListener('click', hideModals);

    // Copy response
    document.getElementById('copy-response')?.addEventListener('click', () => {
        const body = document.getElementById('response-body').textContent;
        navigator.clipboard.writeText(body);
        notify('info', 'Response copied to clipboard');
    });

    // Handle messages from extension
    window.addEventListener('message', handleMessage);
}

function handleMessage(event) {
    const message = event.data;
    switch (message.type) {
        case 'environments':
            state.environments = message.environments || [];
            updateEnvironmentIndicator(message.activeEnvironment || 'none');
            break;

        case 'loadRequest':
            // Backend sends { type: 'loadRequest', data: request }
            loadRequestIntoUI(message.data || message.request);
            break;

        case 'response':
            handleResponse(message);
            break;

        case 'error':
            handleError(message);
            break;

        case 'retryAttempt':
            handleRetryAttempt(message);
            break;

        case 'collections':
            populateCollectionsDropdown(message.collections);
            break;
    }
}

function sendRequest() {
    const btn = document.getElementById('send');
    if (state.isRequestInProgress) {
        post({ type: 'cancelRequest' });
        btn.textContent = 'Send';
        state.isRequestInProgress = false;
        return;
    }

    state.isRequestInProgress = true;
    btn.textContent = 'Cancel ✕';

    const request = getRequestData();
    post({ type: 'sendRequest', ...request });
}

function getRequestData() {
    const envBadge = document.getElementById('env-badge');
    const activeEnv = envBadge ? (envBadge.textContent === 'No Environment' ? 'none' : envBadge.textContent) : 'none';

    let headers = document.getElementById('headers').value;

    // Inject Auth header
    const authType = document.getElementById('auth-type')?.value;
    if (authType === 'bearer') {
        const token = document.getElementById('auth-token')?.value;
        if (token) headers = `Authorization: Bearer ${token}\n` + headers;
    } else if (authType === 'basic') {
        const user = document.getElementById('auth-username')?.value || '';
        const pass = document.getElementById('auth-password')?.value || '';
        if (user || pass) {
            const encoded = btoa(`${user}:${pass}`);
            headers = `Authorization: Basic ${encoded}\n` + headers;
        }
    }

    return {
        id: state.currentRequest?.id,
        name: state.currentRequest?.name,
        method: document.getElementById('method').value,
        url: document.getElementById('url').value,
        headers,
        body: document.getElementById('body').value,
        notes: document.getElementById('notes').value,
        queryParams: state.queryParams,
        environment: activeEnv,
        retryCount: parseInt(document.getElementById('retry-count')?.value || '0', 10),
        timeout: parseInt(document.getElementById('timeout')?.value || '10000', 10)
    };
}

function loadRequestIntoUI(req) {
    if (!req) return;
    
    state.currentRequest = req;
    
    document.getElementById('method').value = req.method || 'GET';
    document.getElementById('url').value = req.url || '';
    document.getElementById('headers').value = req.headers || '';
    document.getElementById('body').value = req.body || '';
    document.getElementById('notes').value = req.notes || '';
    
    // Load settings if present
    if (req.retryCount !== undefined) {
        document.getElementById('retry-count').value = req.retryCount;
    }
    if (req.timeout !== undefined) {
        document.getElementById('timeout').value = req.timeout;
    }

    state.queryParams = req.queryParams || [];
    renderQueryParams();
    
    // Check if it's already a favorite based on a flag or UI could ask backend later
    
    notify('info', `Loaded: ${req.name || 'Request'}`);
}

function handleResponse(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById('send');
    btn.textContent = 'Send';

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const sizeBadge = document.getElementById('size-badge');
    const responseBody = document.getElementById('response-body');

    statusBadge.textContent = `${res.status} ${res.statusText}`;
    statusBadge.className = `badge ${res.status < 300 ? 'badge-2xx' : (res.status < 500 ? 'badge-4xx' : 'badge-5xx')}`;
    
    timeBadge.textContent = `${res.duration} ms`;
    sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : '-- KB';

    try {
        const data = res.data;
        if (typeof data === 'object' && data !== null) {
            const formatted = syntaxHighlightJson(JSON.stringify(data, null, 2));
            responseBody.innerHTML = `<pre style="margin:0">${formatted}</pre>`;
        } else {
            responseBody.textContent = String(data);
        }
    } catch (e) {
        responseBody.textContent = String(res.data);
    }
}

function handleError(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById('send');
    btn.textContent = 'Send';

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const responseBody = document.getElementById('response-body');

    statusBadge.textContent = res.cancelled ? 'Cancelled' : 'Error';
    statusBadge.className = 'badge badge-5xx';
    timeBadge.textContent = res.duration ? `${res.duration} ms` : '--';
    responseBody.innerHTML = `<div style="color: #f85149; padding: 8px;">⚠️ ${res.error || 'Unknown error'}</div>`;
}

function handleRetryAttempt(res) {
    const btn = document.getElementById('send');
    btn.textContent = `Retrying (${res.attempt}/${res.total})...`;
}

function populateCollectionsDropdown(collections) {
    const select = document.getElementById('save-collection');
    if (!select || !Array.isArray(collections)) return;
    select.innerHTML = collections.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (collections.length === 0) {
        select.innerHTML = '<option value="">No collections yet — create one first</option>';
    }
}