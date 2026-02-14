(function () {
    const vscode = acquireVsCodeApi();

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================
    let queryParams = [];
    let history = [];
    let collections = {};
    let expandedCollections = new Set();
    let currentRequest = null;
    let settings = { timeout: 10000 };
    let environments = [];
    let isRequestInProgress = false;
    let isUpdatingPreview = false;
    let previewTimeout;

    // ============================================================================
    // DOM ELEMENTS
    // ============================================================================
    const tabButtons = document.querySelectorAll('.tab-button');
    const responseTabButtons = document.querySelectorAll('.response-tab-button');
    const sendButton = document.getElementById('send');
    const validateButton = document.getElementById('validate-request');
    const saveButton = document.getElementById('save-request');
    const exportButton = document.getElementById('export-curl');
    const importButton = document.getElementById('import-curl');
    const addParamButton = document.getElementById('add-query-param');
    const clearHistoryButton = document.getElementById('clear-history');
    const createCollectionButton = document.getElementById('create-collection');

    // Environment elements
    const environmentSelect = document.getElementById('environment');
    const refreshEnvironmentsButton = document.getElementById('refresh-environments');
    const toggleVariablesButton = document.getElementById('toggle-variables');
    const envIndicator = document.getElementById('env-indicator');
    const envCount = document.getElementById('env-count');
    const envStatus = document.getElementById('env-status');

    // Input elements
    const urlInput = document.getElementById('url');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const methodSelect = document.getElementById('method');

    // Preview hint elements
    const urlPreview = document.getElementById('url-preview');
    const headersPreview = document.getElementById('headers-preview');
    const bodyPreview = document.getElementById('body-preview');

    // Validation elements
    const validationPanel = document.getElementById('validation-panel');
    const validationContent = document.getElementById('validation-content');

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    window.addEventListener('load', () => {
        logger.log('Script loaded');
        setupEventListeners();
        renderQueryParams();
        loadEnvironments();
        // State will be loaded via 'loadState' message from extension

        vscode.postMessage({ type: 'webviewReady', level: 'info', text: 'DotFetch is ready!' });
    });

    // ============================================================================
    // EVENT LISTENERS SETUP
    // ============================================================================
    function setupEventListeners() {
        // Tab switching
        tabButtons.forEach(button => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });

        responseTabButtons.forEach(button => {
            button.addEventListener('click', () => switchResponseTab(button.dataset.responseTab));
        });

        // Request actions
        sendButton.addEventListener('click', sendRequest);
        saveButton.addEventListener('click', showSaveModal);
        exportButton.addEventListener('click', exportToCurl);
        importButton.addEventListener('click', showCurlImportModal);
        validateButton.addEventListener('click', validateCurrentRequest);

        // Query params
        addParamButton.addEventListener('click', addQueryParam);

        // History
        if (clearHistoryButton) {
            clearHistoryButton.addEventListener('click', clearHistory);
        }

        // Collections
        if (createCollectionButton) {
            createCollectionButton.addEventListener('click', showCollectionModal);
        }

        // Modals
        document.querySelectorAll('.cancel').forEach(btn => {
            btn.addEventListener('click', hideModals);
        });

        const confirmSave = document.getElementById('confirm-save');
        if (confirmSave) {
            confirmSave.addEventListener('click', saveRequest);
        }

        const confirmCreateCollection = document.getElementById('confirm-create-collection');
        if (confirmCreateCollection) {
            confirmCreateCollection.addEventListener('click', createCollection);
        }

        const confirmImportCurl = document.getElementById('confirm-import-curl');
        if (confirmImportCurl) {
            confirmImportCurl.addEventListener('click', executeCurlImport);
        }

        // Environment
        if (environmentSelect) {
            environmentSelect.addEventListener('change', onEnvironmentChange);
        }

        if (refreshEnvironmentsButton) {
            refreshEnvironmentsButton.addEventListener('click', loadEnvironments);
        }

        if (toggleVariablesButton) {
            toggleVariablesButton.addEventListener('click', toggleVariablesPanel);
        }

        // Live Preview (Debounced)
        [urlInput, headersTextarea, bodyTextarea].forEach(el => {
            if (el) {
                el.addEventListener('input', () => {
                    if (isUpdatingPreview) {return;}
                    
                    clearTimeout(previewTimeout);
                    previewTimeout = setTimeout(() => {
                        isUpdatingPreview = true;
                        updatePreview();
                        setTimeout(() => { isUpdatingPreview = false; }, 100);
                    }, 300);
                });
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // ============================================================================
    // KEYBOARD SHORTCUTS
    // ============================================================================
    function handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to send request
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendRequest();
            return;
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            hideModals();
            return;
        }

        // Ctrl/Cmd + S to save request
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            showSaveModal();
            return;
        }

        // Ctrl/Cmd + K to clear
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            clearRequestForm();
            return;
        }
    }

    // ============================================================================
    // CORE FUNCTIONS
    // ============================================================================

    function loadEnvironments() {
        vscode.postMessage({ type: 'getEnvironments' });
        
        // Visual feedback
        if (refreshEnvironmentsButton) {
            refreshEnvironmentsButton.classList.add('rotating');
            setTimeout(() => {
                refreshEnvironmentsButton.classList.remove('rotating');
            }, 1000);
        }
    }

    async function sendRequest() {
        const method = methodSelect.value;
        const url = constructFullUrl();
        const headers = headersTextarea ? headersTextarea.value : '';
        const body = bodyTextarea ? bodyTextarea.value : '';
        const selectedEnvironment = environmentSelect ? environmentSelect.value : 'none';

        // Validate URL
        if (!url || url.trim() === '') {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'URL is required' 
            });
            return;
        }

        // Handle cancel request
        if (isRequestInProgress) {
            vscode.postMessage({ type: 'cancelRequest' });
            sendButton.textContent = 'Send Request';
            sendButton.disabled = false;
            isRequestInProgress = false;
            logger.log('Request cancelled by user');
            return;
        }

        // Store current request
        currentRequest = { method, url, headers, body };

        // Update UI to loading state
        sendButton.textContent = 'Cancel';
        sendButton.disabled = false;
        isRequestInProgress = true;

        // Send request to extension
        vscode.postMessage({
            type: 'sendRequest',
            method,
            url,
            headers,
            body,
            timeout: settings.timeout || 10000,
            environment: selectedEnvironment
        });

        logger.log('Request sent:', { method, url, environment: selectedEnvironment });
    }

    function clearRequestForm() {
        if (methodSelect) {methodSelect.value = 'GET';}
        if (urlInput) {urlInput.value = '';}
        if (headersTextarea) {headersTextarea.value = '';}
        if (bodyTextarea) {bodyTextarea.value = '';}
        queryParams = [];
        renderQueryParams();
        updatePreview();
    }

    // ============================================================================
    // UI HELPERS
    // ============================================================================

    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        
        const tabContent = document.getElementById(tabName + '-tab');
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (tabContent) {tabContent.classList.add('active');}
        if (tabButton) {tabButton.classList.add('active');}
    }

    function switchResponseTab(tabName) {
        document.querySelectorAll('.response-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.response-tab-button').forEach(b => b.classList.remove('active'));
        
        const tabContent = document.getElementById('response-' + tabName + '-tab');
        const tabButton = document.querySelector(`[data-response-tab="${tabName}"]`);
        
        if (tabContent) {tabContent.classList.add('active');}
        if (tabButton) {tabButton.classList.add('active');}
    }

    function constructFullUrl() {
        if (!urlInput) {return '';}
        
        let baseUrl = urlInput.value.trim();
        if (!baseUrl) {return '';}

        const validParams = queryParams.filter(p => p.key && p.value);
        if (validParams.length > 0) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const queryString = validParams
                .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
                .join('&');
            return `${baseUrl}${separator}${queryString}`;
        }
        
        return baseUrl;
    }

    // ============================================================================
    // QUERY PARAMETERS
    // ============================================================================

    function addQueryParam() {
        queryParams.push({ key: '', value: '' });
        renderQueryParams();
    }

    function removeQueryParam(index) {
        queryParams.splice(index, 1);
        renderQueryParams();
        updatePreview();
    }

    function updateQueryParam(index, field, value) {
        if (queryParams[index]) {
            queryParams[index][field] = value;
            updatePreview();
        }
    }

    function renderQueryParams() {
        const container = document.getElementById('query-params-list');
        if (!container) {return;}
        
        container.innerHTML = '';

        queryParams.forEach((param, index) => {
            const row = document.createElement('div');
            row.className = 'query-param-row flex-row';
            row.setAttribute('role', 'listitem');

            row.innerHTML = `
                <input type="text" 
                       class="param-key param-input" 
                       placeholder="Key" 
                       value="${escapeHtml(param.key)}">
                <input type="text" 
                       class="param-value param-input" 
                       placeholder="Value" 
                       value="${escapeHtml(param.value)}">
                <button class="remove-btn remove-param-btn" 
                        title="Remove parameter">❌</button>
            `;

            const keyInput = row.querySelector('.param-key');
            const valInput = row.querySelector('.param-value');
            const delBtn = row.querySelector('.remove-btn');

            keyInput.addEventListener('input', (e) => {
                updateQueryParam(index, 'key', e.target.value);
            });
            
            valInput.addEventListener('input', (e) => {
                updateQueryParam(index, 'value', e.target.value);
            });
            
            delBtn.addEventListener('click', () => {
                removeQueryParam(index);
            });

            container.appendChild(row);
        });
    }

    

    // ============================================================================
    // ENVIRONMENT & PREVIEW
    // ============================================================================

    function onEnvironmentChange() {
        const selectedEnv = environmentSelect ? environmentSelect.value : 'none';
        updateEnvironmentIndicator(selectedEnv);
        updateVariableCount(selectedEnv);
        updatePreview();
    }

    function updateEnvironmentIndicator(env) {
        if (envIndicator) {
            envIndicator.textContent = env === 'none' ? 'No Environment' : env;
            envIndicator.className = 'env-indicator';
            
            // Add environment-specific classes for styling
            if (env === 'production') {
                envIndicator.classList.add('env-production');
            } else if (env === 'development') {
                envIndicator.classList.add('env-development');
            } else if (env === 'staging') {
                envIndicator.classList.add('env-staging');
            }
        }
    }

    function updateVariableCount(envName) {
        if (!envCount) {return;}
        
        if (envName === 'none') {
            envCount.textContent = '0 variables';
        } else {
            const env = environments.find(e => e.name === envName);
            const count = env ? Object.keys(env.variables).length : 0;
            envCount.textContent = `${count} variable${count !== 1 ? 's' : ''}`;
        }
    }

    function toggleVariablesPanel() {
        vscode.postMessage({ type: 'toggleEnvironmentTree' });
    }

    function updatePreview() {
        if (isUpdatingPreview) {
            return;
        }

        isUpdatingPreview = true;
        
        const envName = environmentSelect ? environmentSelect.value : 'none';
        
        // Don't preview if no environment selected
        if (envName === 'none') {
            hideAllPreviews();
            return;
        }

        const inputs = {
            url: constructFullUrl(),
            headers: headersTextarea ? headersTextarea.value : '',
            body: bodyTextarea ? bodyTextarea.value : ''
        };

        vscode.postMessage({
            type: 'previewVariables',
            environment: envName,
            inputs: inputs
        });
        setTimeout(() => {
            isUpdatingPreview = false;
        }, 50);
    }

    function hideAllPreviews() {
        if (urlPreview) {urlPreview.classList.add('preview-hidden'); urlPreview.classList.remove('preview-visible');}
        if (headersPreview) {headersPreview.classList.add('preview-hidden'); headersPreview.classList.remove('preview-visible');}
        if (bodyPreview) {bodyPreview.classList.add('preview-hidden'); bodyPreview.classList.remove('preview-visible');}
    }

    function showPreview(urlResult, headersResult, bodyResult, errors) {
        // Helper to update preview block
        const updateBlock = (element, result, hasError) => {
            if (!element) {return;}
            
            if (result && result.trim() !== '') {
                element.textContent = hasError 
                    ? 'Error resolving variables' 
                    : `Resolved: ${result}`;
                element.style.display = 'block';
                element.className = hasError ? 'preview-hint error' : 'preview-hint';
            } else {
                element.style.display = 'none';
            }
        };

        updateBlock(urlPreview, urlResult, errors.url);
        updateBlock(headersPreview, headersResult, errors.headers);
        updateBlock(bodyPreview, bodyResult, errors.body);
    }

    // ============================================================================
    // HISTORY
    // ============================================================================

    function addToHistory(request, response, duration) {
        if (!request) {return;}
        
        const historyItem = {
            ...request,
            responseStatus: response.status,
            timestamp: new Date().toISOString(),
            duration: duration
        };
        
        history.unshift(historyItem);
        
        // Keep only last 50 items
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        saveState();
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) {return;}
        
        container.innerHTML = '';

        if (history.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-message';
            emptyDiv.textContent = 'No history yet';
            container.appendChild(emptyDiv);
            return;
        }

        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            
            const statusClass = item.responseStatus >= 200 && item.responseStatus < 300 
                ? 'status-success' 
                : 'status-error';
            
            const timestamp = new Date(item.timestamp).toLocaleString();
            
            div.innerHTML = `
                <div class="header-flex">
                    <span class="method ${item.method}">${item.method}</span>
                    <span class="url-span">${escapeHtml(item.url)}</span>
                </div>
                <div class="metadata-text">
                    <span class="${statusClass}">${item.responseStatus}</span>
                    <span class="metadata-separator">•</span>
                    <span>${item.duration}ms</span>
                    <span class="metadata-separator">•</span>
                    <span>${timestamp}</span>
                </div>
            `;
            
            div.addEventListener('click', () => loadRequestIntoForm(item));
            div.classList.add('cursor-pointer');
            
            container.appendChild(div);
        });
    }

    function clearHistory() {
        if (confirm('Clear all history? This cannot be undone.')) {
            history = [];
            saveState();
            renderHistory();
            vscode.postMessage({ 
                type: 'notify', 
                level: 'info', 
                text: 'History cleared' 
            });
        }
    }

    // ============================================================================
    // COLLECTIONS
    // ============================================================================

    function showCollectionModal() {
        const modal = document.getElementById('collection-modal');
        const nameInput = document.getElementById('collection-name');
        
        if (modal) {modal.classList.add('modal-visible');}
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
    }

    function createCollection() {
        const nameInput = document.getElementById('collection-name');
        if (!nameInput) {return;}
        
        const name = nameInput.value.trim();
        
        if (!name) {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Please enter a collection name' 
            });
            return;
        }

        if (collections[name]) {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Collection already exists' 
            });
            return;
        }

        collections[name] = [];
        saveState();
        renderCollections();
        updateSaveCollectionOptions();
        hideModals();
        
        vscode.postMessage({ 
            type: 'notify', 
            level: 'info', 
            text: `Collection "${name}" created` 
        });
    }

    function saveRequest() {
        const nameInput = document.getElementById('save-name');
        const collSelect = document.getElementById('save-collection');
        
        if (!nameInput || !collSelect) {return;}
        
        const name = nameInput.value.trim();
        const collection = collSelect.value;

        if (!name) {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Please enter a request name' 
            });
            return;
        }

        if (!collection) {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Please select a collection' 
            });
            return;
        }

        const reqToSave = {
            name: name,
            method: methodSelect ? methodSelect.value : 'GET',
            url: urlInput ? urlInput.value : '',
            headers: headersTextarea ? headersTextarea.value : '',
            body: bodyTextarea ? bodyTextarea.value : '',
            queryParams: [...queryParams]
        };

        if (!collections[collection]) {
            collections[collection] = [];
        }
        
        collections[collection].push(reqToSave);

        saveState();
        renderCollections();
        hideModals();
        nameInput.value = '';

        vscode.postMessage({ 
            type: 'notify', 
            level: 'info', 
            text: `Request saved to "${collection}"` 
        });
    }

    function renderCollections() {
        const container = document.getElementById('collections-list');
        if (!container) {return;}
        
        container.innerHTML = '';

        const collectionNames = Object.keys(collections);
        
        if (collectionNames.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-message';
            emptyDiv.textContent = 'No collections yet';
            container.appendChild(emptyDiv);
            return;
        }

        collectionNames.forEach(name => {
            const requests = collections[name];
            const isExpanded = expandedCollections.has(name);
            const icon = isExpanded ? '📂' : '📁';

            const div = document.createElement('div');
            div.className = 'collection-item';

            const header = document.createElement('div');
            header.className = 'collection-header';
            header.innerHTML = `
                <span><strong>${icon} ${escapeHtml(name)}</strong> <span class="count-badge">(${requests.length})</span></span>
                <button class="delete-collection-btn icon-btn" title="Delete collection">🗑️</button>
            `;

            header.addEventListener('click', (e) => {
                if (e.target.closest('.delete-collection-btn')) {
                    deleteCollection(name);
                    return;
                }
                
                if (expandedCollections.has(name)) {
                    expandedCollections.delete(name);
                } else {
                    expandedCollections.add(name);
                }
                renderCollections();
            });

            div.appendChild(header);

            if (isExpanded && requests.length > 0) {
                const subList = document.createElement('div');
                subList.className = 'subheader-margin-left';

                requests.forEach((req, idx) => {
                    const rDiv = document.createElement('div');
                    rDiv.className = 'request-item item-padding item-font-small flex-between cursor-pointer';
                    
                    rDiv.innerHTML = `
                        <span>
                            <span class="method ${req.method}">${req.method}</span>
                            <span class="method-name-span">${escapeHtml(req.name)}</span>
                        </span>
                        <button class="delete-request-btn icon-btn" title="Delete request">❌</button>
                    `;

                    rDiv.addEventListener('click', (e) => {
                        if (e.target.closest('.delete-request-btn')) {
                            deleteRequest(name, idx);
                            return;
                        }
                        loadRequestIntoForm(req);
                    });

                    rDiv.addEventListener('mouseenter', () => {
                        rDiv.classList.add('request-item-hover');
                    });

                    rDiv.addEventListener('mouseleave', () => {
                        rDiv.classList.remove('request-item-hover');
                    });

                    subList.appendChild(rDiv);
                });

                div.appendChild(subList);
            }

            container.appendChild(div);
        });
    }

    function deleteCollection(name) {
        if (confirm(`Delete collection "${name}"? This will delete all ${collections[name].length} request(s) in it.`)) {
            delete collections[name];
            expandedCollections.delete(name);
            saveState();
            renderCollections();
            updateSaveCollectionOptions();
            vscode.postMessage({ 
                type: 'notify', 
                level: 'info', 
                text: `Collection "${name}" deleted` 
            });
        }
    }

    function deleteRequest(collectionName, requestIndex) {
        if (collections[collectionName] && collections[collectionName][requestIndex]) {
            const requestName = collections[collectionName][requestIndex].name;
            collections[collectionName].splice(requestIndex, 1);
            saveState();
            renderCollections();
            vscode.postMessage({ 
                type: 'notify', 
                level: 'info', 
                text: `Request "${requestName}" deleted` 
            });
        }
    }

    function updateSaveCollectionOptions() {
        const select = document.getElementById('save-collection');
        if (!select) {return;}
        
        select.innerHTML = '<option value="">Select Collection</option>';
        
        Object.keys(collections).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    function loadRequestIntoForm(item) {
        if (!item) {return;}
        
        // Set method
        if (methodSelect) {
            methodSelect.value = item.method || 'GET';
        }

        // Handle URL and query params
        if (item.queryParams && item.queryParams.length > 0) {
            // Use saved query params
            if (urlInput) {
                const baseUrl = item.url.split('?')[0];
                urlInput.value = baseUrl;
            }
            queryParams = item.queryParams.map(p => ({ ...p })); // Deep copy
        } else {
            // Parse query params from URL using URL API
            try {
                const urlObj = new URL(item.url);
                const baseUrl = urlObj.origin + urlObj.pathname;
                
                if (urlInput) {
                    urlInput.value = baseUrl;  // FIX
                }

                queryParams = [];
                urlObj.searchParams.forEach((value, key) => {
                    queryParams.push({ key, value });
                });
            } catch (e) {
            // Parse query params from URL
            const [baseUrl, queryString] = item.url.split('?');
            
            if (urlInput) {
                urlInput.value = baseUrl;
            }

            if (queryString) {
                    queryParams = queryString.split('&')
                        .map(param => {
                            const eqIndex = param.indexOf('=');
                            if (eqIndex === -1) {
                                return { key: decodeURIComponent(param), value: '' };
                            }
                            return {
                                key: decodeURIComponent(param.substring(0, eqIndex)),
                                value: decodeURIComponent(param.substring(eqIndex + 1))
                            };
                        })
                    .filter(p => p.key); // Remove empty params
            } else {
                queryParams = [];
            }
        }
    }

        // Set headers and body
        if (headersTextarea) {
            headersTextarea.value = item.headers || '';
        }
        
        if (bodyTextarea) {
            bodyTextarea.value = item.body || '';
        }

        // Update UI
        renderQueryParams();
        switchTab('request');
        updatePreview();
    }

    // ============================================================================
    // CURL IMPORT/EXPORT
    // ============================================================================

    function exportToCurl() {
        const url = constructFullUrl();
        
        if (!url || url.trim() === '') {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Please enter a URL first' 
            });
            return;
        }

        const method = methodSelect ? methodSelect.value : 'GET';
        const headers = headersTextarea ? headersTextarea.value : '';
        const body = bodyTextarea ? bodyTextarea.value : '';

        let cmdParts = ['curl'];

        // Only add -X if not GET
        if (method !== 'GET') {
            cmdParts.push('-X', method);
        }

        // Add URL (properly escaped)
        cmdParts.push(`"${url.replace(/"/g, '\\"')}"`);

        // Add headers
        if (headers && headers.trim()) {
            headers.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#')) {
                    const escaped = trimmed.replace(/"/g, '\\"');
                    cmdParts.push(`-H "${escaped}"`);
                }
            });
        }

        // Add body
        if (body && body.trim()) {
            try {
                // Try to parse as JSON for validation
                const jsonBody = JSON.parse(body);
                const compactJson = JSON.stringify(jsonBody);
                const escaped = compactJson.replace(/"/g, '\\"');
                cmdParts.push(`-d "${escaped}"`);
            } catch (e) {
                // Not JSON, escape as string
                const escaped = body
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                cmdParts.push(`-d "${escaped}"`);
            }
        }

        // Join with line breaks for readability
        const cmd = cmdParts.join(' \\\n  ');

        // Copy to clipboard
        copyToClipboard(cmd, 'cURL command copied to clipboard');
    }

    function copyToClipboard(text, successMessage) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                vscode.postMessage({ 
                    type: 'notify', 
                    level: 'info', 
                    text: successMessage
                });
            }).catch((err) => {
                logger.error('Clipboard error:', err);
                vscode.postMessage({ 
                    type: 'notify', 
                    level: 'error', 
                    text: '❌ Failed to copy to clipboard' 
                });
            });
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                vscode.postMessage({ 
                    type: 'notify', 
                    level: 'info', 
                    text: successMessage
                });
            } catch (err) {
                vscode.postMessage({ 
                    type: 'notify', 
                    level: 'error', 
                    text: '❌ Failed to copy to clipboard' 
                });
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    function showCurlImportModal() {
        const modal = document.getElementById('curl-import-modal');
        const input = document.getElementById('curl-import-input');
        
        if (modal) {modal.classList.add('modal-visible');}
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    function executeCurlImport() {
        const curlInput = document.getElementById('curl-import-input');
        if (!curlInput) {return;}
        
        const curlText = curlInput.value.trim();

        if (!curlText) {
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Please paste a cURL command' 
            });
            return;
        }

        try {
            // 1. Extract Method
            const methodMatch = curlText.match(/-X\s+(\w+)/i) || 
                               curlText.match(/--request\s+(\w+)/i);
            if (methodMatch && methodSelect) {
                methodSelect.value = methodMatch[1].toUpperCase();
            } else if (methodSelect) {
                methodSelect.value = 'GET';
            }

            // 2. Extract URL
            const urlMatch = curlText.match(/["'](https?:\/\/[^"']+)["']/) || 
                            curlText.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                const fullUrl = urlMatch[1];
                if (fullUrl.includes('?')) {
                    const [base, query] = fullUrl.split('?');
                    if (urlInput) {urlInput.value = base;}
                    
                    // Parse query params
                    queryParams = query.split('&').map(param => {
                        const [key = '', value = ''] = param.split('=');
                        return {
                            key: decodeURIComponent(key),
                            value: decodeURIComponent(value)
                        };
                    }).filter(p => p.key);
                    
                    renderQueryParams();
                } else {
                    if (urlInput) {urlInput.value = fullUrl;}
                    queryParams = [];
                    renderQueryParams();
                }
            }

            // 3. Extract Headers
            const headerRegex = /-H\s+["']([^"']+)["']/g;
            let headerMatch;
            let headersList = [];
            
            while ((headerMatch = headerRegex.exec(curlText)) !== null) {
                headersList.push(headerMatch[1]);
            }
            
            if (headersTextarea) {
                headersTextarea.value = headersList.length > 0 
                    ? headersList.join('\n') 
                    : '';
            }

            // 4. Extract Body
            const dataMatch = curlText.match(/-d\s+['"]([^'"]+)['"]/) || 
                             curlText.match(/--data\s+['"]([^'"]+)['"]/);
            
            if (dataMatch && bodyTextarea) {
                try {
                    const jsonBody = JSON.parse(dataMatch[1]);
                    bodyTextarea.value = JSON.stringify(jsonBody, null, 2);
                } catch (e) {
                    bodyTextarea.value = dataMatch[1];
                }
            } else if (bodyTextarea) {
                bodyTextarea.value = '';
            }

            hideModals();
            vscode.postMessage({ 
                type: 'notify', 
                level: 'info', 
                text: '✅ cURL imported successfully!' 
            });

            updatePreview();

        } catch (e) {
            logger.error('cURL import error:', e);
            vscode.postMessage({ 
                type: 'notify', 
                level: 'error', 
                text: 'Error parsing cURL: ' + e.message 
            });
        }
    }

    // ============================================================================
    // VALIDATION
    // ============================================================================

    function validateCurrentRequest() {
        const envName = environmentSelect ? environmentSelect.value : 'none';
        
        vscode.postMessage({
            type: 'validateVariables',
            environment: envName,
            inputs: {
                url: constructFullUrl(),
                headers: headersTextarea ? headersTextarea.textContent : '',
                body: bodyTextarea ? bodyTextarea.textContent : ''
            }
        });
    }

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================

    function saveState() {
        const state = { 
            history, 
            collections, 
            settings 
        };
        
        vscode.setState(state);
        vscode.postMessage({ type: 'saveState', state });
    }

    function updateSettingsUI() {
        const timeoutInput = document.getElementById('timeout');
        if (!timeoutInput) {return;}
        
        timeoutInput.value = settings.timeout || 10000;

        // Add change listener (only once)
        if (!timeoutInput.dataset.listenerAdded) {
            timeoutInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                
                if (value && value > 0 && value <= 300000) {
                    settings.timeout = value;
                    saveState();
                    vscode.postMessage({ 
                        type: 'notify', 
                        level: 'info', 
                        text: `Timeout updated to ${value}ms` 
                    });
                } else {
                    vscode.postMessage({ 
                        type: 'notify', 
                        level: 'error', 
                        text: 'Timeout must be between 1-300000ms (5 minutes)' 
                    });
                    timeoutInput.value = settings.timeout;
                }
            });
            
            timeoutInput.dataset.listenerAdded = 'true';
        }
    }

    // ============================================================================
    // MODALS
    // ============================================================================

    function hideModals() {
        document.querySelectorAll('.modal').forEach(m => {
            m.classList.remove('modal-visible');
        });
    }

    function showSaveModal() {
        updateSaveCollectionOptions();
        const modal = document.getElementById('save-modal');
        const nameInput = document.getElementById('save-name');
        
        if (modal) {modal.classList.add('modal-visible');}
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    function escapeHtml(text) {
        if (!text) {return '';}
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================================
    // MESSAGE HANDLER
    // ============================================================================

    window.addEventListener('message', event => {
        const message = event.data;
        
        logger.log('Received message:', message.type);

        switch (message.type) {
            case 'loadState':
                if (message.state) {
                    history = message.state.history || [];
                    collections = message.state.collections || {};
                    settings = message.state.settings || { timeout: 10000 };

                    // Auto-create 'Default' collection if none exist
                    if (Object.keys(collections).length === 0) {
                        collections['Default'] = [];
                    }

                    renderHistory();
                    renderCollections();
                    updateSaveCollectionOptions();
                    updateSettingsUI();
                    loadEnvironments();
                    
                    logger.log('State loaded:', {
                        historyCount: history.length,
                        collectionsCount: Object.keys(collections).length
                    });
                }
                break;

            case 'environments':
                environments = message.environments || [];
                const currentEnv = environmentSelect ? environmentSelect.value : 'none';

                if (environmentSelect) {
                    environmentSelect.innerHTML = '<option value="none">No Environment</option>';
                    
                    environments.forEach(env => {
                        const opt = document.createElement('option');
                        opt.value = env.name;
                        const varCount = Object.keys(env.variables).length;
                        opt.textContent = `${env.name} (${varCount} var${varCount !== 1 ? 's' : ''})`;
                        environmentSelect.appendChild(opt);
                    });

                    // Restore selection if it still exists
                    if (environments.some(e => e.name === currentEnv)) {
                        environmentSelect.value = currentEnv;
                    }
                }

                onEnvironmentChange();
                logger.log('Environments loaded:', { count: environments.length });
                break;

            case 'response':
                sendButton.textContent = 'Send Request';
                sendButton.disabled = false;
                isRequestInProgress = false;

                const statusClass = message.status >= 200 && message.status < 300 
                    ? 'status-success' 
                    : 'status-error';

                let sizeInfo = '';
                if (message.size) {
                    const sizeKB = (message.size / 1024).toFixed(2);
                    sizeInfo = ` • ${sizeKB} KB`;
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
                    durationSpan.textContent = `${message.duration}ms${sizeInfo}`;
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
                                responseBody.textContent = 
                                    `[Response too large: ${(jsonBody.length / 1024).toFixed(2)} KB]\n\n` +
                                    `First 1000 characters:\n${jsonBody.substring(0, 1000)}...`;
                            } else {
                                responseBody.textContent = jsonBody;
                            }
                        }
                    } catch (e) {
                        responseBody.textContent = String(message.data);
                    }
                }

                const responseHeaders = document.getElementById('response-headers');
                if (responseHeaders) {
                    responseHeaders.textContent = message.headers 
                    ? JSON.stringify(message.headers, null, 2) : 'No headers';
                }

                if (!message.cancelled && currentRequest) {
                    addToHistory(currentRequest, message, message.duration);
                }

                logger.log('Response received:', {
                    status: message.status,
                    duration: message.duration
                });
                break;

            case 'error':
                sendButton.textContent = 'Send Request';
                sendButton.disabled = false;
                isRequestInProgress = false;

                const errorInfo = document.getElementById('response-info');
                if (errorInfo) {
                    const span = document.createElement('span');
                    span.className = 'error-message';
                    span.textContent = `❌ Error: ${message.error}`;
                    errorInfo.innerHTML = '';
                    errorInfo.appendChild(span);
                }

                const errorBody = document.getElementById('response-body');
                if (errorBody) {
                    errorBody.textContent = message.error;
                }

                logger.error('Request error:', message.error);
                break;

            case 'previewResult':
                showPreview(message.url, message.headers, message.body, message.errors);
                break;

            case 'validationResult':
                if (validationContent && validationPanel) {
                    validationContent.innerHTML = '';
                    const div = document.createElement('div');
                    if (message.valid) {
                        div.className = 'success-message';
                        div.textContent = '✓ All variables valid';
                    } else {
                        div.className = 'error-message';
                        div.textContent = `⚠ ${message.message}`;
                    }
                    validationContent.appendChild(div);
                    validationPanel.classList.remove('preview-hidden');
                    validationPanel.classList.add('preview-visible');
                    
                    // Auto-hide after 5 seconds
                    setTimeout(() => {
                        if (validationPanel) {
                            validationPanel.classList.add('preview-hidden');
                            validationPanel.classList.remove('preview-visible');
                        }
                    }, 5000);
                }
                break;

            default:
                logger.warn('Unknown message type:', message.type);
        }
    });

})();