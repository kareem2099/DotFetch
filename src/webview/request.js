import { state } from './state.js';
import { post, notify } from './api.js';
import { constructFullUrl, renderQueryParams, switchTab, updatePreview } from './ui.js';
import { buildAuthHeader, restoreAuthUI } from './auth.js';
import { saveState } from './collections.js';

export async function sendRequest() {
    const sendButton = document.getElementById('send');
    
    if (state.isRequestInProgress) {
        post({ type: 'cancelRequest' });
        if (sendButton) { sendButton.textContent = 'Send'; }
        state.isRequestInProgress = false;
        return;
    }

    const methodSelect = document.getElementById('method');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const environmentSelect = document.getElementById('environment');
    const retryCountInput = document.getElementById('retry-count');
    const notesTextarea = document.getElementById('request-notes');

    const method = methodSelect ? methodSelect.value : 'GET';
    const url = constructFullUrl();
    const headers = headersTextarea ? headersTextarea.value : '';
    const body = bodyTextarea ? bodyTextarea.value : '';
    const notes = notesTextarea ? notesTextarea.value : '';
    const selectedEnvironment = environmentSelect ? environmentSelect.value : 'none';
    const retryCount = retryCountInput ? parseInt(retryCountInput.value) || 0 : 0;

    let finalHeaders = headers;
    const authHeader = buildAuthHeader();
    if (authHeader) {
        const hasAuthHeader = finalHeaders.toLowerCase().includes('authorization:');
        if (!hasAuthHeader) {
            finalHeaders = finalHeaders.trim() ? `${finalHeaders.trim()}\n${authHeader}` : authHeader;
        }
    }

    if (!url || url.trim() === '') { notify('error', 'URL is required'); return; }

    state.currentRequest = { method, url, headers, body, notes };
    if (sendButton) { sendButton.textContent = 'Cancel ✕'; }
    state.isRequestInProgress = true;

    post({
        type: 'sendRequest',
        method, url,
        headers: finalHeaders,
        body,
        timeout: state.settings.timeout || 10000,
        environment: selectedEnvironment,
        retryCount: Math.min(Math.max(retryCount, 0), 5)
    });
}

export function clearRequestForm() {
    const methodSelect = document.getElementById('method');
    const urlInput = document.getElementById('url');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('request-notes');
    const authTypeSelect = document.getElementById('auth-type');
    const basicAuthFields = document.getElementById('basic-auth-fields');
    const bearerAuthFields = document.getElementById('bearer-auth-fields');

    if (methodSelect) { methodSelect.value = 'GET'; }
    if (urlInput) { urlInput.value = ''; }
    if (headersTextarea) { headersTextarea.value = ''; }
    if (bodyTextarea) { bodyTextarea.value = ''; }
    if (notesTextarea) { notesTextarea.value = ''; }
    state.queryParams = [];
    renderQueryParams();

    state.authConfig = { type: 'none', username: '', password: '', token: '' };
    if (authTypeSelect) { authTypeSelect.value = 'none'; }
    if (basicAuthFields) { basicAuthFields.classList.add('hidden-element'); }
    if (bearerAuthFields) { bearerAuthFields.classList.add('hidden-element'); }
}

export function loadRequestIntoForm(item) {
    if (!item) { return; }
    const methodSelect = document.getElementById('method');
    const urlInput = document.getElementById('url');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('request-notes');
    const authTypeSelect = document.getElementById('auth-type');
    const basicAuthFields = document.getElementById('basic-auth-fields');
    const bearerAuthFields = document.getElementById('bearer-auth-fields');

    if (methodSelect) { methodSelect.value = item.method || 'GET'; }

    if (item.queryParams && item.queryParams.length > 0) {
        if (urlInput) { urlInput.value = item.url.split('?')[0]; }
        state.queryParams = item.queryParams.map(p => ({ ...p }));
    } else {
        try {
            const urlObj = new URL(item.url);
            if (urlInput) { urlInput.value = urlObj.origin + urlObj.pathname; }
            state.queryParams = [];
            urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
        } catch (e) {
            const [baseUrl, queryString] = item.url.split('?');
            if (urlInput) { urlInput.value = baseUrl; }
            state.queryParams = queryString
                ? queryString.split('&').map(param => {
                    const eqIndex = param.indexOf('=');
                    if (eqIndex === -1) { return { key: decodeURIComponent(param), value: '' }; }
                    return { key: decodeURIComponent(param.substring(0, eqIndex)), value: decodeURIComponent(param.substring(eqIndex + 1)) };
                }).filter(p => p.key)
                : [];
        }
    }

    if (headersTextarea) { headersTextarea.value = item.headers || ''; }
    if (bodyTextarea) { bodyTextarea.value = item.body || ''; }
    if (notesTextarea) { notesTextarea.value = item.notes || ''; }

    if (item.auth) {
        restoreAuthUI(item.auth);
    } else {
        state.authConfig = { type: 'none', username: '', password: '', token: '' };
        if (authTypeSelect) { authTypeSelect.value = 'none'; }
        if (basicAuthFields) { basicAuthFields.classList.add('hidden-element'); }
        if (bearerAuthFields) { bearerAuthFields.classList.add('hidden-element'); }
    }

    renderQueryParams();
    switchTab('request');
}

export function validateCurrentRequest() {
    const environmentSelect = document.getElementById('environment');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const envName = environmentSelect ? environmentSelect.value : 'none';
    post({
        type: 'validateVariables',
        environment: envName,
        inputs: {
            url: constructFullUrl(),
            headers: headersTextarea ? headersTextarea.value : '',
            body: bodyTextarea ? bodyTextarea.value : ''
        }
    });
}

export function saveRequest() {
    const nameInput = document.getElementById('save-name');
    const collSelect = document.getElementById('save-collection');
    const methodSelect = document.getElementById('method');
    const urlInput = document.getElementById('url');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('request-notes');

    if (!nameInput || !collSelect) { return; }
    const name = nameInput.value.trim();
    const collection = collSelect.value;
    if (!name) { notify('error', 'Please enter a request name'); return; }
    if (!collection) { notify('error', 'Please select a collection'); return; }

    const reqToSave = {
        name,
        method: methodSelect ? methodSelect.value : 'GET',
        url: urlInput ? urlInput.value : '',
        headers: headersTextarea ? headersTextarea.value : '',
        body: bodyTextarea ? bodyTextarea.value : '',
        notes: notesTextarea ? notesTextarea.value : '',
        queryParams: [...state.queryParams],
        auth: { ...state.authConfig }
    };

    if (!state.collections[collection]) { state.collections[collection] = []; }
    state.collections[collection].push(reqToSave);
    saveState();

    import('./collections.js').then(m => {
        m.renderCollections();
        m.updateSaveCollectionOptions();
    });

    import('./ui.js').then(m => m.hideModals());
    nameInput.value = '';
    notify('info', `Request saved to "${collection}"`);
}