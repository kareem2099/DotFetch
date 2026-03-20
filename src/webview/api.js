let _vscode = null;

export function initApi(vscode) {
    _vscode = vscode;
}

export function post(message) {
    _vscode.postMessage(message);
}

export function notify(level, text) {
    _vscode.postMessage({ type: 'notify', level, text });
}

export function saveVsState(state) {
    _vscode.setState(state);
}