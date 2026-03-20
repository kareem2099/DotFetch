import { state } from './state.js';
import { post, notify, saveVsState } from './api.js';
import { escapeHtml, hideModals, confirmAction } from './ui.js';

export const TEMPLATES_COLLECTION = 'Templates';

export function saveState() {
    const s = { history: state.history, collections: state.collections, settings: state.settings };
    saveVsState(s);
    post({ type: 'saveState', state: s });
}

export function renderCollections() {
    const container = document.getElementById('collections-list');
    if (!container) { return; }
    container.innerHTML = '';
    const collectionNames = Object.keys(state.collections);
    if (collectionNames.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-message';
        emptyDiv.textContent = 'No collections yet';
        container.appendChild(emptyDiv);
        return;
    }
    collectionNames.forEach(name => {
        const requests = state.collections[name];
        const isExpanded = state.expandedCollections.has(name);
        const icon = isExpanded ? '📂' : '📁';
        const div = document.createElement('div');
        div.className = 'collection-item';
        const header = document.createElement('div');
        header.className = 'collection-header';
        header.innerHTML = `
            <span><strong>${icon} ${escapeHtml(name)}</strong> <span class="count-badge">(${requests.length})</span></span>
            <div style="display: flex; gap: 4px;">
                <button class="export-collection-btn icon-btn" title="Export collection to JSON">⬇️</button>
                <button class="delete-collection-btn icon-btn" title="Delete collection">🗑️</button>
            </div>
        `;
        header.addEventListener('click', (e) => {
            if (e.target.closest('.delete-collection-btn')) { deleteCollection(name); return; }
            if (e.target.closest('.export-collection-btn')) { exportCollection(name); return; }
            if (state.expandedCollections.has(name)) { state.expandedCollections.delete(name); }
            else { state.expandedCollections.add(name); }
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
                    if (e.target.closest('.delete-request-btn')) { deleteRequest(name, idx); return; }
                    import('./request.js').then(m => m.loadRequestIntoForm(req));
                });
                rDiv.addEventListener('mouseenter', () => rDiv.classList.add('request-item-hover'));
                rDiv.addEventListener('mouseleave', () => rDiv.classList.remove('request-item-hover'));
                subList.appendChild(rDiv);
            });
            div.appendChild(subList);
        }
        container.appendChild(div);
    });
}

export function deleteCollection(name) {
    confirmAction(`Delete collection "${name}"? This will delete all ${state.collections[name].length} request(s) in it.`, () => {
        delete state.collections[name];
        state.expandedCollections.delete(name);
        saveState();
        renderCollections();
        updateSaveCollectionOptions();
        notify('info', `Collection "${name}" deleted`);
    });
}

