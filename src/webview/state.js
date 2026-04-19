export const state = {
    queryParams: [],
    headers: [],          // key-value pairs, mirrors queryParams pattern
    history: [],
    collections: {},
    expandedCollections: new Set(),
    currentRequest: null,
    settings: {
        timeout: 10000,
        shortcuts: {
            sendRequest: 'ctrl+enter',
            saveRequest: 'ctrl+s',
            clearForm: 'ctrl+k',
            closeModal: 'escape'
        }
    },
    environments: [],
    isRequestInProgress: false,
    authConfig: { type: 'none', username: '', password: '', token: '', keyName: '', keyValue: '', keyIn: 'header' },
    lastLoadedCollection: null
};