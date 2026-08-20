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

export function showCopiedState(button, duration = 1600) {
    if (!button) { return; }
    const originalText = button.textContent;
    button.textContent = '✓ Copied';
    button.classList.add('copied');
    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, duration);
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
    row.className = 'kv-row' + (item.enabled === false ? ' disabled' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'kv-checkbox';
    checkbox.checked = item.enabled !== false;
    checkbox.title = 'Enable or disable row';
    checkbox.addEventListener('change', e => {
        state[stateKey][index].enabled = e.target.checked;
        row.classList.toggle('disabled', !e.target.checked);
        if (onUpdate) {onUpdate();}
    });

    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'url-input kv-key';
    keyInput.placeholder = 'Key';
    keyInput.value = item.key || '';
    keyInput.addEventListener('input', e => {
        state[stateKey][index].key = e.target.value;
        if (onUpdate) {onUpdate();}
    });

    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'url-input kv-value';
    valInput.placeholder = 'Value';
    valInput.value = item.value || '';
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

    row.appendChild(checkbox);
    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
}

// Badge counters on tabs
export function updateParamsCount() {
    const el = document.getElementById('params-count');
    if (!el) {return;}
    const n = state.queryParams.filter(p => p.enabled !== false && p.key && p.key.trim()).length;
    el.textContent = n > 0 ? String(n) : '';
}

export function updateHeadersCount() {
    const el = document.getElementById('headers-count');
    if (!el) {return;}
    const n = state.headers.filter(h => h.enabled !== false && h.key && h.key.trim()).length;
    el.textContent = n > 0 ? String(n) : '';
}

// --- Tab Dot Indicators & Method Colors ---

export function updateMethodColor(method) {
    const select = document.getElementById('method');
    if (!select) {return;}
    const m = (method || select.value || 'GET').toUpperCase();
    select.className = 'method-select method-' + m;
}

export function updateTabDots() {
    const authDot = document.getElementById('auth-dot');
    if (authDot) {
        const hasAuth = state.authConfig && state.authConfig.type && state.authConfig.type !== 'none';
        authDot.classList.toggle('hidden', !hasAuth);
    }
    const bodyDot = document.getElementById('body-dot');
    if (bodyDot) {
        const bodyEl = document.getElementById('body');
        const hasBody = Boolean(bodyEl && bodyEl.value && bodyEl.value.trim());
        bodyDot.classList.toggle('hidden', !hasBody);
    }
    const notesDot = document.getElementById('notes-dot');
    if (notesDot) {
        const notesEl = document.getElementById('notes');
        const hasNotes = Boolean(notesEl && notesEl.value && notesEl.value.trim());
        notesDot.classList.toggle('hidden', !hasNotes);
    }
}

// --- Serialisation helpers ---

/** Convert state.headers array → "Key: Value\n..." string for the request */
export function serializeHeaders() {
    return state.headers
        .filter(h => h.enabled !== false && h.key && h.key.trim())
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
            return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim(), enabled: true };
        })
        .filter(Boolean);
}

// --- URL builder ---

export function constructFullUrl() {
    const urlInput = document.getElementById('url');
    if (!urlInput) {return '';}
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) {return '';}
    const validParams = state.queryParams.filter(p => p.enabled !== false && p.key && p.value);
    if (validParams.length > 0) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const qs = validParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
        return `${baseUrl}${separator}${qs}`;
    }
    return baseUrl;
}

// --- Environment badge ---

export function updateEnvironmentIndicator(envName, varCount) {
    const badge = document.getElementById('env-badge');
    if (!badge) {return;}
    badge.textContent = envName === 'none' ? 'No Environment' : envName;
    const isProd = envName.toLowerCase().includes('prod');
    badge.style.color = isProd ? '#f85149' : '#58a6ff';
    badge.style.background = isProd ? 'rgba(248,81,73,0.15)' : 'rgba(56,139,253,0.15)';

    // Use custom CSS tooltip instead of native title (which clips at WebView edge)
    badge.removeAttribute('title');
    badge.tabIndex = 0;

    if (envName === 'none') {
        badge.dataset.tooltip = 'No active environment selected';
    } else {
        const countStr = typeof varCount === 'number'
            ? ` • ${varCount} variable${varCount === 1 ? '' : 's'}`
            : '';
        badge.dataset.tooltip = `Active Environment: ${envName}${countStr}`;
    }

    checkEnvVariableHint();
}

// --- Environment Variable Hint Banner ---