export function exportCollection(name) {
    const requests = state.collections[name] || [];
    const payload = {
        metadata: {
            collectionName: name,
            exportTimestamp: new Date().toISOString(),
            requestCount: requests.length,
            version: '1.2.0'
        },
        requests: requests
    };
    
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'collection';
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `${safeName}-${dateStr}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    notify('info', `Collection "${name}" exported.`);
}

export function deleteRequest(collectionName, requestIndex) {
    if (state.collections[collectionName] && state.collections[collectionName][requestIndex]) {
        const requestName = state.collections[collectionName][requestIndex].name;
        state.collections[collectionName].splice(requestIndex, 1);
        saveState();
        renderCollections();
        notify('info', `Request "${requestName}" deleted`);
    }
}

export function updateSaveCollectionOptions() {
    const select = document.getElementById('save-collection');
    if (!select) { return; }
    select.innerHTML = '<option value="">Select Collection</option>';
    Object.keys(state.collections).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

export function showCollectionModal() {
    const modal = document.getElementById('collection-modal');
    const nameInput = document.getElementById('collection-name');
    if (modal) { 
        modal.style.display = 'block';
        modal.classList.add('modal-visible'); 
    }
    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
}

export function createCollection() {
    const nameInput = document.getElementById('collection-name');
    if (!nameInput) { return; }
    const name = nameInput.value.trim();
    if (!name) { notify('error', 'Please enter a collection name'); return; }
    if (state.collections[name]) { notify('error', 'Collection already exists'); return; }
    state.collections[name] = [];
    saveState();
    renderCollections();
    updateSaveCollectionOptions();
    hideModals();
    notify('info', `Collection "${name}" created`);
}

// Templates (T204)
export function renderTemplateSelector() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect) { return; }
    const templates = state.collections[TEMPLATES_COLLECTION] || [];
    const currentValue = templateSelect.value;
    templateSelect.innerHTML = '<option value="">-- Select Template --</option>';
    templates.forEach(t => {
        const option = document.createElement('option');
        option.value = t.name;
        const usageText = t.usageCount ? ` (used ${t.usageCount}×)` : '';
        option.textContent = `${t.method} — ${t.name}${usageText}`;
        templateSelect.appendChild(option);
    });
    if (templates.some(t => t.name === currentValue)) { templateSelect.value = currentValue; }
    const wrap = document.getElementById('template-selector-wrap');
    if (wrap) { wrap.style.display = templates.length > 0 ? 'block' : 'none'; }
}

export function saveAsTemplate() {
    const urlInput = document.getElementById('url');
    const url = urlInput ? urlInput.value.trim() : '';
    if (!url) { notify('error', 'Please enter a URL before saving as template'); return; }
    const methodSelect = document.getElementById('method');
    const method = methodSelect ? methodSelect.value : 'GET';
    const urlPath = url.split('/').pop() || url;
    const modal = document.getElementById('template-modal');
    const nameInput = document.getElementById('template-name');
    if (modal) { 
        modal.style.display = 'block'; 
        modal.classList.add('modal-visible'); 
    }
    if (nameInput) { nameInput.value = `${method} ${urlPath}`; nameInput.focus(); nameInput.select(); }
}

export function confirmSaveAsTemplate() {
    const nameInput = document.getElementById('template-name');
    if (!nameInput) { return; }
    const name = nameInput.value.trim();
    if (!name) { notify('error', 'Please enter a template name'); return; }
    if (!state.collections[TEMPLATES_COLLECTION]) { state.collections[TEMPLATES_COLLECTION] = []; }
    if (state.collections[TEMPLATES_COLLECTION].some(t => t.name === name)) {
        notify('error', `Template "${name}" already exists`); return;
    }
    const urlInput = document.getElementById('url');
    const methodSelect = document.getElementById('method');
    const headersTextarea = document.getElementById('headers');
    const bodyTextarea = document.getElementById('body');
    const notesTextarea = document.getElementById('request-notes');
    const template = {
        name,
        method: methodSelect ? methodSelect.value : 'GET',
        url: urlInput ? urlInput.value : '',
        headers: headersTextarea ? headersTextarea.value : '',
        body: bodyTextarea ? bodyTextarea.value : '',
        notes: notesTextarea ? notesTextarea.value : '',
        queryParams: [...state.queryParams],
        auth: { ...state.authConfig },
        createdAt: new Date().toISOString(),
        usageCount: 0
    };
    state.collections[TEMPLATES_COLLECTION].push(template);
    saveState();
    renderCollections();
    renderTemplateSelector();
    hideModals();
    notify('info', `✅ Template "${name}" saved!`);
}

export function loadSelectedTemplate() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect || !templateSelect.value) { notify('error', 'Please select a template first'); return; }
    const templateName = templateSelect.value;
    const templates = state.collections[TEMPLATES_COLLECTION] || [];
    const template = templates.find(t => t.name === templateName);
    if (!template) { notify('error', 'Template not found'); return; }
    template.usageCount = (template.usageCount || 0) + 1;
    saveState();
    import('./request.js').then(m => m.loadRequestIntoForm(template));
    notify('info', `📌 Template "${templateName}" loaded`);
}

export function deleteSelectedTemplate() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect || !templateSelect.value) { notify('error', 'Please select a template first'); return; }
    const templateName = templateSelect.value;
    confirmAction(`Delete template "${templateName}"?`, () => {
        const templates = state.collections[TEMPLATES_COLLECTION] || [];
        const index = templates.findIndex(t => t.name === templateName);
        if (index !== -1) {
            state.collections[TEMPLATES_COLLECTION].splice(index, 1);
            saveState();
            renderCollections();
            renderTemplateSelector();
            notify('info', `Template "${templateName}" deleted`);
        }
    });
}