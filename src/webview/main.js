import { state } from './state.js';
import { initApi, post, notify, copyText } from './api.js';
import {
    switchTab, renderQueryParams, renderHeaders,
    updateEnvironmentIndicator, checkEnvVariableHint,
    hideModals, switchResponseTab, renderResponseHeaders, updateSslIndicator,
    updateMethodColor, updateTabDots, renderResponseBody, switchResponseViewMode, showCopiedState
} from './ui.js';
import { renderAuthFields, handleOAuthTokenResult } from './auth.js';
import { sendRequest, getRequestData, loadRequestIntoForm, saveRequest, clearRequestForm } from './request.js';
import { exportToCurl, showCurlImportModal, executeCurlImport } from './curl.js';
import { handleKeyboardShortcuts } from './shortcuts.js';

window.addEventListener('load', () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
    renderHeaders();
    renderAuthFields('none');
    updateMethodColor('GET');
    updateTabDots();
    checkEnvVariableHint();
    post({ type: 'webviewReady' });
});

function setupEventListeners() {
    // URL input listeners
    document.getElementById('url')?.addEventListener('input', () => {
        checkEnvVariableHint();
    });
    // Request Tabs switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Response Tabs switching
    document.querySelectorAll('.res-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchResponseTab(btn.dataset.resTab));
    });

    // Response View Mode switching (Pretty / Raw)
    document.getElementById('res-view-pretty')?.addEventListener('click', () => switchResponseViewMode('pretty'));
    document.getElementById('res-view-raw')?.addEventListener('click', () => switchResponseViewMode('raw'));

    // Method selection color update
    const methodSelect = document.getElementById('method');
    if (methodSelect) {
        methodSelect.addEventListener('change', e => updateMethodColor(e.target.value));
    }

    // Body & Notes dot listeners
    document.getElementById('body')?.addEventListener('input', updateTabDots);
    document.getElementById('notes')?.addEventListener('input', updateTabDots);

    // Send / Cancel
    document.getElementById('send')?.addEventListener('click', sendRequest);

    // Add param row
    document.getElementById('add-param')?.addEventListener('click', () => {
        state.queryParams.push({ key: '', value: '', enabled: true });
        renderQueryParams();
    });

    // Add header row
    document.getElementById('add-header')?.addEventListener('click', () => {
        state.headers.push({ key: '', value: '', enabled: true });
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

    // Shortcuts modal close
    document.getElementById('close-shortcuts-modal')?.addEventListener('click', hideModals);

    // Copy response
    document.getElementById('copy-response')?.addEventListener('click', e => {
        const activeResTab = document.querySelector('.res-tab-btn.active')?.dataset.resTab;
        const textToCopy = (activeResTab === 'headers')
            ? Object.entries(state.lastResponseHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
            : ((state.lastResponseRawData !== null && state.lastResponseRawData !== undefined)
                ? (typeof state.lastResponseRawData === 'object'
                    ? (state.responseViewMode === 'pretty' ? JSON.stringify(state.lastResponseRawData, null, 2) : JSON.stringify(state.lastResponseRawData))
                    : String(state.lastResponseRawData))
                : (document.getElementById('response-body')?.textContent || ''));

        copyText(textToCopy, e.currentTarget);
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
        case 'environments': {
            state.environments = msg.environments || [];
            state.activeEnvironment = msg.activeEnvironment || 'none';
            const activeEnvObj = state.environments.find(e => e.name === state.activeEnvironment);
            const varCount = activeEnvObj?.variables ? Object.keys(activeEnvObj.variables).length : 0;
            updateEnvironmentIndicator(state.activeEnvironment, varCount);
            break;
        }
        case 'focusUrl': {
            const urlInput = document.getElementById('url');
            if (urlInput) {
                urlInput.focus();
                urlInput.select();
            }
            break;
        }
        case 'triggerSend':
            sendRequest();
            break;
        case 'triggerClear':
            clearRequestForm();
            break;
        case 'triggerSave': {
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) { saveBtn.click(); }
            break;
        }
        case 'loadRequest':
            loadRequestIntoForm(msg.data || msg.request, msg.collectionName);
            break;
        case 'response':
            handleResponse(msg);
            break;
        case 'error':
            handleError(msg);
            break;
        case 'retryAttempt': {
            const sendBtn = document.getElementById('send');
            if (sendBtn) {
                const total = msg.total || msg.maxRetries || '?';
                sendBtn.innerHTML = `<span class="btn-spinner"></span> Retrying (${msg.attempt}/${total})...`;
                sendBtn.classList.add('loading', 'retry-mode');
            }
            break;
        }
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
        btn.classList.remove('loading', 'retry-mode');
    }

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const sizeBadge = document.getElementById('size-badge');

    if (statusBadge) {
        statusBadge.textContent = `${res.status} ${res.statusText}`;
        let statusClass = 'badge-2xx';
        if (res.status >= 300 && res.status < 400) {
            statusClass = 'badge-3xx';
        } else if (res.status >= 400 && res.status < 500) {
            statusClass = 'badge-4xx';
        } else if (res.status >= 500) {
            statusClass = 'badge-5xx';
        }
        statusBadge.className = `badge ${statusClass}`;
    }
    if (timeBadge) { timeBadge.textContent = `${res.duration} ms`; }
    if (sizeBadge) { sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : '-- KB'; }

    // Store and render response data & headers
    state.lastResponseRawData = res.data;
    state.lastResponseHeaders = res.headers || {};

    renderResponseBody(res.data);
    renderResponseHeaders(res.headers);
}

function handleError(res) {
    state.isRequestInProgress = false;
    state.lastResponseRawData = null;
    state.lastResponseHeaders = {};

    const btn = document.getElementById('send');
    if (btn) {
        btn.textContent = 'Send';
        btn.classList.remove('loading', 'retry-mode');
    }

    const statusBadge = document.getElementById('status-badge');
    const timeBadge = document.getElementById('time-badge');
    const sizeBadge = document.getElementById('size-badge');
    const responseBody = document.getElementById('response-body');

    if (statusBadge) {
        statusBadge.textContent = res.cancelled ? 'Cancelled' : 'Error';
        statusBadge.className = 'badge badge-5xx';
    }
    if (timeBadge) { timeBadge.textContent = res.duration ? `${res.duration} ms` : '--'; }
    if (sizeBadge) { sizeBadge.textContent = '-- KB'; }
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
    if (!select || !Array.isArray(collections)) { return; }
    select.innerHTML = collections.length
        ? collections.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
        : '<option value="">No collections yet — create one first</option>';

    // Auto-select the collection if we loaded from one
    if (state.lastLoadedCollection) {
        select.value = state.lastLoadedCollection;
    }
}