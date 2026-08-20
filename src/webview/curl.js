import { state } from './state.js';
import { notify, post, copyText } from './api.js';
import { constructFullUrl, hideModals, renderQueryParams, renderHeaders, serializeHeaders, showCopiedState } from './ui.js';
import { applyAuthHeaderToRawHeaders } from './auth.js';

export function exportToCurl() {
    let url = constructFullUrl();
    if (!url || url.trim() === '') { notify('error', 'Please enter a URL first'); return; }

    const methodSelect = document.getElementById('method');
    const bodyTextarea = document.getElementById('body');
    const method = methodSelect ? methodSelect.value : 'GET';
    const body = bodyTextarea ? bodyTextarea.value : '';

    let cmdParts = ['curl'];

    // Insecure flag if SSL verification disabled
    if (state.settings && state.settings.sslVerify === false) {
        cmdParts.push('-k');
    }

    if (method && method !== 'GET') {
        cmdParts.push(`-X ${method}`);
    }

    // Basic Auth flag (-u user:pass)
    if (state.authConfig && state.authConfig.type === 'basic') {
        const user = state.authConfig.username || '';
        const pass = state.authConfig.password || '';
        if (user || pass) {
            cmdParts.push(`-u "${user.replace(/"/g, '\\"')}:${pass.replace(/"/g, '\\"')}"`);
        }
    }

    // API Key Query Param flag
    if (state.authConfig && state.authConfig.type === 'apikey' && state.authConfig.keyIn === 'query') {
        const kName = state.authConfig.keyName || '';
        const kVal = state.authConfig.keyValue || '';
        if (kName && kVal) {
            const sep = url.includes('?') ? '&' : '?';
            url += `${sep}${encodeURIComponent(kName)}=${encodeURIComponent(kVal)}`;
        }
    }

    cmdParts.push(`"${url.replace(/"/g, '\\"')}"`);

    // Apply wire headers (including Bearer, API Key Header, OAuth Token)
    const rawHeaders = serializeHeaders();
    const headers = applyAuthHeaderToRawHeaders(rawHeaders);

    if (headers && headers.trim()) {
        headers.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#')) {
                cmdParts.push(`-H "${trimmed.replace(/"/g, '\\"')}"`);
            }
        });
    }

    if (body && body.trim()) {
        try {
            const escaped = JSON.stringify(JSON.parse(body)).replace(/"/g, '\\"');
            cmdParts.push(`-d "${escaped}"`);
        } catch {
            const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            cmdParts.push(`-d "${escaped}"`);
        }
    }

    copyText(cmdParts.join(' \\\n  '), document.getElementById('export-curl'));
}

export async function copyToClipboard(text, successMessage) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            if (successMessage) { notify('info', successMessage); }
            return true;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success && successMessage) { notify('info', successMessage); }
        if (!success) { notify('error', '❌ Failed to copy to clipboard'); }
        return success;
    } catch {
        notify('error', '❌ Failed to copy to clipboard');
        return false;
    }
}

export function showCurlImportModal() {
    const modal = document.getElementById('curl-import-modal');
    const input = document.getElementById('curl-import-input');
    if (modal) { 
        modal.style.display = 'block';
        modal.classList.add('modal-visible'); 
    }
    if (input) { input.value = ''; input.focus(); }
}

export function executeCurlImport() {
    const input = document.getElementById('curl-import-input');
    const curlText = input ? input.value.trim() : '';
    if (!curlText) { notify('error', 'Please paste a cURL command'); return; }

    post({ type: 'importCurl', curl: curlText });
    hideModals();
    if (input) {input.value = '';}
}