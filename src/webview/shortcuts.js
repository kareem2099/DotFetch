import { hideModals } from './ui.js';

export function toggleShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (!modal) { return; }
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

/**
 * Handles WebView-local keyboard interactions only.
 * Host-level actions (Send, Save, Focus URL, Clear) are routed through
 * VS Code keybindings → extension commands → postMessage to avoid conflicts.
 */
export function handleKeyboardShortcuts(e) {
    const isTyping = e.target &&
        (e.target.tagName === 'INPUT' ||
         e.target.tagName === 'TEXTAREA' ||
         e.target.tagName === 'SELECT');

    // '?' → Shortcuts help modal (outside text inputs)
    if (!isTyping && e.key === '?') {
        e.preventDefault();
        toggleShortcutsModal();
        return;
    }

    // Escape → close any open DotFetch modal
    if (e.key === 'Escape') {
        hideModals();
    }
}
