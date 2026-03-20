import { state } from './state.js';
import { notify } from './api.js';
import { constructFullUrl, hideModals, renderQueryParams } from './ui.js';

export function exportToCurl() {
    const url = constructFullUrl();
    if (!url || url.trim() === '') { notify('error', 'Please enter a URL first'); return; }
    const methodSelect = document.getElementById('method');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const method = methodSelect ? methodSelect.value : 'GET';
    const headers = headersTextarea ? headersTextarea.value : '';
    const body = bodyTextarea ? bodyTextarea.value : '';
    let cmdParts = ['curl'];
    if (method !== 'GET') { cmdParts.push('-X', method); }
    cmdParts.push(`"${url.replace(/"/g, '\\"')}"`);
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
        } catch (e) {
            const escaped = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            cmdParts.push(`-d "${escaped}"`);
        }
    }
    copyToClipboard(cmdParts.join(' \\\n  '), 'cURL command copied to clipboard');
}

export function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            notify('info', successMessage);
        }).catch(() => notify('error', '❌ Failed to copy to clipboard'));
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try { document.execCommand('copy'); notify('info', successMessage); }
        catch { notify('error', '❌ Failed to copy to clipboard'); }
        finally { document.body.removeChild(textarea); }
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
    const curlInput = document.getElementById('curl-import-input');
    if (!curlInput) { return; }
    const curlText = curlInput.value.trim();
    if (!curlText) { notify('error', 'Please paste a cURL command'); return; }
    try {
        const methodSelect = document.getElementById('method');
        const urlInput = document.getElementById('url');
        const headersTextarea = document.getElementById('headers');
        const bodyTextarea = document.getElementById('body');
        const methodMatch = curlText.match(/-X\s+(\w+)/i) || curlText.match(/--request\s+(\w+)/i);
        if (methodMatch && methodSelect) { methodSelect.value = methodMatch[1].toUpperCase(); }
        else if (methodSelect) { methodSelect.value = 'GET'; }
        const urlMatch = curlText.match(/["'](https?:\/\/[^"']+)["']/) || curlText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
            const fullUrl = urlMatch[1];
            if (fullUrl.includes('?')) {
                const [base, query] = fullUrl.split('?');
                if (urlInput) { urlInput.value = base; }
                state.queryParams = query.split('&').map(param => {
                    const [key = '', value = ''] = param.split('=');
                    return { key: decodeURIComponent(key), value: decodeURIComponent(value) };
                }).filter(p => p.key);
                renderQueryParams();
            } else {
                if (urlInput) { urlInput.value = fullUrl; }
                state.queryParams = [];
                renderQueryParams();
            }
        }
        const headerRegex = /-H\s+["']([^"']+)["']/g;
        let headerMatch;
        const headersList = [];
        while ((headerMatch = headerRegex.exec(curlText)) !== null) { headersList.push(headerMatch[1]); }
        if (headersTextarea) { headersTextarea.value = headersList.join('\n'); }
        const dataMatch = curlText.match(/-d\s+['"]([^'"]+)['"]/) || curlText.match(/--data\s+['"]([^'"]+)['"]/);
        if (dataMatch && bodyTextarea) {
            try { bodyTextarea.value = JSON.stringify(JSON.parse(dataMatch[1]), null, 2); }
            catch { bodyTextarea.value = dataMatch[1]; }
        } else if (bodyTextarea) { bodyTextarea.value = ''; }
        hideModals();
        notify('info', '✅ cURL imported successfully!');
    } catch (e) {
        notify('error', 'Error parsing cURL: ' + e.message);
    }
}