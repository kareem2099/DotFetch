"use strict";
(() => {
  // src/webview/state.js
  function createDefaultAuthConfig() {
    return {
      type: "none",
      username: "",
      password: "",
      token: "",
      keyName: "",
      keyValue: "",
      keyIn: "header",
      tokenUrl: "",
      clientId: "",
      clientSecret: "",
      scope: "",
      accessToken: "",
      tokenType: "Bearer",
      expiresIn: null,
      tokenReceivedAt: null
    };
  }
  function createPersistableAuthConfig(authConfig = state.authConfig) {
    return {
      ...authConfig,
      password: "",
      token: "",
      keyValue: "",
      clientSecret: "",
      accessToken: "",
      expiresIn: null,
      tokenReceivedAt: null
    };
  }
  var state = {
    queryParams: [],
    headers: [],
    // key-value pairs, mirrors queryParams pattern
    history: [],
    collections: {},
    expandedCollections: /* @__PURE__ */ new Set(),
    currentRequest: null,
    settings: {
      timeout: 1e4,
      sslVerify: true,
      shortcuts: {
        sendRequest: "ctrl+enter",
        saveRequest: "ctrl+s",
        clearForm: "ctrl+k",
        closeModal: "escape"
      }
    },
    environments: [],
    activeEnvironment: "none",
    isRequestInProgress: false,
    authConfig: createDefaultAuthConfig(),
    lastResponseHeaders: {},
    lastResponseRawData: null,
    responseViewMode: "pretty",
    lastLoadedCollection: null
  };

  // src/webview/ui.js
  function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    const tabContent = document.getElementById(tabName + "-tab");
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabContent) {
      tabContent.classList.add("active");
    }
    if (tabButton) {
      tabButton.classList.add("active");
    }
  }
  function escapeHtml(text) {
    if (!text) {
      return "";
    }
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function showCopiedState(button, duration = 1600) {
    if (!button) {
      return;
    }
    const originalText = button.textContent;
    button.textContent = "\u2713 Copied";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, duration);
  }
  function renderQueryParams() {
    const container = document.getElementById("params-list");
    if (!container) {
      return;
    }
    container.innerHTML = "";
    state.queryParams.forEach((param, index) => {
      container.appendChild(_makeKVRow(param, index, "queryParams", updateParamsCount));
    });
    updateParamsCount();
  }
  function renderHeaders() {
    const container = document.getElementById("headers-list");
    if (!container) {
      return;
    }
    container.innerHTML = "";
    state.headers.forEach((header, index) => {
      container.appendChild(_makeKVRow(header, index, "headers", updateHeadersCount));
    });
    updateHeadersCount();
  }
  function _makeKVRow(item, index, stateKey, onUpdate) {
    const row = document.createElement("div");
    row.className = "kv-row" + (item.enabled === false ? " disabled" : "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "kv-checkbox";
    checkbox.checked = item.enabled !== false;
    checkbox.title = "Enable or disable row";
    checkbox.addEventListener("change", (e) => {
      state[stateKey][index].enabled = e.target.checked;
      row.classList.toggle("disabled", !e.target.checked);
      if (onUpdate) {
        onUpdate();
      }
    });
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.className = "url-input kv-key";
    keyInput.placeholder = "Key";
    keyInput.value = item.key || "";
    keyInput.addEventListener("input", (e) => {
      state[stateKey][index].key = e.target.value;
      if (onUpdate) {
        onUpdate();
      }
    });
    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.className = "url-input kv-value";
    valInput.placeholder = "Value";
    valInput.value = item.value || "";
    valInput.addEventListener("input", (e) => {
      state[stateKey][index].value = e.target.value;
      if (onUpdate) {
        onUpdate();
      }
    });
    const removeBtn = document.createElement("button");
    removeBtn.className = "tool-btn kv-remove";
    removeBtn.title = "Remove";
    removeBtn.textContent = "\xD7";
    removeBtn.addEventListener("click", () => {
      state[stateKey].splice(index, 1);
      stateKey === "headers" ? renderHeaders() : renderQueryParams();
    });
    row.appendChild(checkbox);
    row.appendChild(keyInput);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    return row;
  }
  function updateParamsCount() {
    const el = document.getElementById("params-count");
    if (!el) {
      return;
    }
    const n = state.queryParams.filter((p) => p.enabled !== false && p.key && p.key.trim()).length;
    el.textContent = n > 0 ? String(n) : "";
  }
  function updateHeadersCount() {
    const el = document.getElementById("headers-count");
    if (!el) {
      return;
    }
    const n = state.headers.filter((h) => h.enabled !== false && h.key && h.key.trim()).length;
    el.textContent = n > 0 ? String(n) : "";
  }
  function updateMethodColor(method) {
    const select = document.getElementById("method");
    if (!select) {
      return;
    }
    const m = (method || select.value || "GET").toUpperCase();
    select.className = "method-select method-" + m;
  }
  function updateTabDots() {
    const authDot = document.getElementById("auth-dot");
    if (authDot) {
      const hasAuth = state.authConfig && state.authConfig.type && state.authConfig.type !== "none";
      authDot.classList.toggle("hidden", !hasAuth);
    }
    const bodyDot = document.getElementById("body-dot");
    if (bodyDot) {
      const bodyEl = document.getElementById("body");
      const hasBody = Boolean(bodyEl && bodyEl.value && bodyEl.value.trim());
      bodyDot.classList.toggle("hidden", !hasBody);
    }
    const notesDot = document.getElementById("notes-dot");
    if (notesDot) {
      const notesEl = document.getElementById("notes");
      const hasNotes = Boolean(notesEl && notesEl.value && notesEl.value.trim());
      notesDot.classList.toggle("hidden", !hasNotes);
    }
  }
  function serializeHeaders() {
    return state.headers.filter((h) => h.enabled !== false && h.key && h.key.trim()).map((h) => `${h.key.trim()}: ${h.value.trim()}`).join("\n");
  }
  function parseHeadersIntoState(raw) {
    if (!raw) {
      state.headers = [];
      return;
    }
    state.headers = raw.split("\n").map((line) => {
      const idx = line.indexOf(":");
      if (idx < 1) {
        return null;
      }
      return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim(), enabled: true };
    }).filter(Boolean);
  }
  function constructFullUrl() {
    const urlInput = document.getElementById("url");
    if (!urlInput) {
      return "";
    }
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) {
      return "";
    }
    const validParams = state.queryParams.filter((p) => p.enabled !== false && p.key && p.value);
    if (validParams.length > 0) {
      const separator = baseUrl.includes("?") ? "&" : "?";
      const qs = validParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
      return `${baseUrl}${separator}${qs}`;
    }
    return baseUrl;
  }
  function updateEnvironmentIndicator(envName, varCount) {
    const badge = document.getElementById("env-badge");
    if (!badge) {
      return;
    }
    badge.textContent = envName === "none" ? "No Environment" : envName;
    const isProd = envName.toLowerCase().includes("prod");
    badge.style.color = isProd ? "#f85149" : "#58a6ff";
    badge.style.background = isProd ? "rgba(248,81,73,0.15)" : "rgba(56,139,253,0.15)";
    badge.removeAttribute("title");
    badge.tabIndex = 0;
    if (envName === "none") {
      badge.dataset.tooltip = "No active environment selected";
    } else {
      const countStr = typeof varCount === "number" ? ` \u2022 ${varCount} variable${varCount === 1 ? "" : "s"}` : "";
      badge.dataset.tooltip = `Active Environment: ${envName}${countStr}`;
    }
    checkEnvVariableHint();
  }
  function checkEnvVariableHint() {
    const banner = document.getElementById("env-hint-banner");
    if (!banner) {
      return;
    }
    const activeEnv = state.activeEnvironment || "none";
    if (activeEnv !== "none") {
      banner.classList.add("hidden");
      return;
    }
    const url = document.getElementById("url")?.value || "";
    const body = document.getElementById("body")?.value || "";
    const headerStr = state.headers.map((h) => `${h.key} ${h.value}`).join(" ");
    const combined = `${url} ${headerStr} ${body}`;
    const varMatch = combined.match(/\{\{([a-zA-Z0-9_-]+)\}\}/);
    if (varMatch) {
      const varName = varMatch[1];
      banner.innerHTML = `<span>\u26A0\uFE0F Variable <code>{{${escapeHtml(varName)}}}</code> detected, but <strong>No Environment</strong> is selected.</span>`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }
  function showToast(type, message, duration) {
    const container = document.getElementById("toast-container");
    if (!container) {
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type || "info"}`;
    let icon = "\u2139\uFE0F";
    if (type === "success") {
      icon = "\u2713";
    } else if (type === "warning") {
      icon = "\u26A0\uFE0F";
    } else if (type === "error") {
      icon = "\u2715";
    }
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button type="button" class="toast-close" title="Dismiss">\u2715</button>
    `;
    toast.querySelector(".toast-close")?.addEventListener("click", () => {
      dismissToast(toast);
    });
    while (container.children.length >= 3) {
      dismissToast(container.firstElementChild);
    }
    container.appendChild(toast);
    let autoDuration = duration;
    if (!autoDuration) {
      if (type === "error") {
        autoDuration = 5e3;
      } else if (type === "warning") {
        autoDuration = 4e3;
      } else {
        autoDuration = 2500;
      }
    }
    const timer = setTimeout(() => {
      dismissToast(toast);
    }, autoDuration);
    toast._dismissTimer = timer;
  }
  function dismissToast(toast) {
    if (!toast || toast._dismissing) {
      return;
    }
    toast._dismissing = true;
    if (toast._dismissTimer) {
      clearTimeout(toast._dismissTimer);
    }
    toast.classList.add("toast-fade-out");
    setTimeout(() => {
      toast.remove();
    }, 200);
  }
  function hideModals() {
    document.querySelectorAll(".modal").forEach((m) => {
      m.style.display = "none";
    });
  }
  function switchResponseTab(tabName) {
    document.querySelectorAll(".response-tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".res-tab-btn").forEach((b) => b.classList.remove("active"));
    const tabContent = document.getElementById(`response-${tabName}-tab`);
    const tabButton = document.querySelector(`[data-res-tab="${tabName}"]`);
    if (tabContent) {
      tabContent.classList.add("active");
    }
    if (tabButton) {
      tabButton.classList.add("active");
    }
  }
  function switchResponseViewMode(mode) {
    state.responseViewMode = mode;
    const prettyBtn = document.getElementById("res-view-pretty");
    const rawBtn = document.getElementById("res-view-raw");
    if (prettyBtn) {
      prettyBtn.classList.toggle("active", mode === "pretty");
    }
    if (rawBtn) {
      rawBtn.classList.toggle("active", mode === "raw");
    }
    if (state.lastResponseRawData !== null && state.lastResponseRawData !== void 0) {
      renderResponseBody(state.lastResponseRawData);
    }
  }
  function renderResponseBody(data) {
    const container = document.getElementById("response-body");
    if (!container) {
      return;
    }
    if (data === null || data === void 0) {
      container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\u26A1</div>
                <div class="empty-title">Ready to Send</div>
                <div class="empty-desc">Send a request to inspect its response body, status, and headers.</div>
            </div>`;
      return;
    }
    const isPretty = state.responseViewMode === "pretty";
    if (typeof data === "object") {
      if (isPretty) {
        const jsonStr = JSON.stringify(data, null, 2);
        container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);">${syntaxHighlightJson(jsonStr)}</pre>`;
      } else {
        const rawStr = JSON.stringify(data);
        container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;">${escapeHtml(rawStr)}</pre>`;
      }
      return;
    }
    const strData = String(data);
    if (isPretty) {
      try {
        const parsed = JSON.parse(strData);
        if (typeof parsed === "object" && parsed !== null) {
          container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);">${syntaxHighlightJson(JSON.stringify(parsed, null, 2))}</pre>`;
          return;
        }
      } catch {
      }
    }
    container.innerHTML = `<pre style="margin:0;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;">${escapeHtml(strData)}</pre>`;
  }
  function renderResponseHeaders(headers) {
    const container = document.getElementById("response-headers-list");
    const badge = document.getElementById("res-headers-count");
    if (!container) {
      return;
    }
    if (!headers || typeof headers !== "object" || Object.keys(headers).length === 0) {
      container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">\u{1F4CB}</div>
                <div class="empty-title">No Headers Yet</div>
                <div class="empty-desc">Response headers will appear here after sending a request.</div>
            </div>`;
      if (badge) {
        badge.textContent = "";
      }
      return;
    }
    const headerKeys = Object.keys(headers);
    if (badge) {
      badge.textContent = String(headerKeys.length);
    }
    let html = `<table class="res-header-table"><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>`;
    for (const key of headerKeys) {
      const val = typeof headers[key] === "object" ? JSON.stringify(headers[key]) : String(headers[key]);
      html += `<tr><td class="res-header-key">${escapeHtml(key)}</td><td class="res-header-val">${escapeHtml(val)}</td></tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
  }
  function updateSslIndicator(sslVerify) {
    const badge = document.getElementById("ssl-badge");
    if (!badge) {
      return;
    }
    badge.style.display = sslVerify === false ? "inline-block" : "none";
  }
  function syntaxHighlightJson(json) {
    if (typeof json !== "string") {
      json = JSON.stringify(json, null, 2);
    }
    json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-boolean";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  // src/webview/api.js
  var _vscode = null;
  function initApi(vscode) {
    _vscode = vscode;
  }
  function post(message) {
    _vscode.postMessage(message);
  }
  function notify(level, text) {
    showToast(level, text);
    if (level === "error") {
      _vscode.postMessage({ type: "notify", level, text });
    }
  }
  function copyText(text, button) {
    if (text === null || text === void 0) {
      return;
    }
    if (_vscode) {
      _vscode.postMessage({ type: "copyToClipboard", text: String(text) });
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text)).catch(() => {
        });
      }
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = String(text);
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        textarea.style.left = "-9999px";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
      }
    }
    if (button) {
      showCopiedState(button);
    }
  }

  // src/webview/auth.js
  function maskSecret(str) {
    if (!str || typeof str !== "string") {
      return "";
    }
    if (str.includes("{{")) {
      return str;
    }
    if (str.length <= 8) {
      return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
    }
    return `${str.substring(0, 4)}\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022${str.substring(str.length - 4)}`;
  }
  function formatHumanExpiry(expiresInSeconds, tokenReceivedAt) {
    if (!expiresInSeconds) {
      return "No expiration specified";
    }
    if (!tokenReceivedAt) {
      return `Expires in: ${expiresInSeconds}s`;
    }
    const remainingMs = expiresInSeconds * 1e3 - (Date.now() - tokenReceivedAt);
    if (remainingMs <= 0) {
      return "Token expired";
    }
    const remainingSec = Math.floor(remainingMs / 1e3);
    const hours = Math.floor(remainingSec / 3600);
    const minutes = Math.floor(remainingSec % 3600 / 60);
    const seconds = remainingSec % 60;
    if (hours > 0) {
      return `Expires in: ${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `Expires in: ${minutes}m ${seconds}s`;
    }
    return `Expires in: ${seconds}s`;
  }
  function renderAuthFields(type) {
    const container = document.getElementById("auth-fields");
    if (!container) {
      return;
    }
    state.authConfig.type = type || "none";
    updateTabDots();
    switch (type) {
      case "basic":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username or {{USER}}" autocomplete="off" value="${state.authConfig.username || ""}">
                    <div class="auth-input-group">
                        <input type="password" id="auth-password" class="url-input" placeholder="Password or {{PASS}}" autocomplete="off" value="${state.authConfig.password || ""}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-password" title="Show/Hide Password">\u{1F441}\uFE0F</button>
                    </div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
        setupBasicAuthListeners();
        updateBasicAuthPreview();
        break;
      case "bearer":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <div class="auth-input-group">
                        <input type="password" id="auth-token" class="url-input" placeholder="Bearer token or {{TOKEN}}" autocomplete="off" value="${state.authConfig.token || ""}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-token" title="Show/Hide Token">\u{1F441}\uFE0F</button>
                    </div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
        setupBearerAuthListeners();
        updateBearerAuthPreview();
        break;
      case "apikey":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-key-name" class="url-input" placeholder="Key name (e.g. X-API-Key)" autocomplete="off" value="${state.authConfig.keyName || ""}">
                    <div class="auth-input-group">
                        <input type="password" id="auth-key-value" class="url-input" placeholder="Value or {{API_KEY}}" autocomplete="off" value="${state.authConfig.keyValue || ""}">
                        <button type="button" class="auth-toggle-btn" id="toggle-auth-key" title="Show/Hide Value">\u{1F441}\uFE0F</button>
                    </div>
                    <select id="auth-key-in" class="method-select" style="width:160px;">
                        <option value="header" ${state.authConfig.keyIn === "header" ? "selected" : ""}>Add to Header</option>
                        <option value="query" ${state.authConfig.keyIn === "query" ? "selected" : ""}>Add to Query Params</option>
                    </select>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
        setupApiKeyListeners();
        updateApiKeyPreview();
        break;
      case "oauth2":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="oauth-token-url" class="url-input" placeholder="Token URL (e.g. https://auth.example.com/oauth/token)" autocomplete="off" value="${state.authConfig.tokenUrl || ""}">
                    <input type="text" id="oauth-client-id" class="url-input" placeholder="Client ID or {{CLIENT_ID}}" autocomplete="off" value="${state.authConfig.clientId || ""}">
                    <div class="auth-input-group">
                        <input type="password" id="oauth-client-secret" class="url-input" placeholder="Client Secret or {{CLIENT_SECRET}}" autocomplete="off" value="${state.authConfig.clientSecret || ""}">
                        <button type="button" class="auth-toggle-btn" id="toggle-oauth-secret" title="Show/Hide Secret">\u{1F441}\uFE0F</button>
                    </div>
                    <input type="text" id="oauth-scope" class="url-input" placeholder="Scope (optional, e.g. read:users)" autocomplete="off" value="${state.authConfig.scope || ""}">
                    
                    <button type="button" id="fetch-oauth-btn" class="oauth-fetch-btn">\u26A1 Fetch & Inject Token</button>

                    <div id="oauth-token-display"></div>
                    <div id="auth-preview" class="auth-preview-box hidden"></div>
                </div>`;
        setupOAuth2Listeners();
        renderOAuthTokenCard();
        updateOAuthPreview();
        break;
      default:
        container.innerHTML = "";
        break;
    }
  }
  function setupPasswordToggle(inputId, toggleBtnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(toggleBtnId);
    if (!input || !btn) {
      return;
    }
    btn.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "\u{1F648}" : "\u{1F441}\uFE0F";
    });
  }
  function setupBasicAuthListeners() {
    const usernameInput = document.getElementById("auth-username");
    const passwordInput = document.getElementById("auth-password");
    usernameInput?.addEventListener("input", (e) => {
      state.authConfig.username = e.target.value;
      updateBasicAuthPreview();
    });
    passwordInput?.addEventListener("input", (e) => {
      state.authConfig.password = e.target.value;
      updateBasicAuthPreview();
    });
    setupPasswordToggle("auth-password", "toggle-auth-password");
  }
  function updateBasicAuthPreview() {
    const preview = document.getElementById("auth-preview");
    if (!preview) {
      return;
    }
    const user = state.authConfig.username || "";
    const pass = state.authConfig.password || "";
    if (user || pass) {
      const hasVariables = user.includes("{{") || pass.includes("{{");
      if (hasVariables) {
        preview.innerHTML = `<span>Authorization: Basic &lt;resolved from env on send&gt;</span>`;
        preview.classList.remove("hidden");
        return;
      }
      let encoded = "";
      try {
        encoded = btoa(unescape(encodeURIComponent(`${user}:${pass}`)));
      } catch {
        encoded = "...";
      }
      preview.innerHTML = `<span>Authorization: Basic ${encoded}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", (e) => {
        copyText(`Authorization: Basic ${encoded}`, e.currentTarget);
      });
    } else {
      preview.classList.add("hidden");
    }
  }
  function setupBearerAuthListeners() {
    const tokenInput = document.getElementById("auth-token");
    tokenInput?.addEventListener("input", (e) => {
      state.authConfig.token = e.target.value;
      updateBearerAuthPreview();
    });
    setupPasswordToggle("auth-token", "toggle-auth-token");
  }
  function updateBearerAuthPreview() {
    const preview = document.getElementById("auth-preview");
    if (!preview) {
      return;
    }
    const token = state.authConfig.token || "";
    if (token) {
      preview.innerHTML = `<span>Authorization: Bearer <span class="auth-mask">${escapeHtml(maskSecret(token))}</span></span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", (e) => {
        copyText(`Authorization: Bearer ${token}`, e.currentTarget);
      });
    } else {
      preview.classList.add("hidden");
    }
  }
  function setupApiKeyListeners() {
    const keyNameInput = document.getElementById("auth-key-name");
    const keyValueInput = document.getElementById("auth-key-value");
    const keyInSelect = document.getElementById("auth-key-in");
    keyNameInput?.addEventListener("input", (e) => {
      state.authConfig.keyName = e.target.value;
      updateApiKeyPreview();
    });
    keyValueInput?.addEventListener("input", (e) => {
      state.authConfig.keyValue = e.target.value;
      updateApiKeyPreview();
    });
    keyInSelect?.addEventListener("change", (e) => {
      state.authConfig.keyIn = e.target.value;
      updateApiKeyPreview();
    });
    setupPasswordToggle("auth-key-value", "toggle-auth-key");
  }
  function updateApiKeyPreview() {
    const preview = document.getElementById("auth-preview");
    if (!preview) {
      return;
    }
    const keyName = state.authConfig.keyName || "";
    const keyValue = state.authConfig.keyValue || "";
    const keyIn = state.authConfig.keyIn || "header";
    const dupHintEl = document.getElementById("apikey-dup-hint");
    if (dupHintEl) {
      dupHintEl.remove();
    }
    if (keyName && keyValue) {
      const dupPattern = new RegExp(`^${keyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i");
      if (keyIn === "header" && dupPattern.test(keyValue.trim())) {
        const hint = document.createElement("div");
        hint.id = "apikey-dup-hint";
        hint.className = "auth-warning-hint";
        hint.innerHTML = `<span>\u26A0</span><span>Enter <strong>only the key value</strong> here \u2014 the header name is added automatically.</span>`;
        preview.before(hint);
      }
      const text = keyIn === "header" ? `${keyName}: ${keyValue}` : `?${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
      const maskedHtml = keyIn === "header" ? `Header: ${escapeHtml(keyName)}: <span class="auth-mask">${escapeHtml(maskSecret(keyValue))}</span>` : `Query Param: ?${escapeHtml(keyName)}=<span class="auth-mask">${escapeHtml(maskSecret(keyValue))}</span>`;
      preview.innerHTML = `<span>${maskedHtml}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", (e) => {
        copyText(text, e.currentTarget);
      });
    } else {
      preview.classList.add("hidden");
    }
  }
  function setupOAuth2Listeners() {
    document.getElementById("oauth-token-url")?.addEventListener("input", (e) => {
      state.authConfig.tokenUrl = e.target.value;
    });
    document.getElementById("oauth-client-id")?.addEventListener("input", (e) => {
      state.authConfig.clientId = e.target.value;
    });
    document.getElementById("oauth-client-secret")?.addEventListener("input", (e) => {
      state.authConfig.clientSecret = e.target.value;
    });
    document.getElementById("oauth-scope")?.addEventListener("input", (e) => {
      state.authConfig.scope = e.target.value;
    });
    setupPasswordToggle("oauth-client-secret", "toggle-oauth-secret");
    document.getElementById("fetch-oauth-btn")?.addEventListener("click", triggerFetchOAuthToken);
  }
  function triggerFetchOAuthToken() {
    const btn = document.getElementById("fetch-oauth-btn");
    const activeEnv = state.activeEnvironment || "none";
    const tokenUrl = document.getElementById("oauth-token-url")?.value?.trim();
    const clientId = document.getElementById("oauth-client-id")?.value?.trim();
    const clientSecret = document.getElementById("oauth-client-secret")?.value?.trim();
    const scope = document.getElementById("oauth-scope")?.value?.trim();
    if (!tokenUrl) {
      notify("error", "Token URL is required");
      return;
    }
    if (btn) {
      btn.textContent = "\u23F3 Fetching Token...";
      btn.classList.add("loading");
    }
    post({
      type: "fetchOAuthToken",
      tokenUrl,
      clientId,
      clientSecret,
      scope,
      environment: activeEnv,
      sslVerify: state.settings.sslVerify !== false
    });
  }
  function handleOAuthTokenResult(msg) {
    const btn = document.getElementById("fetch-oauth-btn");
    if (btn) {
      btn.textContent = "\u26A1 Fetch & Inject Token";
      btn.classList.remove("loading");
    }
    if (msg.success && msg.accessToken) {
      state.authConfig.accessToken = msg.accessToken;
      state.authConfig.tokenType = msg.tokenType || "Bearer";
      state.authConfig.expiresIn = msg.expiresIn || null;
      state.authConfig.tokenReceivedAt = Date.now();
      notify("info", "OAuth token fetched and injected successfully!");
      renderOAuthTokenCard();
      updateOAuthPreview();
    } else {
      notify("error", msg.error || "Failed to fetch OAuth token");
    }
  }
  function renderOAuthTokenCard() {
    const container = document.getElementById("oauth-token-display");
    if (!container) {
      return;
    }
    if (!state.authConfig.accessToken) {
      container.innerHTML = "";
      return;
    }
    const isExpired = state.authConfig.expiresIn && state.authConfig.tokenReceivedAt ? Date.now() - state.authConfig.tokenReceivedAt > state.authConfig.expiresIn * 1e3 : false;
    const expiryText = formatHumanExpiry(state.authConfig.expiresIn, state.authConfig.tokenReceivedAt);
    container.innerHTML = `
        <div class="oauth-token-card">
            <div class="oauth-token-header">
                <span style="font-weight:600;font-size:11px;">Active Access Token</span>
                <span class="token-status-badge ${isExpired ? "expired" : "valid"}">${isExpired ? "Expired" : "Valid"}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--fg-muted);">
                <span class="auth-mask">${escapeHtml(maskSecret(state.authConfig.accessToken))}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <span class="fg-muted" style="font-size:10px;">${escapeHtml(expiryText)}</span>
                <div style="display:flex;gap:6px;">
                    <button type="button" class="tool-btn" id="copy-oauth-token" style="padding:2px 8px;font-size:10px;">Copy Token</button>
                    <button type="button" class="tool-btn" id="clear-oauth-token" style="padding:2px 8px;font-size:10px;color:var(--error);">Clear</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById("copy-oauth-token")?.addEventListener("click", (e) => {
      copyText(state.authConfig.accessToken, e.currentTarget);
    });
    document.getElementById("clear-oauth-token")?.addEventListener("click", () => {
      state.authConfig.accessToken = "";
      state.authConfig.expiresIn = null;
      state.authConfig.tokenReceivedAt = null;
      renderOAuthTokenCard();
      updateOAuthPreview();
      notify("info", "OAuth token cleared");
    });
  }
  function updateOAuthPreview() {
    const preview = document.getElementById("auth-preview");
    if (!preview) {
      return;
    }
    const token = state.authConfig.accessToken;
    const type = state.authConfig.tokenType || "Bearer";
    if (token) {
      preview.innerHTML = `<span>Authorization: ${escapeHtml(type)} <span class="auth-mask">${escapeHtml(maskSecret(token))}</span></span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", (e) => {
        copyText(`Authorization: ${type} ${token}`, e.currentTarget);
      });
    } else {
      preview.classList.add("hidden");
    }
  }
  function isOAuthTokenExpired() {
    if (state.authConfig.type !== "oauth2") {
      return false;
    }
    if (!state.authConfig.accessToken) {
      return true;
    }
    if (!state.authConfig.expiresIn || !state.authConfig.tokenReceivedAt) {
      return false;
    }
    return Date.now() - state.authConfig.tokenReceivedAt > state.authConfig.expiresIn * 1e3;
  }
  function removeHeader(rawHeaders, headerName) {
    const target = headerName.toLowerCase();
    return (rawHeaders || "").split("\n").filter((line) => {
      const idx = line.indexOf(":");
      if (idx < 1) {
        return true;
      }
      return line.substring(0, idx).trim().toLowerCase() !== target;
    }).join("\n");
  }
  function buildAuthHeader() {
    const type = state.authConfig.type;
    if (type === "basic") {
      return null;
    } else if (type === "bearer") {
      const t = state.authConfig.token || "";
      if (t) {
        return `Authorization: Bearer ${t}`;
      }
    } else if (type === "apikey") {
      const n = state.authConfig.keyName || "";
      const v = state.authConfig.keyValue || "";
      const inHeader = (state.authConfig.keyIn || "header") === "header";
      if (n && v && inHeader) {
        return `${n}: ${v}`;
      }
    } else if (type === "oauth2") {
      if (isOAuthTokenExpired()) {
        return null;
      }
      const t = state.authConfig.accessToken || "";
      const prefix = state.authConfig.tokenType || "Bearer";
      if (t) {
        return `Authorization: ${prefix} ${t}`;
      }
    }
    return null;
  }
  function applyAuthHeaderToRawHeaders(rawHeaders) {
    const type = state.authConfig.type;
    let cleanHeaders = rawHeaders || "";
    if (type === "basic" || type === "bearer" || type === "oauth2") {
      cleanHeaders = removeHeader(cleanHeaders, "authorization");
    }
    if (type === "basic") {
      return cleanHeaders;
    }
    const authHeader = buildAuthHeader();
    if (!authHeader) {
      return cleanHeaders;
    }
    const authKey = authHeader.split(":")[0].trim().toLowerCase();
    cleanHeaders = removeHeader(cleanHeaders, authKey);
    return cleanHeaders.trim() ? `${authHeader}
${cleanHeaders.trim()}` : authHeader;
  }
  function restoreAuthUI(savedAuth) {
    state.authConfig = savedAuth ? { ...createDefaultAuthConfig(), ...savedAuth } : createDefaultAuthConfig();
    const authTypeSelect = document.getElementById("auth-type");
    if (authTypeSelect) {
      authTypeSelect.value = state.authConfig.type;
    }
    renderAuthFields(state.authConfig.type);
  }

  // src/webview/request.js
  function getRequestData({ forSend = false } = {}) {
    const activeEnv = state.activeEnvironment || "none";
    const rawHeaders = serializeHeaders();
    const headers = forSend ? applyAuthHeaderToRawHeaders(rawHeaders) : rawHeaders;
    const auth = forSend ? { ...state.authConfig } : createPersistableAuthConfig();
    return {
      id: state.currentRequest?.id,
      name: state.currentRequest?.name,
      method: document.getElementById("method")?.value || "GET",
      url: constructFullUrl(),
      headers,
      headerRows: state.headers.map((h) => ({ key: h.key || "", value: h.value || "", enabled: h.enabled !== false })),
      body: document.getElementById("body")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      queryParams: state.queryParams.map((p) => ({ key: p.key || "", value: p.value || "", enabled: p.enabled !== false })),
      auth,
      environment: activeEnv,
      retryCount: parseInt(document.getElementById("retry-count")?.value || "0", 10),
      timeout: parseInt(document.getElementById("timeout")?.value || "10000", 10),
      sslVerify: state.settings.sslVerify !== false
    };
  }
  function sendRequest() {
    const sendButton = document.getElementById("send");
    if (state.isRequestInProgress) {
      post({ type: "cancelRequest" });
      if (sendButton) {
        sendButton.textContent = "Send";
        sendButton.classList.remove("loading", "retry-mode");
      }
      state.isRequestInProgress = false;
      return;
    }
    const url = constructFullUrl();
    if (!url || url.trim() === "") {
      notify("error", "URL is required");
      return;
    }
    if (state.authConfig.type === "bearer" && !state.authConfig.token?.trim()) {
      notify("error", "Bearer token is required");
      return;
    }
    if (state.authConfig.type === "apikey" && (!state.authConfig.keyName?.trim() || !state.authConfig.keyValue?.trim())) {
      notify("error", "API Key Name and Value are required");
      return;
    }
    if (state.authConfig.type === "oauth2") {
      if (!state.authConfig.accessToken) {
        notify("error", "Please fetch an OAuth token before sending");
        return;
      }
      if (isOAuthTokenExpired()) {
        notify("error", "OAuth token expired \u2014 please fetch a new token");
        return;
      }
    }
    const requestData = getRequestData({ forSend: true });
    const historyData = getRequestData({ forSend: false });
    state.currentRequest = { ...requestData };
    state.isRequestInProgress = true;
    if (sendButton) {
      sendButton.innerHTML = '<span class="btn-spinner"></span> Cancel \u2715';
      sendButton.classList.add("loading");
      sendButton.classList.remove("retry-mode");
    }
    post({
      type: "sendRequest",
      ...requestData,
      historyData
    });
  }
  function clearRequestForm() {
    state.currentRequest = null;
    state.lastLoadedCollection = null;
    state.lastResponseRawData = null;
    state.lastResponseHeaders = {};
    const methodSelect = document.getElementById("method");
    const urlInput = document.getElementById("url");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("notes");
    if (methodSelect) {
      methodSelect.value = "GET";
    }
    if (urlInput) {
      urlInput.value = "";
    }
    if (bodyTextarea) {
      bodyTextarea.value = "";
    }
    if (notesTextarea) {
      notesTextarea.value = "";
    }
    state.queryParams = [];
    state.headers = [];
    renderQueryParams();
    renderHeaders();
    state.responseViewMode = "pretty";
    const prettyBtn = document.getElementById("res-view-pretty");
    const rawBtn = document.getElementById("res-view-raw");
    if (prettyBtn) {
      prettyBtn.classList.add("active");
    }
    if (rawBtn) {
      rawBtn.classList.remove("active");
    }
    renderResponseBody(null);
    renderResponseHeaders({});
    const statusBadge = document.getElementById("status-badge");
    if (statusBadge) {
      statusBadge.textContent = "---";
      statusBadge.className = "badge";
    }
    const timeBadge = document.getElementById("time-badge");
    if (timeBadge) {
      timeBadge.textContent = "-- ms";
    }
    const sizeBadge = document.getElementById("size-badge");
    if (sizeBadge) {
      sizeBadge.textContent = "-- KB";
    }
    state.authConfig = createDefaultAuthConfig();
    const authTypeSelect = document.getElementById("auth-type");
    if (authTypeSelect) {
      authTypeSelect.value = "none";
    }
    renderAuthFields("none");
    updateMethodColor("GET");
    updateTabDots();
  }
  function loadRequestIntoForm(item, collectionName) {
    if (!item) {
      return;
    }
    state.currentRequest = item;
    state.lastLoadedCollection = collectionName || null;
    const methodSelect = document.getElementById("method");
    const urlInput = document.getElementById("url");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("notes");
    const method = item.method || "GET";
    if (methodSelect) {
      methodSelect.value = method;
    }
    if (urlInput) {
      urlInput.value = (item.url || "").split("?")[0];
    }
    if (bodyTextarea) {
      bodyTextarea.value = item.body || "";
    }
    if (notesTextarea) {
      notesTextarea.value = item.notes || "";
    }
    updateMethodColor(method);
    if (Array.isArray(item.headerRows) && item.headerRows.length > 0) {
      state.headers = item.headerRows.map((h) => ({
        key: h.key || "",
        value: h.value || "",
        enabled: h.enabled !== false
      }));
    } else {
      parseHeadersIntoState(item.headers || "");
    }
    renderHeaders();
    if (Array.isArray(item.queryParams) && item.queryParams.length > 0) {
      state.queryParams = item.queryParams.map((p) => ({
        key: p.key || "",
        value: p.value || "",
        enabled: p.enabled !== false
      }));
    } else {
      try {
        const urlObj = new URL(item.url || "");
        state.queryParams = [];
        urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value, enabled: true }));
        if (urlInput) {
          urlInput.value = urlObj.origin + urlObj.pathname;
        }
      } catch {
        state.queryParams = [];
      }
    }
    renderQueryParams();
    if (item.retryCount !== void 0) {
      const rc = document.getElementById("retry-count");
      if (rc) {
        rc.value = item.retryCount;
      }
    }
    if (item.timeout !== void 0) {
      const to = document.getElementById("timeout");
      if (to) {
        to.value = item.timeout;
      }
    }
    const sslVerify = item.sslVerify !== false;
    state.settings.sslVerify = sslVerify;
    const sslCheckbox = document.getElementById("ssl-verify");
    if (sslCheckbox) {
      sslCheckbox.checked = sslVerify;
    }
    updateSslIndicator(sslVerify);
    restoreAuthUI(item.auth || createDefaultAuthConfig());
    updateTabDots();
    notify("info", `Loaded: ${item.name || "Request"}`);
  }
  function saveRequest() {
    const nameInput = document.getElementById("save-name");
    const collSelect = document.getElementById("save-collection");
    const name = nameInput?.value?.trim();
    const collectionId = collSelect?.value;
    const requestData = getRequestData({ forSend: false });
    if (!name) {
      notify("error", "Please enter a request name");
      return;
    }
    if (!collectionId) {
      notify("error", "Please select a collection");
      return;
    }
    if (!requestData.url || requestData.url.trim() === "") {
      notify("error", "Cannot save an empty request (URL is required)");
      return;
    }
    post({
      type: "saveRequest",
      request: requestData,
      name,
      collectionId
    });
    hideModals();
  }

  // src/webview/curl.js
  function exportToCurl() {
    let url = constructFullUrl();
    if (!url || url.trim() === "") {
      notify("error", "Please enter a URL first");
      return;
    }
    const methodSelect = document.getElementById("method");
    const bodyTextarea = document.getElementById("body");
    const method = methodSelect ? methodSelect.value : "GET";
    const body = bodyTextarea ? bodyTextarea.value : "";
    let cmdParts = ["curl"];
    if (state.settings && state.settings.sslVerify === false) {
      cmdParts.push("-k");
    }
    if (method && method !== "GET") {
      cmdParts.push(`-X ${method}`);
    }
    if (state.authConfig && state.authConfig.type === "basic") {
      const user = state.authConfig.username || "";
      const pass = state.authConfig.password || "";
      if (user || pass) {
        cmdParts.push(`-u "${user.replace(/"/g, '\\"')}:${pass.replace(/"/g, '\\"')}"`);
      }
    }
    if (state.authConfig && state.authConfig.type === "apikey" && state.authConfig.keyIn === "query") {
      const kName = state.authConfig.keyName || "";
      const kVal = state.authConfig.keyValue || "";
      if (kName && kVal) {
        const sep = url.includes("?") ? "&" : "?";
        url += `${sep}${encodeURIComponent(kName)}=${encodeURIComponent(kVal)}`;
      }
    }
    cmdParts.push(`"${url.replace(/"/g, '\\"')}"`);
    const rawHeaders = serializeHeaders();
    const headers = applyAuthHeaderToRawHeaders(rawHeaders);
    if (headers && headers.trim()) {
      headers.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && trimmed.includes(":") && !trimmed.startsWith("#")) {
          cmdParts.push(`-H "${trimmed.replace(/"/g, '\\"')}"`);
        }
      });
    }
    if (body && body.trim()) {
      try {
        const escaped = JSON.stringify(JSON.parse(body)).replace(/"/g, '\\"');
        cmdParts.push(`-d "${escaped}"`);
      } catch {
        const escaped = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        cmdParts.push(`-d "${escaped}"`);
      }
    }
    copyText(cmdParts.join(" \\\n  "), document.getElementById("export-curl"));
  }
  function showCurlImportModal() {
    const modal = document.getElementById("curl-import-modal");
    const input = document.getElementById("curl-import-input");
    if (modal) {
      modal.style.display = "block";
      modal.classList.add("modal-visible");
    }
    if (input) {
      input.value = "";
      input.focus();
    }
  }
  function executeCurlImport() {
    const input = document.getElementById("curl-import-input");
    const curlText = input ? input.value.trim() : "";
    if (!curlText) {
      notify("error", "Please paste a cURL command");
      return;
    }
    post({ type: "importCurl", curl: curlText });
    hideModals();
    if (input) {
      input.value = "";
    }
  }

  // src/webview/shortcuts.js
  function toggleShortcutsModal() {
    const modal = document.getElementById("shortcuts-modal");
    if (!modal) {
      return;
    }
    modal.style.display = modal.style.display === "flex" ? "none" : "flex";
  }
  function handleKeyboardShortcuts(e) {
    const isTyping = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT");
    if (!isTyping && e.key === "?") {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }
    if (e.key === "Escape") {
      hideModals();
    }
  }

  // src/webview/main.js
  window.addEventListener("load", () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
    renderHeaders();
    renderAuthFields("none");
    updateMethodColor("GET");
    updateTabDots();
    checkEnvVariableHint();
    post({ type: "webviewReady" });
  });
  function setupEventListeners() {
    document.getElementById("url")?.addEventListener("input", () => {
      checkEnvVariableHint();
    });
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll(".res-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchResponseTab(btn.dataset.resTab));
    });
    document.getElementById("res-view-pretty")?.addEventListener("click", () => switchResponseViewMode("pretty"));
    document.getElementById("res-view-raw")?.addEventListener("click", () => switchResponseViewMode("raw"));
    const methodSelect = document.getElementById("method");
    if (methodSelect) {
      methodSelect.addEventListener("change", (e) => updateMethodColor(e.target.value));
    }
    document.getElementById("body")?.addEventListener("input", updateTabDots);
    document.getElementById("notes")?.addEventListener("input", updateTabDots);
    document.getElementById("send")?.addEventListener("click", sendRequest);
    document.getElementById("add-param")?.addEventListener("click", () => {
      state.queryParams.push({ key: "", value: "", enabled: true });
      renderQueryParams();
    });
    document.getElementById("add-header")?.addEventListener("click", () => {
      state.headers.push({ key: "", value: "", enabled: true });
      renderHeaders();
    });
    document.getElementById("auth-type")?.addEventListener("change", (e) => {
      renderAuthFields(e.target.value);
    });
    document.getElementById("ssl-verify")?.addEventListener("change", (e) => {
      state.settings.sslVerify = e.target.checked;
      updateSslIndicator(e.target.checked);
      notify("info", e.target.checked ? "SSL Certificate verification enabled" : "\u26A0\uFE0F SSL Certificate verification disabled");
    });
    document.getElementById("export-curl")?.addEventListener("click", exportToCurl);
    document.getElementById("import-curl")?.addEventListener("click", showCurlImportModal);
    document.getElementById("confirm-curl-import")?.addEventListener("click", executeCurlImport);
    document.getElementById("cancel-curl-import")?.addEventListener("click", hideModals);
    document.getElementById("favorite-btn")?.addEventListener("click", () => {
      const url = document.getElementById("url")?.value?.trim();
      if (!url) {
        notify("error", "Add a URL before saving to favorites");
        return;
      }
      post({ type: "toggleFavorite", request: getRequestData({ forSend: false }) });
      const btn = document.getElementById("favorite-btn");
      const isFav = btn.textContent === "\u{1F31F}";
      btn.textContent = isFav ? "\u2B50" : "\u{1F31F}";
      notify("info", isFav ? "Removed from favorites" : "Added to favorites");
    });
    document.getElementById("save-btn")?.addEventListener("click", () => {
      const modal = document.getElementById("save-modal");
      if (modal) {
        modal.style.display = "flex";
        const nameInput = document.getElementById("save-name");
        if (nameInput) {
          nameInput.value = state.currentRequest?.name || "";
          nameInput.focus();
        }
      }
      post({ type: "getCollections" });
    });
    document.getElementById("confirm-save")?.addEventListener("click", saveRequest);
    document.getElementById("cancel-save")?.addEventListener("click", hideModals);
    document.getElementById("close-shortcuts-modal")?.addEventListener("click", hideModals);
    document.getElementById("copy-response")?.addEventListener("click", (e) => {
      const activeResTab = document.querySelector(".res-tab-btn.active")?.dataset.resTab;
      const textToCopy = activeResTab === "headers" ? Object.entries(state.lastResponseHeaders || {}).map(([k, v]) => `${k}: ${v}`).join("\n") : state.lastResponseRawData !== null && state.lastResponseRawData !== void 0 ? typeof state.lastResponseRawData === "object" ? state.responseViewMode === "pretty" ? JSON.stringify(state.lastResponseRawData, null, 2) : JSON.stringify(state.lastResponseRawData) : String(state.lastResponseRawData) : document.getElementById("response-body")?.textContent || "";
      copyText(textToCopy, e.currentTarget);
    });
    document.addEventListener("keydown", handleKeyboardShortcuts);
    window.addEventListener("message", handleMessage);
  }
  function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
      case "environments": {
        state.environments = msg.environments || [];
        state.activeEnvironment = msg.activeEnvironment || "none";
        const activeEnvObj = state.environments.find((e) => e.name === state.activeEnvironment);
        const varCount = activeEnvObj?.variables ? Object.keys(activeEnvObj.variables).length : 0;
        updateEnvironmentIndicator(state.activeEnvironment, varCount);
        break;
      }
      case "focusUrl": {
        const urlInput = document.getElementById("url");
        if (urlInput) {
          urlInput.focus();
          urlInput.select();
        }
        break;
      }
      case "triggerSend":
        sendRequest();
        break;
      case "triggerClear":
        clearRequestForm();
        break;
      case "triggerSave": {
        const saveBtn = document.getElementById("save-btn");
        if (saveBtn) {
          saveBtn.click();
        }
        break;
      }
      case "loadRequest":
        loadRequestIntoForm(msg.data || msg.request, msg.collectionName);
        break;
      case "response":
        handleResponse(msg);
        break;
      case "error":
        handleError(msg);
        break;
      case "retryAttempt": {
        const sendBtn = document.getElementById("send");
        if (sendBtn) {
          const total = msg.total || msg.maxRetries || "?";
          sendBtn.innerHTML = `<span class="btn-spinner"></span> Retrying (${msg.attempt}/${total})...`;
          sendBtn.classList.add("loading", "retry-mode");
        }
        break;
      }
      case "collections":
        populateCollectionsDropdown(msg.collections);
        break;
      case "oauthTokenResult":
        handleOAuthTokenResult(msg);
        break;
    }
  }
  function handleResponse(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById("send");
    if (btn) {
      btn.textContent = "Send";
      btn.classList.remove("loading", "retry-mode");
    }
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const sizeBadge = document.getElementById("size-badge");
    if (statusBadge) {
      statusBadge.textContent = `${res.status} ${res.statusText}`;
      let statusClass = "badge-2xx";
      if (res.status >= 300 && res.status < 400) {
        statusClass = "badge-3xx";
      } else if (res.status >= 400 && res.status < 500) {
        statusClass = "badge-4xx";
      } else if (res.status >= 500) {
        statusClass = "badge-5xx";
      }
      statusBadge.className = `badge ${statusClass}`;
    }
    if (timeBadge) {
      timeBadge.textContent = `${res.duration} ms`;
    }
    if (sizeBadge) {
      sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : "-- KB";
    }
    state.lastResponseRawData = res.data;
    state.lastResponseHeaders = res.headers || {};
    renderResponseBody(res.data);
    renderResponseHeaders(res.headers);
  }
  function handleError(res) {
    state.isRequestInProgress = false;
    state.lastResponseRawData = null;
    state.lastResponseHeaders = {};
    const btn = document.getElementById("send");
    if (btn) {
      btn.textContent = "Send";
      btn.classList.remove("loading", "retry-mode");
    }
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const sizeBadge = document.getElementById("size-badge");
    const responseBody = document.getElementById("response-body");
    if (statusBadge) {
      statusBadge.textContent = res.cancelled ? "Cancelled" : "Error";
      statusBadge.className = "badge badge-5xx";
    }
    if (timeBadge) {
      timeBadge.textContent = res.duration ? `${res.duration} ms` : "--";
    }
    if (sizeBadge) {
      sizeBadge.textContent = "-- KB";
    }
    if (responseBody) {
      const errorMessage = res.error || res.message || "Network request failed";
      responseBody.replaceChildren();
      const errorDiv = document.createElement("div");
      errorDiv.style.color = "#f85149";
      errorDiv.style.padding = "8px";
      errorDiv.textContent = `\u26A0\uFE0F ${errorMessage}`;
      responseBody.appendChild(errorDiv);
    }
    state.lastResponseHeaders = {};
    renderResponseHeaders({});
  }
  function populateCollectionsDropdown(collections) {
    const select = document.getElementById("save-collection");
    if (!select || !Array.isArray(collections)) {
      return;
    }
    select.innerHTML = collections.length ? collections.map((c) => `<option value="${c.id}">${c.name}</option>`).join("") : '<option value="">No collections yet \u2014 create one first</option>';
    if (state.lastLoadedCollection) {
      select.value = state.lastLoadedCollection;
    }
  }
})();
//# sourceMappingURL=script.js.map
