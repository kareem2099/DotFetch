import { showToast, showCopiedState } from './ui.js';

let _vscode = null;

export function initApi(vscode) {
    _vscode = vscode;
}

export function post(message) {
    _vscode.postMessage(message);
}

export function notify(level, text) {
    // Show in-webview toast for all levels (info, success, warning, error)
    showToast(level, text);

    // Keep extension-level notification for errors
    if (level === 'error') {
        _vscode.postMessage({ type: 'notify', level, text });
    }
}

export function copyText(text, button) {
    if (text === null || text === undefined) { return; }

    // 1. Native VS Code host clipboard (always succeeds in VS Code webview iframe)
    if (_vscode) {
        _vscode.postMessage({ type: 'copyToClipboard', text: String(text) });
    }

    // 2. Client-side browser clipboard fallback
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(String(text)).catch(() => {});
        }
    } catch {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = String(text);
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            textarea.style.left = '-9999px';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        } catch {}
    }

    // 3. Show instant inline green '✓ Copied' feedback on button
    if (button) {
        showCopiedState(button);
    }
}

export function saveVsState(state) {
    _vscode.setState(state);
}