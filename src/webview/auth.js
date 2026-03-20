import { state } from './state.js';
import { notify } from './api.js';

export function onAuthTypeChange() {
    const authTypeSelect = document.getElementById('auth-type');
    const basicAuthFields = document.getElementById('basic-auth-fields');
    const bearerAuthFields = document.getElementById('bearer-auth-fields');

    state.authConfig.type = authTypeSelect ? authTypeSelect.value : 'none';

    if (basicAuthFields) { basicAuthFields.classList.add('hidden-element'); }
    if (bearerAuthFields) { bearerAuthFields.classList.add('hidden-element'); }

    if (state.authConfig.type === 'basic' && basicAuthFields) {
        basicAuthFields.classList.remove('hidden-element');
        updateBasicAuthPreview();
    } else if (state.authConfig.type === 'bearer' && bearerAuthFields) {
        bearerAuthFields.classList.remove('hidden-element');
        updateBearerAuthPreview();
    }
}

export function updateBasicAuthPreview() {
    const authUsername = document.getElementById('auth-username');
    const authPassword = document.getElementById('auth-password');
    state.authConfig.username = authUsername ? authUsername.value : '';
    state.authConfig.password = authPassword ? authPassword.value : '';
    const preview = document.getElementById('basic-auth-preview');
    if (!preview) { return; }
    if (state.authConfig.username) {
        const encoded = btoa(`${state.authConfig.username}:${state.authConfig.password}`);
        preview.textContent = `Authorization: Basic ${encoded}`;
        preview.classList.add('auth-preview-visible');
    } else {
        preview.textContent = '';
        preview.classList.remove('auth-preview-visible');
    }
}

export function updateBearerAuthPreview() {
    const authToken = document.getElementById('auth-token');
    state.authConfig.token = authToken ? authToken.value : '';
    const preview = document.getElementById('bearer-auth-preview');
    if (!preview) { return; }
    if (state.authConfig.token) {
        preview.textContent = `Authorization: Bearer ${state.authConfig.token}`;
        preview.classList.add('auth-preview-visible');
    } else {
        preview.textContent = '';
        preview.classList.remove('auth-preview-visible');
    }
}

export function buildAuthHeader() {
    if (state.authConfig.type === 'basic' && state.authConfig.username) {
        const encoded = btoa(`${state.authConfig.username}:${state.authConfig.password}`);
        return `Authorization: Basic ${encoded}`;
    }
    if (state.authConfig.type === 'bearer' && state.authConfig.token) {
        return `Authorization: Bearer ${state.authConfig.token}`;
    }
    return null;
}

export function restoreAuthUI(savedAuth) {
    if (!savedAuth || savedAuth.type === 'none') { return; }
    state.authConfig = { ...savedAuth };
    const authTypeSelect = document.getElementById('auth-type');
    const basicAuthFields = document.getElementById('basic-auth-fields');
    const bearerAuthFields = document.getElementById('bearer-auth-fields');
    if (authTypeSelect) { authTypeSelect.value = state.authConfig.type; }
    if (state.authConfig.type === 'basic') {
        const authUsername = document.getElementById('auth-username');
        const authPassword = document.getElementById('auth-password');
        if (authUsername) { authUsername.value = state.authConfig.username || ''; }
        if (authPassword) { authPassword.value = state.authConfig.password || ''; }
        if (basicAuthFields) { basicAuthFields.classList.remove('hidden-element'); }
        updateBasicAuthPreview();
    } else if (state.authConfig.type === 'bearer') {
        const authToken = document.getElementById('auth-token');
        if (authToken) { authToken.value = state.authConfig.token || ''; }
        if (bearerAuthFields) { bearerAuthFields.classList.remove('hidden-element'); }
        updateBearerAuthPreview();
    }
}