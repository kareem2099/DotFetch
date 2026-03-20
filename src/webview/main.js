import { state } from './state.js';
import { initApi, post, notify, saveVsState } from './api.js';
import { switchTab, switchResponseTab, hideModals, hideAllPreviews, showPreview,
         constructFullUrl, renderQueryParams, updateEnvironmentIndicator, updateVariableCount, updatePreview, confirmAction, executeConfirmAction } from './ui.js';
import { onAuthTypeChange, updateBasicAuthPreview, updateBearerAuthPreview } from './auth.js';
import { syntaxHighlightJson } from './highlighting.js';
import { renderHistory, addToHistory, clearHistory } from './history.js';
import { renderCollections, updateSaveCollectionOptions, showCollectionModal, createCollection,
         renderTemplateSelector, saveAsTemplate, confirmSaveAsTemplate, loadSelectedTemplate,
         deleteSelectedTemplate, saveState } from './collections.js';
import { exportToCurl, showCurlImportModal, executeCurlImport } from './curl.js';
import { sendRequest, clearRequestForm, validateCurrentRequest, saveRequest } from './request.js';
import { setupShortcutsUI, handleKeyboardShortcuts } from './shortcuts.js';

// ============================================================================
// INITIALIZATION
// ============================================================================
window.addEventListener('load', () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);

    setupEventListeners();
    renderQueryParams();
    loadEnvironments();

    post({ type: 'webviewReady', level: 'info', text: 'DotFetch is ready!' });
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    document.querySelectorAll('.response-tab-button').forEach(button => {
        button.addEventListener('click', () => switchResponseTab(button.dataset.responseTab));
    });

    // Request actions
    document.getElementById('send')?.addEventListener('click', sendRequest);
    document.getElementById('save-request')?.addEventListener('click', () => {
        import('./collections.js').then(m => m.updateSaveCollectionOptions());
        const modal = document.getElementById('save-modal');
        const nameInput = document.getElementById('save-name');
        if (modal) { 
            modal.style.display = 'block';
            modal.classList.add('modal-visible'); 
        }
        if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    });
    document.getElementById('export-curl')?.addEventListener('click', exportToCurl);
    document.getElementById('import-curl')?.addEventListener('click', showCurlImportModal);
    document.getElementById('validate-request')?.addEventListener('click', validateCurrentRequest);
    document.getElementById('add-query-param')?.addEventListener('click', () => {
        state.queryParams.push({ key: '', value: '' });
        renderQueryParams();
    });

    // History
    document.getElementById('clear-history')?.addEventListener('click', clearHistory);
    document.getElementById('history-search')?.addEventListener('input', (e) => {
        const clearBtn = document.getElementById('clear-history-search');
        if (clearBtn) {
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        }
        import('./history.js').then(m => m.renderHistory());
    });
    document.getElementById('clear-history-search')?.addEventListener('click', () => {
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.value = '';
            document.getElementById('clear-history-search').style.display = 'none';
            import('./history.js').then(m => m.renderHistory());
        }
    });

    // Collections
    document.getElementById('create-collection')?.addEventListener('click', showCollectionModal);

    // Modals
    document.querySelectorAll('.cancel').forEach(btn => btn.addEventListener('click', hideModals));
    document.getElementById('confirm-action-btn')?.addEventListener('click', executeConfirmAction);
    document.getElementById('confirm-save')?.addEventListener('click', saveRequest);
    document.getElementById('confirm-create-collection')?.addEventListener('click', createCollection);
    document.getElementById('confirm-import-curl')?.addEventListener('click', executeCurlImport);

    // Templates
    document.getElementById('save-as-template')?.addEventListener('click', saveAsTemplate);
    document.getElementById('confirm-save-template')?.addEventListener('click', confirmSaveAsTemplate);
    document.getElementById('load-template')?.addEventListener('click', loadSelectedTemplate);
    document.getElementById('delete-template')?.addEventListener('click', deleteSelectedTemplate);

    // Environment
    document.getElementById('environment')?.addEventListener('change', onEnvironmentChange);
    document.getElementById('refresh-environments')?.addEventListener('click', loadEnvironments);
    document.getElementById('toggle-variables')?.addEventListener('click', () => post({ type: 'toggleEnvironmentTree' }));

    // Auth
    document.getElementById('auth-type')?.addEventListener('change', onAuthTypeChange);
    document.getElementById('auth-username')?.addEventListener('input', updateBasicAuthPreview);
    document.getElementById('auth-password')?.addEventListener('input', updateBasicAuthPreview);
    document.getElementById('auth-token')?.addEventListener('input', updateBearerAuthPreview);

    // Live Preview
    ['url', 'headers', 'body'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if (state.isUpdatingPreview) { return; }
            clearTimeout(state.previewTimeout);
            state.previewTimeout = setTimeout(() => {
                state.isUpdatingPreview = true;
                updatePreview();
                setTimeout(() => { state.isUpdatingPreview = false; }, 100);
            }, 300);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Settings
    const timeoutInput = document.getElementById('timeout');
    if (timeoutInput && !timeoutInput.dataset.listenerAdded) {
        timeoutInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (value && value > 0 && value <= 300000) {
                state.settings.timeout = value;
                saveState();
                notify('info', `Timeout updated to ${value}ms`);
            } else {
                notify('error', 'Timeout must be between 1-300000ms');
                timeoutInput.value = state.settings.timeout;
            }
        });
        timeoutInput.dataset.listenerAdded = 'true';
    }

    // Initialize Shortcuts Configuration UI
    setupShortcutsUI();
}

