import { state } from './state.js';
import { post, notify } from './api.js';
import { escapeHtml, confirmAction } from './ui.js';
import { saveState } from './collections.js';

export function addToHistory(request, response, duration) {
    if (!request) { return; }
    const historyItem = {
        ...request,
        responseStatus: response.status,
        timestamp: new Date().toISOString(),
        duration: duration
    };
    state.history.unshift(historyItem);
    if (state.history.length > 50) { state.history = state.history.slice(0, 50); }
    saveState();
    renderHistory();
}

export function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) { return; }
    container.innerHTML = '';

    const searchInput = document.getElementById('history-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    let displayList = state.history;
    if (searchTerm) {
        displayList = displayList.filter(item => {
            const urlMatch = (item.url || '').toLowerCase().includes(searchTerm);
            const methodMatch = (item.method || '').toLowerCase().includes(searchTerm);
            const statusMatch = (item.responseStatus || '').toString().includes(searchTerm);
            return urlMatch || methodMatch || statusMatch;
        });
    }

    if (displayList.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-message';
        emptyDiv.textContent = searchTerm ? 'No matching history found' : 'No history yet';
        container.appendChild(emptyDiv);
        return;
    }
    displayList.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'history-item cursor-pointer';
        const statusClass = item.responseStatus >= 200 && item.responseStatus < 300 ? 'status-success' : 'status-error';
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
        const tooltip = item.notes ? `\n\nNotes:\n${item.notes}` : '';
        div.title = `${item.method} ${item.url}\nStatus: ${item.responseStatus} • ${item.duration}ms${tooltip}`;
        div.addEventListener('click', () => {
            import('./request.js').then(m => m.loadRequestIntoForm(item));
        });
        container.appendChild(div);
    });
}

export function clearHistory() {
    if (state.history.length === 0) return;
    confirmAction('Clear all history? This cannot be undone.', () => {
        state.history = [];
        saveState();
        renderHistory();
        notify('info', 'History cleared');
    });
}