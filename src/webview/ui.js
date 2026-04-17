import { state } from './state.js';
import { notify, post } from './api.js';

export function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const tabContent = document.getElementById(tabName + '-tab');
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    
    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
}

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function renderQueryParams() {
    const container = document.getElementById('params-list');
    if (!container) return;
    
    container.innerHTML = '';
    state.queryParams.forEach((param, index) => {
        const row = document.createElement('div');
        row.className = 'query-param-row';
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        
        row.innerHTML = `
            <input type="text" class="url-input param-key" placeholder="Key" value="${escapeHtml(param.key)}">
            <input type="text" class="url-input param-value" placeholder="Value" value="${escapeHtml(param.value)}">
            <button class="tool-btn remove-param" title="Remove">❌</button>
        `;
        
        row.querySelector('.param-key').addEventListener('input', (e) => {
            state.queryParams[index].key = e.target.value;
        });
        row.querySelector('.param-value').addEventListener('input', (e) => {
            state.queryParams[index].value = e.target.value;
        });
        row.querySelector('.remove-param').addEventListener('click', () => {
            state.queryParams.splice(index, 1);
            renderQueryParams();
        });
        container.appendChild(row);
    });
}

export function constructFullUrl() {
    const urlInput = document.getElementById('url');
    if (!urlInput) return '';
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) return '';
    
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

export function updateEnvironmentIndicator(envName) {
    const badge = document.getElementById('env-badge');
    if (badge) {
        badge.textContent = envName === 'none' ? 'No Environment' : envName;
        if (envName.toLowerCase().includes('prod')) {
            badge.style.color = '#f85149';
            badge.style.background = 'rgba(248, 81, 73, 0.15)';
        } else {
            badge.style.color = '#58a6ff';
            badge.style.background = 'rgba(56, 139, 253, 0.15)';
        }
    }
}

export function hideModals() {
    const modal = document.getElementById('save-modal');
    if (modal) modal.style.display = 'none';
}

export function syntaxHighlightJson(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
        var cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}