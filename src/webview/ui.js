import { state } from './state.js';
import { notify, post } from './api.js';

export function updatePreview() {
    if (state.isUpdatingPreview) { return; }
    state.isUpdatingPreview = true;

    const environmentSelect = document.getElementById('environment');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const envName = environmentSelect ? environmentSelect.value : 'none';

    if (envName === 'none') {
        hideAllPreviews();
        state.isUpdatingPreview = false;
        return;
    }

    post({
        type: 'previewVariables',
        environment: envName,
        inputs: {
            url: constructFullUrl(),
            headers: headersTextarea ? headersTextarea.value : '',
            body: bodyTextarea ? bodyTextarea.value : ''
        }
    });

    setTimeout(() => { state.isUpdatingPreview = false; }, 50);
}

export function escapeHtml(text) {
    if (!text) { return ''; }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById(tabName + '-tab');
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabContent) { tabContent.classList.add('active'); }
    if (tabButton) { tabButton.classList.add('active'); }
}

export function switchResponseTab(tabName) {
    document.querySelectorAll('.response-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.response-tab-button').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById('response-' + tabName + '-tab');
    const tabButton = document.querySelector(`[data-response-tab="${tabName}"]`);
    if (tabContent) { tabContent.classList.add('active'); }
    if (tabButton) { tabButton.classList.add('active'); }
}

export function hideModals() {
    document.querySelectorAll('.modal').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('modal-visible');
    });
}

export let currentConfirmCallback = null;

export function confirmAction(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    document.getElementById('confirm-modal-message').textContent = message;
    currentConfirmCallback = onConfirm;
    modal.style.display = 'block';
}

export function executeConfirmAction() {
    if (currentConfirmCallback) currentConfirmCallback();
    hideModals();
}

export function hideAllPreviews() {
    const urlPreview = document.getElementById('url-preview');
    const headersPreview = document.getElementById('headers-preview');
    const bodyPreview = document.getElementById('body-preview');
    [urlPreview, headersPreview, bodyPreview].forEach(el => {
        if (el) { el.classList.add('preview-hidden'); el.classList.remove('preview-visible'); }
    });
}

export function showPreview(urlResult, headersResult, bodyResult, errors) {
    const updateBlock = (element, result, hasError) => {
        if (!element) { return; }
        if (result && result.trim() !== '') {
            element.textContent = hasError ? 'Error resolving variables' : `Resolved: ${result}`;
            element.style.display = 'block';
            element.className = hasError ? 'preview-hint error' : 'preview-hint';
        } else {
            element.style.display = 'none';
        }
    };
    updateBlock(document.getElementById('url-preview'), urlResult, errors.url);
    updateBlock(document.getElementById('headers-preview'), headersResult, errors.headers);
    updateBlock(document.getElementById('body-preview'), bodyResult, errors.body);
}

export function constructFullUrl() {
    const urlInput = document.getElementById('url');
    if (!urlInput) { return ''; }
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) { return ''; }
    const validParams = state.queryParams.filter(p => p.key && p.value);
    if (validParams.length > 0) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const queryString = validParams
            .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
            .join('&');
        return `${baseUrl}${separator}${queryString}`;
    }
    return baseUrl;
}

export function renderQueryParams() {
    const container = document.getElementById('query-params-list');
    if (!container) { return; }
    container.innerHTML = '';
    state.queryParams.forEach((param, index) => {
        const row = document.createElement('div');
        row.className = 'query-param-row flex-row';
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
            <input type="text" class="param-key param-input" placeholder="Key" value="${escapeHtml(param.key)}">
            <input type="text" class="param-value param-input" placeholder="Value" value="${escapeHtml(param.value)}">
            <button class="remove-btn remove-param-btn" title="Remove parameter">❌</button>
        `;
        row.querySelector('.param-key').addEventListener('input', (e) => {
            state.queryParams[index].key = e.target.value;
        });
        row.querySelector('.param-value').addEventListener('input', (e) => {
            state.queryParams[index].value = e.target.value;
        });
        row.querySelector('.remove-btn').addEventListener('click', () => {
            state.queryParams.splice(index, 1);
            renderQueryParams();
        });
        container.appendChild(row);
    });
}

export function updateEnvironmentIndicator(env) {
    const envIndicator = document.getElementById('env-indicator');
    if (envIndicator) {
        envIndicator.textContent = env === 'none' ? 'No Environment' : env;
        envIndicator.className = 'env-indicator';
        if (env === 'production') { envIndicator.classList.add('env-production'); }
        else if (env === 'development') { envIndicator.classList.add('env-development'); }
        else if (env === 'staging') { envIndicator.classList.add('env-staging'); }
    }
}

export function updateVariableCount(envName) {
    const envCount = document.getElementById('env-count');
    if (!envCount) { return; }
    if (envName === 'none') {
        envCount.textContent = '0 variables';
    } else {
        const env = state.environments.find(e => e.name === envName);
        const count = env ? Object.keys(env.variables).length : 0;
        envCount.textContent = `${count} variable${count !== 1 ? 's' : ''}`;
    }
}