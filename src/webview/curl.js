import { state } from './state.js';
import { notify, post } from './api.js';
import { constructFullUrl, hideModals, renderQueryParams, renderHeaders } from './ui.js';

export function exportToCurl() {
    const url = constructFullUrl();
    if (!url || url.trim() === '') { notify('error', 'Please enter a URL first'); return; }
    const methodSelect = document.getElementById('method');
    const bodyTextarea = document.getElementById('body');
    const method = methodSelect ? methodSelect.value : 'GET';
    const headers = state.headers.filter(h => h.key.trim()).map(h => `${h.key.trim()}: ${h.value.trim()}`).join('\n');
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
    const input = document.getElementById('curl-import-input');
    const curlText = input ? input.value.trim() : '';
    if (!curlText) { notify('error', 'Please paste a cURL command'); return; }

    post({ type: 'importCurl', curl: curlText });
    hideModals();
    if (input) {input.value = '';}
}