export function checkEnvVariableHint() {
    const banner = document.getElementById('env-hint-banner');
    if (!banner) {return;}

    const activeEnv = state.activeEnvironment || 'none';
    if (activeEnv !== 'none') {
        banner.classList.add('hidden');
        return;
    }

    const url = document.getElementById('url')?.value || '';
    const body = document.getElementById('body')?.value || '';
    const headerStr = state.headers.map(h => `${h.key} ${h.value}`).join(' ');
    const combined = `${url} ${headerStr} ${body}`;

    const varMatch = combined.match(/\{\{([a-zA-Z0-9_-]+)\}\}/);
    if (varMatch) {
        const varName = varMatch[1];
        banner.innerHTML = `<span>⚠️ Variable <code>{{${escapeHtml(varName)}}}</code> detected, but <strong>No Environment</strong> is selected.</span>`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// --- In-Webview Toast Notification System ---

export function showToast(type, message, duration) {
    const container = document.getElementById('toast-container');
    if (!container) {return;}

    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;

    let icon = 'ℹ️';
    if (type === 'success') { icon = '✓'; }
    else if (type === 'warning') { icon = '⚠️'; }
    else if (type === 'error') { icon = '✕'; }

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button type="button" class="toast-close" title="Dismiss">✕</button>
    `;

    // Close button dismiss
    toast.querySelector('.toast-close')?.addEventListener('click', () => {
        dismissToast(toast);
    });

    // Limit to max 3 toasts
    while (container.children.length >= 3) {
        dismissToast(container.firstElementChild);
    }

    container.appendChild(toast);

    // Dynamic duration based on type if not explicitly passed
    let autoDuration = duration;
    if (!autoDuration) {
        if (type === 'error') { autoDuration = 5000; }
        else if (type === 'warning') { autoDuration = 4000; }
        else { autoDuration = 2500; }
    }

    const timer = setTimeout(() => {
        dismissToast(toast);
    }, autoDuration);

    toast._dismissTimer = timer;
}

function dismissToast(toast) {
    if (!toast || toast._dismissing) {return;}
    toast._dismissing = true;
    if (toast._dismissTimer) {clearTimeout(toast._dismissTimer);}
    toast.classList.add('toast-fade-out');
    setTimeout(() => {
        toast.remove();
    }, 200);
}

// --- Modals ---

export function hideModals() {
    document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
}

// --- Response Tabs & View Modes ---

export function switchResponseTab(tabName) {
    document.querySelectorAll('.response-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.res-tab-btn').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById(`response-${tabName}-tab`);
    const tabButton = document.querySelector(`[data-res-tab="${tabName}"]`);
    if (tabContent) {tabContent.classList.add('active');}
    if (tabButton) {tabButton.classList.add('active');}
}

export function switchResponseViewMode(mode) {
    state.responseViewMode = mode;
    const prettyBtn = document.getElementById('res-view-pretty');
    const rawBtn = document.getElementById('res-view-raw');

    if (prettyBtn) { prettyBtn.classList.toggle('active', mode === 'pretty'); }
    if (rawBtn) { rawBtn.classList.toggle('active', mode === 'raw'); }

    if (state.lastResponseRawData !== null && state.lastResponseRawData !== undefined) {
        renderResponseBody(state.lastResponseRawData);
    }
}

export function renderResponseBody(data) {
    const container = document.getElementById('response-body');
    if (!container) {return;}

    if (data === null || data === undefined) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚡</div>
                <div class="empty-title">Ready to Send</div>
                <div class="empty-desc">Send a request to inspect its response body, status, and headers.</div>
            </div>`;
        return;
    }

    const isPretty = state.responseViewMode === 'pretty';

    // If it's an object (JSON)
    if (typeof data === 'object') {
        if (isPretty) {
            const jsonStr = JSON.stringify(data, null, 2);
            container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);">${syntaxHighlightJson(jsonStr)}</pre>`;
        } else {
            const rawStr = JSON.stringify(data);
            container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;">${escapeHtml(rawStr)}</pre>`;
        }
        return;
    }

    // If it's a string (e.g. JSON string, HTML, or plain text)
    const strData = String(data);
    if (isPretty) {
        try {
            const parsed = JSON.parse(strData);
            if (typeof parsed === 'object' && parsed !== null) {
                container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);">${syntaxHighlightJson(JSON.stringify(parsed, null, 2))}</pre>`;
                return;
            }
        } catch {
            // Not valid JSON, display cleanly formatted text
        }
    }

    container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;">${escapeHtml(strData)}</pre>`;
}

export function renderResponseHeaders(headers) {
    const container = document.getElementById('response-headers-list');
    const badge = document.getElementById('res-headers-count');
    if (!container) {return;}

    if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-title">No Headers Yet</div>
                <div class="empty-desc">Response headers will appear here after sending a request.</div>
            </div>`;
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