(function () {
    const vscode = acquireVsCodeApi();

    // State
    let queryParams = [];
    let history = [];
    let collections = {};
    let currentRequest = null;
    let settings = { timeout: 10000 };
    let environments = [];

    // DOM elements
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

    // Debounce timer
    let previewTimeout;

    // Initialize
    window.addEventListener('load', () => {
        loadState(); // Request state from backend
        setupEventListeners();
        renderQueryParams();
        updateSettingsUI();
        loadEnvironments();
    });

    // ---------------------------------------------------------
    // Event Listeners Setup
    // ---------------------------------------------------------
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

        // Query params
        addParamButton.addEventListener('click', addQueryParam);

        // History
        clearHistoryButton.addEventListener('click', clearHistory);

        // Collections
        createCollectionButton.addEventListener('click', showCollectionModal);

        // Modals
        document.querySelectorAll('.cancel').forEach(btn => {
            btn.addEventListener('click', hideModals);
        });

        document.getElementById('confirm-save').addEventListener('click', saveRequest);
        document.getElementById('confirm-create-collection').addEventListener('click', createCollection);
        document.getElementById('confirm-import-curl').addEventListener('click', executeCurlImport);
        
        // Environment
        environmentSelect.addEventListener('change', onEnvironmentChange);
        refreshEnvironmentsButton.addEventListener('click', loadEnvironments);
        toggleVariablesButton.addEventListener('click', toggleVariablesPanel);

        // Live Preview (Debounced)
        [urlInput, headersTextarea, bodyTextarea].forEach(el => {
            el.addEventListener('input', () => {
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(updatePreview, 300);
            });
        });

        // Validation
        validateButton.addEventListener('click', validateCurrentRequest);
    }

    // ---------------------------------------------------------
    // Core Functions
    // ---------------------------------------------------------

    function loadEnvironments() {
        vscode.postMessage({ type: 'getEnvironments' });
        // Visual feedback
        if(refreshEnvironmentsButton) {
            refreshEnvironmentsButton.classList.add('rotating');
            setTimeout(() => refreshEnvironmentsButton.classList.remove('rotating'), 1000);
        }
    }

    async function sendRequest() {
        const method = methodSelect.value;
        const url = constructFullUrl(); // Use helper to include params
        const headers = headersTextarea.textContent;
        const body = bodyTextarea.textContent;
        const selectedEnvironment = environmentSelect.value;

        if (!url) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'URL is required' });
            return;
        }

        currentRequest = { method, url, headers, body };

        // UI Loading
        sendButton.textContent = 'Sending...';
        sendButton.disabled = true;

        vscode.postMessage({
            type: 'sendRequest',
            method,
            url,
            headers,
            body,
            timeout: settings.timeout || 10000,
            environment: selectedEnvironment
        });
    }

    // ---------------------------------------------------------
    // UI Helpers
    // ---------------------------------------------------------

    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.getElementById(tabName + '-tab').classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    function switchResponseTab(tabName) {
        document.querySelectorAll('.response-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.response-tab-button').forEach(b => b.classList.remove('active'));
        document.getElementById('response-' + tabName + '-tab').classList.add('active');
        document.querySelector(`[data-response-tab="${tabName}"]`).classList.add('active');
    }

    function constructFullUrl() {
        let baseUrl = urlInput.textContent.trim();
        if(!baseUrl) {return '';}

        const params = queryParams.filter(p => p.key && p.value);
        if (params.length > 0) {
            const separator = baseUrl.includes('?') ? '&' : '?';
            const queryString = params.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
            return `${baseUrl}${separator}${queryString}`;
        }
        return baseUrl;
    }

    // ---------------------------------------------------------
    // Query Parameters Logic
    // ---------------------------------------------------------

    function addQueryParam() {
        queryParams.push({ key: '', value: '' });
        renderQueryParams();
    }

    function removeQueryParam(index) {
        queryParams.splice(index, 1);
        renderQueryParams();
        updatePreview(); // Update URL preview
    }

    function updateQueryParam(index, field, value) {
        queryParams[index][field] = value;
        // Don't update URL input directly, let constructFullUrl handle it during send/preview
        updatePreview();
    }

    function renderQueryParams() {
        const container = document.getElementById('query-params-list');
        container.innerHTML = '';

        queryParams.forEach((param, index) => {
            const row = document.createElement('div');
            row.className = 'query-param-row';
            row.style.display = 'flex';
            row.style.gap = '5px';
            row.style.marginBottom = '5px';

            row.innerHTML = `
                <input type="text" class="param-key" placeholder="Key" value="${param.key}" style="flex:1">
                <input type="text" class="param-value" placeholder="Value" value="${param.value}" style="flex:1">
                <button class="remove-btn" style="background:none;border:none;cursor:pointer">❌</button>
            `;

            const keyInput = row.querySelector('.param-key');
            const valInput = row.querySelector('.param-value');
            const delBtn = row.querySelector('.remove-btn');

            keyInput.addEventListener('input', (e) => updateQueryParam(index, 'key', e.target.value));
            valInput.addEventListener('input', (e) => updateQueryParam(index, 'value', e.target.value));
            delBtn.addEventListener('click', () => removeQueryParam(index));

            container.appendChild(row);
        });
    }

    // ---------------------------------------------------------
    // Environment & Preview Logic
    // ---------------------------------------------------------

    function onEnvironmentChange() {
        const selectedEnv = environmentSelect.value;
        updateEnvironmentIndicator(selectedEnv);
        updateVariableCount(selectedEnv);
        highlightVariablesInEditable();
        updatePreview();
    }

    function highlightVariablesInEditable() {
        const envName = environmentSelect.value;
        if (envName === 'none') {return;}

        const environment = environments.find(e => e.name === envName);
        if (!environment) {return;}

        const variables = Object.keys(environment.variables);
        const varRegex = new RegExp(`\\{\\{(${variables.join('|')})(.*?)\\}\\}`, 'g');

        [urlInput, headersTextarea, bodyTextarea].forEach(element => {
            const content = element.textContent;
            if (!content) {return;}

            const highlighted = content.replace(varRegex, (match, varName) => {
                return `<span class="variable-highlight" data-var="${varName}" title="Click to see value: ${environment.variables[varName]}">${match}</span>`;
            });

            if (highlighted !== content && highlighted.includes('variable-highlight')) {
                element.innerHTML = highlighted;
            } else {
                element.textContent = content;
            }
        });
    }

    function updateEnvironmentIndicator(env) {
        if(envIndicator) {
            envIndicator.textContent = env === 'none' ? 'No Environment' : env;
        }
    }

    function updateVariableCount(envName) {
        if (!envCount) {return;}
        if (envName === 'none') {
            envCount.textContent = '0 variables';
        } else {
            const env = environments.find(e => e.name === envName);
            const count = env ? Object.keys(env.variables).length : 0;
            envCount.textContent = `${count} variables`;
        }
    }

    function toggleVariablesPanel() {
        vscode.postMessage({ type: 'toggleEnvironmentTree' });
    }

    function updatePreview() {
        const envName = environmentSelect.value;
        if (envName === 'none' || envName === 'local') {
            // Even if local, we might want to resolve if user has a .env file
        }

        const inputs = {
            url: constructFullUrl(),
            headers: headersTextarea.textContent,
            body: bodyTextarea.textContent
        };

        vscode.postMessage({
            type: 'previewVariables',
            environment: envName,
            inputs: inputs
        });
    }

    function showPreview(urlResult, headersResult, bodyResult, errors) {
        // Helper to update specific preview block
        const updateBlock = (element, result, hasError) => {
            if (result && result !== element.previousElementSibling?.querySelector('input')?.value && result !== element.previousElementSibling?.querySelector('textarea')?.value) {
                element.textContent = `Resolved: ${result}`;
                element.style.display = 'block';
                element.className = hasError ? 'preview-hint error' : 'preview-hint';
            } else {
                element.style.display = 'none';
            }
        };

        if(urlPreview) {updateBlock(urlPreview, urlResult, errors.url);}
        // We generally don't show full body/header preview unless there is an error to avoid clutter
        if(headersPreview) {
            if (errors.headers) {
                headersPreview.textContent = "Error resolving variables in headers";
                headersPreview.style.display = 'block';
                headersPreview.classList.add('error');
            } else {
                headersPreview.style.display = 'none';
            }
        }
    }

    // ---------------------------------------------------------
    // History & Collections
    // ---------------------------------------------------------

    function addToHistory(request, response, duration) {
        const historyItem = {
            ...request,
            responseStatus: response.status,
            timestamp: new Date().toISOString(),
            duration
        };
        history.unshift(historyItem);
        if (history.length > 50) {history.pop();}
        saveState();
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('history-list');
        if(!container) {return;}
        container.innerHTML = '';
        
        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div style="font-weight:bold"><span class="method ${item.method}">${item.method}</span> ${item.url}</div>
                <div style="font-size:0.8em; color:#888">
                    Status: ${item.responseStatus} • ${item.duration}ms
                </div>
            `;
            div.addEventListener('click', () => loadRequestIntoForm(item));
            container.appendChild(div);
        });
    }

    function showCollectionModal() {
        document.getElementById('collection-modal').style.display = 'block';
        document.getElementById('collection-name').value = '';
        document.getElementById('collection-name').focus();
    }

    function createCollection() {
        const nameInput = document.getElementById('collection-name');
        const name = nameInput.value.trim();
        if (name) {
            collections[name] = [];
            saveState();
            renderCollections();
            updateSaveCollectionOptions();
            hideModals();
            nameInput.value = '';
        }
    }

    function saveRequest() {
        const nameInput = document.getElementById('save-name');
        const collSelect = document.getElementById('save-collection');
        const name = nameInput.value.trim();
        const collection = collSelect.value;

        if (!name) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'Please enter a request name' });
            return;
        }

        if (!collection) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'Please select a collection first' });
            return;
        }

        const reqToSave = {
            name,
            method: methodSelect.value,
            url: urlInput.textContent,
            headers: headersTextarea.textContent,
            body: bodyTextarea.textContent,
            queryParams: [...queryParams]
        };

        if (!collections[collection]) {collections[collection] = [];}
        collections[collection].push(reqToSave);

        saveState();
        renderCollections();
        hideModals();
        nameInput.value = '';

        vscode.postMessage({ type: 'notify', level: 'info', text: 'Request saved successfully!' });
    }

    function renderCollections() {
        const container = document.getElementById('collections-list');
        if(!container) {return;}
        container.innerHTML = '';

        Object.entries(collections).forEach(([name, requests]) => {
            const div = document.createElement('div');
            div.className = 'collection-item';
            div.innerHTML = `<strong>📁 ${name}</strong> <span style="opacity:0.6">(${requests.length})</span>`;
            div.style.cursor = 'pointer';
            div.style.padding = '5px';
            
            // Allow expanding to see requests
            div.addEventListener('click', () => {
                // Simple toggle logic or expand implementation
                // For now, let's just log or you can implement a sub-list
                const subList = document.createElement('div');
                subList.style.marginLeft = '15px';
                requests.forEach(req => {
                    const rDiv = document.createElement('div');
                    rDiv.textContent = `📄 ${req.name}`;
                    rDiv.style.fontSize = '0.9em';
                    rDiv.onclick = (e) => { e.stopPropagation(); loadRequestIntoForm(req); };
                    subList.appendChild(rDiv);
                });
                if(div.childElementCount > 2) { // Already expanded
                   div.innerHTML = `<strong>📁 ${name}</strong> <span style="opacity:0.6">(${requests.length})</span>`;
                } else {
                   div.appendChild(subList);
                }
            });
            container.appendChild(div);
        });
    }

    function updateSaveCollectionOptions() {
        const select = document.getElementById('save-collection');
        select.innerHTML = '<option value="">Select Collection</option>';
        Object.keys(collections).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }

    function loadRequestIntoForm(item) {
        methodSelect.value = item.method;
        // Strip query params from URL input if they exist in the object, otherwise parse them
        if (item.queryParams && item.queryParams.length > 0) {
            urlInput.textContent = item.url.split('?')[0];
            queryParams = item.queryParams;
        } else {
            urlInput.textContent = item.url;
            queryParams = []; // Reset and parse later if needed
        }

        headersTextarea.textContent = item.headers;
        bodyTextarea.textContent = item.body || '';
        renderQueryParams();
        switchTab('request');
        updatePreview();
    }

    // ---------------------------------------------------------
    // Import / Export
    // ---------------------------------------------------------

    function exportToCurl() {
        // تأكد إن فيه Request أصلاً
        const url = constructFullUrl(); // أو urlInput.value حسب الـ Helper عندك
        if (!url) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'Please enter a URL first' });
            return;
        }

        const method = methodSelect.value;
        const headers = headersTextarea.textContent;
        const body = bodyTextarea.textContent;

        let cmd = `curl -X ${method} "${url}"`;

        if (headers) {
            headers.split('\n').forEach(line => {
                if(line.includes(':')) {
                    // Escape double quotes just in case
                    const safeLine = line.trim().replace(/"/g, '\\"');
                    cmd += ` -H "${safeLine}"`;
                }
            });
        }

        if (body) {
            // Escape single quotes for shell safety
            const safeBody = body.replace(/'/g, "'\\''");
            cmd += ` -d '${safeBody}'`;
        }

        navigator.clipboard.writeText(cmd).then(() => {
            // بدل alert، نبعت إشعار
            vscode.postMessage({ type: 'notify', level: 'info', text: '✅ cURL command copied to clipboard!' });
        }, () => {
            vscode.postMessage({ type: 'notify', level: 'error', text: '❌ Failed to copy to clipboard' });
        });
    }

    function showCurlImportModal() {
        const modal = document.getElementById('curl-import-modal');
        const input = document.getElementById('curl-import-input');
        modal.style.display = 'block';
        input.value = '';
        input.focus();
    }

    function executeCurlImport() {
        const curlText = document.getElementById('curl-import-input').value.trim();

        if (!curlText) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'Please paste a cURL command' });
            return;
        }

        try {
            // 1. Extract Method
            const methodMatch = curlText.match(/-X\s+(\w+)/i) || curlText.match(/--request\s+(\w+)/i);
            if (methodMatch) {methodSelect.value = methodMatch[1].toUpperCase();}
            else {methodSelect.value = 'GET';} // Default

            // 2. Extract URL (Look for http/https inside quotes or plain)
            const urlMatch = curlText.match(/["'](https?:\/\/[^"']+)["']/) || curlText.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
                // Check if URL has query params
                const fullUrl = urlMatch[1];
                if (fullUrl.includes('?')) {
                    urlInput.textContent = fullUrl.split('?')[0];
                    // Parse Params (Optional enhancement: populate query params list)
                    // For now, let's keep it simple or user constructs URL manually
                } else {
                    urlInput.textContent = fullUrl;
                }
            }

            // 3. Extract Headers
            const headerRegex = /-H\s+["']([^"']+)["']/g;
            let headerMatch;
            let headersList = [];
            while ((headerMatch = headerRegex.exec(curlText)) !== null) {
                headersList.push(headerMatch[1]);
            }
            if (headersList.length > 0) {
                headersTextarea.textContent = headersList.join('\n');
            } else {
                headersTextarea.textContent = '';
            }

            // 4. Extract Body (-d or --data)
            const dataMatch = curlText.match(/-d\s+['"]([^'"]+)['"]/) || curlText.match(/--data\s+['"]([^'"]+)['"]/);
            if (dataMatch) {
                // Try to format if it's JSON
                try {
                    const jsonBody = JSON.parse(dataMatch[1]);
                    bodyTextarea.textContent = JSON.stringify(jsonBody, null, 2);
                } catch (e) {
                    bodyTextarea.textContent = dataMatch[1];
                }
            } else {
                bodyTextarea.textContent = '';
            }

            hideModals();
            vscode.postMessage({ type: 'notify', level: 'info', text: '✅ cURL imported successfully!' });

            // Trigger preview update
            updatePreview();

        } catch (e) {
            vscode.postMessage({ type: 'notify', level: 'error', text: 'Error parsing cURL: ' + e.message });
        }
    }



    // ---------------------------------------------------------
    // State & Message Handling
    // ---------------------------------------------------------

    function loadState() {
         const state = vscode.getState();
         if(state) {
             history = state.history || [];
             collections = state.collections || {};

             // Auto-create 'Default' collection if none exist
             if (Object.keys(collections).length === 0) {
                 collections['Default'] = [];
                 saveState();
             }

             renderHistory();
             renderCollections();
             updateSaveCollectionOptions();
         } else {
             // First time load ever
             collections['Default'] = [];
             saveState();
             updateSaveCollectionOptions();
         }
    }

    function saveState() {
        const state = { history, collections, settings };
        vscode.setState(state);
        // Also sync with global extension state if needed via message
        vscode.postMessage({ type: 'saveState', state });
    }

    function hideModals() {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }

    function showSaveModal() {
        updateSaveCollectionOptions();
        document.getElementById('save-modal').style.display = 'block';
    }
    
    function validateCurrentRequest() {
         vscode.postMessage({
            type: 'validateVariables',
            environment: environmentSelect.value,
            inputs: {
                url: constructFullUrl(),
                headers: headersTextarea.textContent,
                body: bodyTextarea.textContent
            }
        });
    }
    
    function updateSettingsUI() {
        // Implementation for settings UI update
    }
    
    function clearHistory() {
        history = [];
        saveState();
        renderHistory();
    }

    // Incoming Messages
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'environments':
                environments = message.environments || [];
                // Save current selection
                const currentEnv = environmentSelect.value;
                
                environmentSelect.innerHTML = '<option value="none">No Environment</option>';
                environments.forEach(env => {
                    const opt = document.createElement('option');
                    opt.value = env.name;
                    opt.textContent = `${env.name} (${Object.keys(env.variables).length} vars)`;
                    environmentSelect.appendChild(opt);
                });
                
                // Restore selection if exists
                if(environments.some(e => e.name === currentEnv)) {
                    environmentSelect.value = currentEnv;
                }
                
                // Trigger change to update counts
                onEnvironmentChange();
                break;

            case 'response':
                sendButton.textContent = 'Send Request';
                sendButton.disabled = false;
                
                // Show Response Tab
                document.getElementById('response-info').innerHTML = `
                    <span class="${message.status >= 200 && message.status < 300 ? 'status-success' : 'status-error'}" 
                    style="padding:3px 8px; border-radius:4px; background:#333; color:white;">
                    ${message.status} ${message.statusText}</span>
                    <span style="margin-left:10px">${message.duration}ms</span>
                `;
                
                try {
                    const jsonBody = JSON.stringify(message.data, null, 2);
                    document.getElementById('response-body').textContent = jsonBody;
                } catch(e) {
                    document.getElementById('response-body').textContent = message.data;
                }
                document.getElementById('response-headers').textContent = JSON.stringify(message.headers, null, 2);
                
                addToHistory(currentRequest, message, message.duration);
                break;

            case 'error':
                sendButton.textContent = 'Send Request';
                sendButton.disabled = false;
                document.getElementById('response-info').innerHTML = `<span style="color:red">Error: ${message.error}</span>`;
                break;

            case 'previewResult':
                showPreview(message.url, message.headers, message.body, message.errors);
                break;

            case 'validationResult':
                if(validationContent) {
                    validationContent.innerHTML = message.valid 
                        ? '<div style="color:green">✓ All variables valid</div>' 
                        : `<div style="color:red">⚠ Missing: ${message.message}</div>`;
                    validationPanel.style.display = 'block';
                }
                break;
        }
    });

})();
