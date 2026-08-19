export function createDefaultAuthConfig() {
    return {
        type: 'none',
        username: '',
        password: '',
        token: '',
        keyName: '',
        keyValue: '',
        keyIn: 'header',
        tokenUrl: '',
        clientId: '',
        clientSecret: '',
        scope: '',
        accessToken: '',
        tokenType: 'Bearer',
        expiresIn: null,
        tokenReceivedAt: null
    };
}

export function createPersistableAuthConfig(authConfig = state.authConfig) {
    return {
        ...authConfig,
        password: '',
        token: '',
        keyValue: '',
        clientSecret: '',
        accessToken: '',
        expiresIn: null,
        tokenReceivedAt: null
    };
}

export const state = {
    queryParams: [],
    headers: [],          // key-value pairs, mirrors queryParams pattern
    history: [],
    collections: {},
    expandedCollections: new Set(),
    currentRequest: null,
    settings: {
        timeout: 10000,
        sslVerify: true,
        shortcuts: {
            sendRequest: 'ctrl+enter',
            saveRequest: 'ctrl+s',
            clearForm: 'ctrl+k',
            closeModal: 'escape'
        }
    },
    environments: [],
    activeEnvironment: 'none',
    isRequestInProgress: false,
    authConfig: createDefaultAuthConfig(),
    lastResponseHeaders: {},
    lastLoadedCollection: null
};