import { state } from './state.js';

export function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById(tabName + '-tab');
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabContent) {tabContent.classList.add('active');}
    if (tabButton) {tabButton.classList.add('active');}
}

export function escapeHtml(text) {
    if (!text) {return '';}
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function confirmAction(message, onConfirm) {
    if (window.confirm(message)) {
        onConfirm();
    }
}

// --- Query Params ---

export function renderQueryParams() {
    const container = document.getElementById('params-list');
    if (!container) {return;}
    container.innerHTML = '';
    state.queryParams.forEach((param, index) => {
        container.appendChild(_makeKVRow(param, index, 'queryParams', updateParamsCount));
    });
    updateParamsCount();
}

// --- Headers ---

export function renderHeaders() {
    const container = document.getElementById('headers-list');
    if (!container) {return;}
    container.innerHTML = '';
    state.headers.forEach((header, index) => {
        container.appendChild(_makeKVRow(header, index, 'headers', updateHeadersCount));
    });
    updateHeadersCount();
}

// Shared key-value row builder used by both params and headers
function _makeKVRow(item, index, stateKey, onUpdate) {
    const row = document.createElement('div');
    row.className = 'kv-row';

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'url-input kv-key';
    keyInput.placeholder = 'Key';
    keyInput.value = escapeHtml(item.key);
    keyInput.addEventListener('input', e => {
        state[stateKey][index].key = e.target.value;
        if (onUpdate) {onUpdate();}
    });

    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'url-input kv-value';
    valInput.placeholder = 'Value';
    valInput.value = escapeHtml(item.value);
    valInput.addEventListener('input', e => {
        state[stateKey][index].value = e.target.value;
        if (onUpdate) {onUpdate();}
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'tool-btn kv-remove';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
        state[stateKey].splice(index, 1);
        stateKey === 'headers' ? renderHeaders() : renderQueryParams();
    });

    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
}

// Badge counters on tabs
function updateParamsCount() {
    const el = document.getElementById('params-count');
    if (!el) {return;}
    const n = state.queryParams.filter(p => p.key).length;
    el.textContent = n > 0 ? String(n) : '';
}

function updateHeadersCount() {
    const el = document.getElementById('headers-count');
    if (!el) {return;}
    const n = state.headers.filter(h => h.key).length;
    el.textContent = n > 0 ? String(n) : '';
}

// --- Serialisation helpers ---

/** Convert state.headers array → "Key: Value\n..." string for the request */
export function serializeHeaders() {
    return state.headers
        .filter(h => h.key && h.key.trim())
        .map(h => `${h.key.trim()}: ${h.value.trim()}`)
        .join('\n');
}

/** Parse "Key: Value\n..." string → state.headers array */
export function parseHeadersIntoState(raw) {
    if (!raw) { state.headers = []; return; }
    state.headers = raw
        .split('\n')
        .map(line => {
            const idx = line.indexOf(':');
            if (idx < 1) {return null;}
            return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
        })
        .filter(Boolean);
}

// --- URL builder ---

export function constructFullUrl() {
    const urlInput = document.getElementById('url');
    if (!urlInput) {return '';}
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) {return '';}
    const validParams = state.queryParams.filter(p => p.key && p.value);
    if (validParams.length > 0) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const qs = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        return `${baseUrl}${separator}${qs}`;
    }
    return baseUrl;
}

// --- Environment badge ---

export function updateEnvironmentIndicator(envName) {
    const badge = document.getElementById('env-badge');
    if (!badge) {return;}
    badge.textContent = envName === 'none' ? 'No Environment' : envName;
    const isProd = envName.toLowerCase().includes('prod');
    badge.style.color = isProd ? '#f85149' : '#58a6ff';
    badge.style.background = isProd ? 'rgba(248,81,73,0.15)' : 'rgba(56,139,253,0.15)';
}

// --- Modals ---

export function hideModals() {
    document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
}

// --- Response Tabs ---

export function switchResponseTab(tabName) {
    document.querySelectorAll('.response-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.res-tab-btn').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById(`response-${tabName}-tab`);
    const tabButton = document.querySelector(`[data-res-tab="${tabName}"]`);
    if (tabContent) {tabContent.classList.add('active');}
    if (tabButton) {tabButton.classList.add('active');}
}

export function renderResponseHeaders(headers) {
    const container = document.getElementById('response-headers-list');
    const badge = document.getElementById('res-headers-count');
    if (!container) {return;}

    if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
        container.innerHTML = `<div class="fg-muted" style="text-align:center;margin-top:20px;">No response headers received</div>`;
        if (badge) {badge.textContent = '';}
        return;
    }

    const headerKeys = Object.keys(headers);
    if (badge) {badge.textContent = String(headerKeys.length);}

    let html = `<table class="res-header-table"><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>`;
    for (const key of headerKeys) {
        const val = typeof headers[key] === 'object' ? JSON.stringify(headers[key]) : String(headers[key]);
        html += `<tr><td class="res-header-key">${escapeHtml(key)}</td><td class="res-header-val">${escapeHtml(val)}</td></tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// --- SSL indicator ---

export function updateSslIndicator(sslVerify) {
    const badge = document.getElementById('ssl-badge');
    if (!badge) {return;}
    badge.style.display = sslVerify === false ? 'inline-block' : 'none';
}

// --- JSON syntax highlighting ---

export function syntaxHighlightJson(json) {
    if (typeof json !== 'string') {json = JSON.stringify(json, null, 2);}
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
        match => {
            let cls = 'json-number';
            if (/^"/.test(match)) {cls = /:$/.test(match) ? 'json-key' : 'json-string';}
            else if (/true|false/.test(match)) {cls = 'json-boolean';}
            else if (/null/.test(match)) {cls = 'json-null';}
            return `<span class="${cls}">${match}</span>`;
        }
    );
}