function loadEnvironments() {
    post({ type: 'getEnvironments' });
    const btn = document.getElementById('refresh-environments');
    if (btn) {
        btn.classList.add('rotating');
        setTimeout(() => btn.classList.remove('rotating'), 1000);
    }
}

function onEnvironmentChange() {
    const environmentSelect = document.getElementById('environment');
    const selectedEnv = environmentSelect ? environmentSelect.value : 'none';
    updateEnvironmentIndicator(selectedEnv);
    updateVariableCount(selectedEnv);
    updatePreview();
}



// ============================================================================
// MESSAGE HANDLER
// ============================================================================
window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
        case 'loadState':
            if (message.state) {
                state.history = message.state.history || [];
                state.collections = message.state.collections || {};
                state.settings = message.state.settings || { timeout: 10000 };
                if (Object.keys(state.collections).length === 0) { state.collections['Default'] = []; }
                renderHistory();
                renderCollections();
                updateSaveCollectionOptions();
                renderTemplateSelector();
                state.settings = message.state.settings || { timeout: 10000 };
                if (!state.settings.shortcuts) {
                    state.settings.shortcuts = {
                        sendRequest: 'ctrl+enter',
                        saveRequest: 'ctrl+s',
                        clearForm: 'ctrl+k',
                        closeModal: 'escape'
                    };
                }
                const timeoutInput = document.getElementById('timeout');
                if (timeoutInput) { timeoutInput.value = state.settings.timeout || 10000; }
                
                document.querySelectorAll('.shortcut-input').forEach(input => {
                    input.value = state.settings.shortcuts[input.dataset.action] || '';
                });
                
                loadEnvironments();
            }
            break;

        case 'environments':
            state.environments = message.environments || [];
            const environmentSelect = document.getElementById('environment');
            const currentEnv = environmentSelect ? environmentSelect.value : 'none';
            if (environmentSelect) {
                environmentSelect.innerHTML = '<option value="none">No Environment</option>';
                state.environments.forEach(env => {
                    const opt = document.createElement('option');
                    opt.value = env.name;
                    const varCount = Object.keys(env.variables).length;
                    opt.textContent = `${env.name} (${varCount} var${varCount !== 1 ? 's' : ''})`;
                    environmentSelect.appendChild(opt);
                });
                if (state.environments.some(e => e.name === currentEnv)) { environmentSelect.value = currentEnv; }
            }
            onEnvironmentChange();
            break;

        case 'response': {
            const sendButton = document.getElementById('send');
            if (sendButton) { sendButton.textContent = 'Send Request'; sendButton.disabled = false; }
            state.isRequestInProgress = false;

            const statusClass = message.status >= 200 && message.status < 300 ? 'status-success' : 'status-error';
            
            let sizeInfo = '';
            let sizeBadge = '';
            if (message.size !== undefined) {
                if (message.size > 5 * 1024 * 1024) {
                    sizeInfo = ` • ${(message.size / (1024 * 1024)).toFixed(2)} MB`;
                    sizeBadge = ' <span class="size-warning" title="Large payload (>5MB)">⚠️ Warning</span>';
                } else if (message.size > 1 * 1024 * 1024) {
                    sizeInfo = ` • ${(message.size / (1024 * 1024)).toFixed(2)} MB`;
                    sizeBadge = ' <span class="size-info" title="Large payload (>1MB)">ℹ️ Info</span>';
                } else if (message.size >= 1024) {
                    sizeInfo = ` • ${(message.size / 1024).toFixed(2)} KB`;
                } else {
                    sizeInfo = ` • ${message.size} B`;
                }
            }

            const responseInfo = document.getElementById('response-info');
            if (responseInfo) {
                responseInfo.innerHTML = '';
                const statusSpan = document.createElement('span');
                statusSpan.className = `${statusClass} status-badge-response`;
                statusSpan.textContent = `${message.status} ${message.statusText}`;
                responseInfo.appendChild(statusSpan);
                const durationSpan = document.createElement('span');
                durationSpan.className = 'duration-info';
                let durationText = `${message.duration}ms${sizeInfo}`;
                if (message.attempts && message.attempts > 1) {
                    durationText += ` • ${message.attempts} attempts`;
                }
                durationSpan.innerHTML = `${durationText}${sizeBadge}`;
                responseInfo.appendChild(durationSpan);
            }

            const responseBody = document.getElementById('response-body');
            if (responseBody) {
                try {
                    if (message.isLarge) {
                        responseBody.textContent = message.data;
                    } else {
                        const jsonBody = JSON.stringify(message.data, null, 2);
                        if (jsonBody.length > 500000) {
                            responseBody.textContent = `[Response too large]\n\n${jsonBody.substring(0, 1000)}...`;
                        } else {
                            responseBody.innerHTML = syntaxHighlightJson(jsonBody);
                        }
                    }
                } catch (e) { responseBody.textContent = String(message.data); }
            }

            const responseHeaders = document.getElementById('response-headers');
            if (responseHeaders) {
                responseHeaders.textContent = message.headers ? JSON.stringify(message.headers, null, 2) : 'No headers';
            }

            if (!message.cancelled && state.currentRequest) {
                addToHistory(state.currentRequest, message, message.duration);
            }
            break;
        }

        case 'retryAttempt': {
            const sendButton = document.getElementById('send');
            if (sendButton) { sendButton.textContent = `Retry ${message.attempt}/${message.total}...`; }
            break;
        }

        case 'error': {
            const sendButton = document.getElementById('send');
            if (sendButton) { sendButton.textContent = 'Send Request'; sendButton.disabled = false; }
            state.isRequestInProgress = false;
            const errorInfo = document.getElementById('response-info');
            if (errorInfo) {
                errorInfo.innerHTML = '';
                const span = document.createElement('span');
                span.className = 'error-message';
                span.textContent = `❌ Error: ${message.error}`;
                errorInfo.appendChild(span);
            }
            const errorBody = document.getElementById('response-body');
            if (errorBody) {
                errorBody.innerHTML = '';
                
                const card = document.createElement('div');
                card.style.padding = '15px';
                card.style.borderLeft = '4px solid var(--error-color)';
                card.style.background = 'var(--panel-bg)';
                card.style.borderRadius = '4px';
                card.style.marginBottom = '10px';
                
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.justifyContent = 'space-between';
                container.style.alignItems = 'flex-start';
                
                const textContainer = document.createElement('div');
                
                const title = document.createElement('h3');
                title.style.marginTop = '0';
                title.style.color = 'var(--error-color)';
                title.textContent = message.error;
                textContainer.appendChild(title);
                
                if (message.hint) {
                    const hintP = document.createElement('p');
                    hintP.style.margin = '10px 0';
                    hintP.style.color = 'var(--text-highlight)';
                    hintP.style.fontSize = '13px';
                    hintP.innerHTML = '💡 <strong>Hint:</strong> ';
                    const hintSpan = document.createElement('span');
                    hintSpan.textContent = message.hint;
                    hintP.appendChild(hintSpan);
                    textContainer.appendChild(hintP);
                }
                
                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn-secondary';
                copyBtn.style.fontSize = '11px';
                copyBtn.style.padding = '4px 8px';
                copyBtn.textContent = '📋 Copy Details';
                copyBtn.addEventListener('click', () => {
                    const rawContent = message.rawDetails || message.error;
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(rawContent).then(() => {
                            const originalText = copyBtn.textContent;
                            copyBtn.textContent = '✅ Copied!';
                            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
                        }).catch(err => logger.error('Clipboard error:', err));
                    } else {
                        // Fallback since some webviews might block clipboard API
                        const textarea = document.createElement('textarea');
                        textarea.value = rawContent;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '✅ Copied!';
                        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
                    }
                });
                
                container.appendChild(textContainer);
                container.appendChild(copyBtn);
                card.appendChild(container);
                errorBody.appendChild(card);
                
                if (message.rawDetails) {
                    const pre = document.createElement('pre');
                    pre.style.marginTop = '15px';
                    pre.style.padding = '10px';
                    pre.style.background = 'var(--vscode-bg)';
                    pre.style.border = '1px dashed var(--border-color)';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.fontSize = '11px';
                    pre.style.color = 'var(--text-muted)';
                    pre.textContent = message.rawDetails;
                    errorBody.appendChild(pre);
                }
            }
            break;
        }

        case 'previewResult':
            showPreview(message.url, message.headers, message.body, message.errors);
            break;

        case 'validationResult': {
            const validationContent = document.getElementById('validation-content');
            const validationPanel = document.getElementById('validation-panel');
            if (validationContent && validationPanel) {
                validationContent.innerHTML = '';
                const div = document.createElement('div');
                div.className = message.valid ? 'success-message' : 'error-message';
                div.textContent = message.valid ? '✓ All variables valid' : `⚠ ${message.message}`;
                validationContent.appendChild(div);
                validationPanel.classList.remove('preview-hidden');
                validationPanel.classList.add('preview-visible');
                setTimeout(() => {
                    validationPanel.classList.add('preview-hidden');
                    validationPanel.classList.remove('preview-visible');
                }, 5000);
            }
            break;
        }
    }
});