import { state } from './state.js';
import { saveState } from './collections.js';
import { notify } from './api.js';
import { sendRequest, clearRequestForm } from './request.js';
import { hideModals } from './ui.js';

export function setupShortcutsUI() {
    const shortcutInputs = document.querySelectorAll('.shortcut-input');
    const shortcutError = document.getElementById('shortcut-error');
    shortcutInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {return;}
            e.preventDefault();
            e.stopPropagation();

            let keys = [];
            if (e.ctrlKey || e.metaKey) {keys.push('ctrl');}
            if (e.shiftKey) {keys.push('shift');}
            if (e.altKey) {keys.push('alt');}
            
            let key = e.key.toLowerCase();
            if (['control', 'meta', 'shift', 'alt'].includes(key)) {return;}
            if (key === ' ') {key = 'space';}
            
            keys.push(key);
            const newShortcut = keys.join('+');
            const action = input.dataset.action;

            const conflict = Object.entries(state.settings.shortcuts || {}).find(([a, s]) => s === newShortcut && a !== action);
            if (conflict) {
                if (shortcutError) {
                    shortcutError.textContent = `Conflict: '${newShortcut}' is used by '${conflict[0]}'`;
                    shortcutError.style.display = 'inline';
                    setTimeout(() => shortcutError.style.display = 'none', 3000);
                }
                return;
            }

            if (!state.settings.shortcuts) {state.settings.shortcuts = {};}
            state.settings.shortcuts[action] = newShortcut;
            input.value = newShortcut;
            saveState();
            if (shortcutError) {shortcutError.style.display = 'none';}
        });
    });

    document.getElementById('reset-shortcuts')?.addEventListener('click', () => {
        state.settings.shortcuts = {
            sendRequest: 'ctrl+enter',
            saveRequest: 'ctrl+s',
            clearForm: 'ctrl+k',
            closeModal: 'escape'
        };
        shortcutInputs.forEach(input => {
            input.value = state.settings.shortcuts[input.dataset.action] || '';
        });
        saveState();
        notify('info', 'Shortcuts reset to defaults');
    });
}

function matchesShortcut(e, shortcutStr) {
    if (!shortcutStr) {return false;}
    const parts = shortcutStr.toLowerCase().split('+');
    const requiresCtrl = parts.includes('ctrl') || parts.includes('cmd');
    const requiresShift = parts.includes('shift');
    const requiresAlt = parts.includes('alt');
    const key = parts[parts.length - 1];

    const hasCtrl = e.ctrlKey || e.metaKey;
    if (requiresCtrl !== hasCtrl) {return false;}
    if (requiresShift !== e.shiftKey) {return false;}
    if (requiresAlt !== e.altKey) {return false;}

    let eKey = e.key.toLowerCase();
    if (eKey === ' ') {eKey = 'space';}
    
    return eKey === key;
}

export function handleKeyboardShortcuts(e) {
    if (e.target && e.target.classList && e.target.classList.contains('shortcut-input')) {return;}

    const shortcuts = state.settings.shortcuts || {
        sendRequest: 'ctrl+enter', saveRequest: 'ctrl+s', clearForm: 'ctrl+k', closeModal: 'escape'
    };

    if (matchesShortcut(e, shortcuts.sendRequest)) { e.preventDefault(); sendRequest(); }
    else if (matchesShortcut(e, shortcuts.closeModal)) { hideModals(); }
    else if (matchesShortcut(e, shortcuts.saveRequest)) { 
        e.preventDefault(); 
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {saveBtn.click();}
    }
    else if (matchesShortcut(e, shortcuts.clearForm)) { e.preventDefault(); clearRequestForm(); }
}
