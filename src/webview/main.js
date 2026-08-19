import { state } from './state.js';
import { initApi, post, notify } from './api.js';
import {
    switchTab, renderQueryParams, renderHeaders,
    updateEnvironmentIndicator, syntaxHighlightJson,
    hideModals, switchResponseTab, renderResponseHeaders, updateSslIndicator
} from './ui.js';
import { renderAuthFields, handleOAuthTokenResult } from './auth.js';
import { sendRequest, getRequestData, loadRequestIntoForm, saveRequest } from './request.js';
import { exportToCurl, showCurlImportModal, executeCurlImport } from './curl.js';
import { handleKeyboardShortcuts } from './shortcuts.js';

window.addEventListener('load', () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
    renderHeaders();
    renderAuthFields('none');
    post({ type: 'webviewReady' });
});

function setupEventListeners() {
    // Request Tabs switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Response Tabs switching
    document.querySelectorAll('.res-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchResponseTab(btn.dataset.resTab));
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
    });

    // SSL Verify checkbox
    document.getElementById('ssl-verify')?.addEventListener('change', e => {
        state.settings.sslVerify = e.target.checked;
        updateSslIndicator(e.target.checked);
        notify('info', e.target.checked ? 'SSL Certificate verification enabled' : '⚠️ SSL Certificate verification disabled');
    });

    // Export cURL
    document.getElementById('export-curl')?.addEventListener('click', exportToCurl);

    // Import cURL
    document.getElementById('import-curl')?.addEventListener('click', showCurlImportModal);
    document.getElementById('confirm-curl-import')?.addEventListener('click', executeCurlImport);
    document.getElementById('cancel-curl-import')?.addEventListener('click', hideModals);

    // Favorite
    document.getElementById('favorite-btn')?.addEventListener('click', () => {
        const url = document.getElementById('url')?.value?.trim();
        if (!url) {
            notify('error', 'Add a URL before saving to favorites');
            return;
        }

        post({ type: 'toggleFavorite', request: getRequestData({ forSend: false }) });
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
    document.getElementById('confirm-save')?.addEventListener('click', saveRequest);
    document.getElementById('cancel-save')?.addEventListener('click', hideModals);

    // Copy response
    document.getElementById('copy-response')?.addEventListener('click', () => {
        const activeResTab = document.querySelector('.res-tab-btn.active')?.dataset.resTab;
        if (activeResTab === 'headers') {
            const headers = state.lastResponseHeaders || {};
            const text = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
            navigator.clipboard.writeText(text);
            notify('info', 'Response headers copied to clipboard');
        } else {
            const body = document.getElementById('response-body')?.textContent || '';
            navigator.clipboard.writeText(body);
            notify('info', 'Response copied to clipboard');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Extension messages
    window.addEventListener('message', handleMessage);
}

// --- Extension message handler ---

function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
        case 'environments':
            state.environments = msg.environments || [];
            state.activeEnvironment = msg.activeEnvironment || 'none';
            updateEnvironmentIndicator(state.activeEnvironment);
            break;
        case 'loadRequest':
            loadRequestIntoForm(msg.data || msg.request, msg.collectionName);
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
        case 'oauthTokenResult':
            handleOAuthTokenResult(msg);
            break;
    }
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
    if (timeBadge) {timeBadge.textContent = `${res.duration} ms`;}
    if (sizeBadge) {sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : '-- KB';}

    // Store and render headers
    state.lastResponseHeaders = res.headers || {};
    renderResponseHeaders(res.headers);

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
    if (timeBadge) {timeBadge.textContent = res.duration ? `${res.duration} ms` : '--';}
    if (responseBody) {
        const errorMessage = res.error || res.message || 'Network request failed';
        responseBody.replaceChildren();
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#f85149';
        errorDiv.style.padding = '8px';
        errorDiv.textContent = `⚠️ ${errorMessage}`;
        responseBody.appendChild(errorDiv);
    }

    state.lastResponseHeaders = {};
    renderResponseHeaders({});
}

// --- Collections dropdown ---

function populateCollectionsDropdown(collections) {
    const select = document.getElementById('save-collection');
    if (!select || !Array.isArray(collections)) {return;}
    select.innerHTML = collections.length
        ? collections.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        : '<option value="">No collections yet — create one first</option>';
    
    // Auto-select the collection if we loaded from one
    if (state.lastLoadedCollection) {
        select.value = state.lastLoadedCollection;
    }
}