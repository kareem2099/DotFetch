"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };

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
  var state;
  var init_state = __esm({
    "src/webview/state.js"() {
      "use strict";
      state = {
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
        lastLoadedCollection: null
      };
    }
  });

  // src/webview/api.js
  function initApi(vscode) {
    _vscode = vscode;
  }
  function post(message) {
    _vscode.postMessage(message);
  }
  function notify(level, text) {
    _vscode.postMessage({ type: "notify", level, text });
  }
  var _vscode;
  var init_api = __esm({
    "src/webview/api.js"() {
      "use strict";
      _vscode = null;
    }
  });

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
    row.className = "kv-row";
    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.className = "url-input kv-key";
    keyInput.placeholder = "Key";
    keyInput.value = escapeHtml(item.key);
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
    valInput.value = escapeHtml(item.value);
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
    const n = state.queryParams.filter((p) => p.key).length;
    el.textContent = n > 0 ? String(n) : "";
  }
  function updateHeadersCount() {
    const el = document.getElementById("headers-count");
    if (!el) {
      return;
    }
    const n = state.headers.filter((h) => h.key).length;
    el.textContent = n > 0 ? String(n) : "";
  }
  function serializeHeaders() {
    return state.headers.filter((h) => h.key && h.key.trim()).map((h) => `${h.key.trim()}: ${h.value.trim()}`).join("\n");
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
      return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
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
    const validParams = state.queryParams.filter((p) => p.key && p.value);
    if (validParams.length > 0) {
      const separator = baseUrl.includes("?") ? "&" : "?";
      const qs = validParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
      return `${baseUrl}${separator}${qs}`;
    }
    return baseUrl;
  }
  function updateEnvironmentIndicator(envName) {
    const badge = document.getElementById("env-badge");
    if (!badge) {
      return;
    }
    badge.textContent = envName === "none" ? "No Environment" : envName;
    const isProd = envName.toLowerCase().includes("prod");
    badge.style.color = isProd ? "#f85149" : "#58a6ff";
    badge.style.background = isProd ? "rgba(248,81,73,0.15)" : "rgba(56,139,253,0.15)";
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
  function renderResponseHeaders(headers) {
    const container = document.getElementById("response-headers-list");
    const badge = document.getElementById("res-headers-count");
    if (!container) {
      return;
    }
    if (!headers || typeof headers !== "object" || Object.keys(headers).length === 0) {
      container.innerHTML = `<div class="fg-muted" style="text-align:center;margin-top:20px;">No response headers received</div>`;
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
  var init_ui = __esm({
    "src/webview/ui.js"() {
      "use strict";
      init_state();
    }
  });

  // src/webview/auth.js
  function renderAuthFields(type) {
    const container = document.getElementById("auth-fields");
    if (!container) {
      return;
    }
    state.authConfig.type = type || "none";
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
      document.getElementById("copy-auth-preview")?.addEventListener("click", () => {
        navigator.clipboard.writeText(`Authorization: Basic ${encoded}`);
        notify("info", "Auth header copied to clipboard");
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
      preview.innerHTML = `<span>Authorization: Bearer ${token}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", () => {
        navigator.clipboard.writeText(`Authorization: Bearer ${token}`);
        notify("info", "Auth header copied to clipboard");
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
    if (keyName && keyValue) {
      const text = keyIn === "header" ? `${keyName}: ${keyValue}` : `?${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
      preview.innerHTML = `<span>${keyIn === "header" ? "Header" : "Query Param"}: ${text}</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", () => {
        navigator.clipboard.writeText(text);
        notify("info", "Copied to clipboard");
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
    const envBadge = document.getElementById("env-badge");
    const activeEnv = envBadge?.textContent === "No Environment" ? "none" : envBadge?.textContent || "none";
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
    const expiryText = state.authConfig.expiresIn ? `Expires: ${state.authConfig.expiresIn}s` : "No expiration specified";
    container.innerHTML = `
        <div class="oauth-token-card">
            <div class="oauth-token-header">
                <span style="font-weight:600;font-size:11px;">Active Access Token</span>
                <span class="token-status-badge ${isExpired ? "expired" : "valid"}">${isExpired ? "Expired" : "Valid"}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:11px;word-break:break-all;color:var(--fg-muted);">
                ${state.authConfig.accessToken.substring(0, 32)}...
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                <span class="fg-muted" style="font-size:10px;">${expiryText}</span>
                <div style="display:flex;gap:6px;">
                    <button type="button" class="tool-btn" id="copy-oauth-token" style="padding:2px 8px;font-size:10px;">Copy Token</button>
                    <button type="button" class="tool-btn" id="clear-oauth-token" style="padding:2px 8px;font-size:10px;color:var(--error);">Clear</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById("copy-oauth-token")?.addEventListener("click", () => {
      navigator.clipboard.writeText(state.authConfig.accessToken);
      notify("info", "Access token copied to clipboard");
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
      preview.innerHTML = `<span>Authorization: ${type} ${token.substring(0, 24)}...</span><button type="button" class="tool-btn" id="copy-auth-preview" style="padding:2px 6px;font-size:10px;">Copy</button>`;
      preview.classList.remove("hidden");
      document.getElementById("copy-auth-preview")?.addEventListener("click", () => {
        navigator.clipboard.writeText(`Authorization: ${type} ${token}`);
        notify("info", "Auth header copied to clipboard");
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
  var init_auth = __esm({
    "src/webview/auth.js"() {
      "use strict";
      init_state();
      init_api();
    }
  });

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
      body: document.getElementById("body")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      queryParams: [...state.queryParams],
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
        sendButton.classList.remove("loading");
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
      sendButton.textContent = "Cancel \u2715";
      sendButton.classList.add("loading");
    }
    post({
      type: "sendRequest",
      ...requestData,
      historyData
    });
  }
  function clearRequestForm() {
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
    state.authConfig = createDefaultAuthConfig();
    const authTypeSelect = document.getElementById("auth-type");
    if (authTypeSelect) {
      authTypeSelect.value = "none";
    }
    renderAuthFields("none");
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
    if (methodSelect) {
      methodSelect.value = item.method || "GET";
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
    parseHeadersIntoState(item.headers || "");
    renderHeaders();
    if (item.queryParams && item.queryParams.length > 0) {
      state.queryParams = item.queryParams.map((p) => ({ ...p }));
    } else {
      try {
        const urlObj = new URL(item.url || "");
        state.queryParams = [];
        urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
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
  var init_request = __esm({
    "src/webview/request.js"() {
      "use strict";
      init_state();
      init_api();
      init_ui();
      init_auth();
    }
  });

  // src/webview/main.js
  init_state();
  init_api();
  init_ui();
  init_auth();
  init_request();

  // src/webview/curl.js
  init_state();
  init_api();
  init_ui();
  function exportToCurl() {
    const url = constructFullUrl();
    if (!url || url.trim() === "") {
      notify("error", "Please enter a URL first");
      return;
    }
    const methodSelect = document.getElementById("method");
    const bodyTextarea = document.getElementById("body");
    const method = methodSelect ? methodSelect.value : "GET";
    const headers = state.headers.filter((h) => h.key.trim()).map((h) => `${h.key.trim()}: ${h.value.trim()}`).join("\n");
    const body = bodyTextarea ? bodyTextarea.value : "";
    let cmdParts = ["curl"];
    if (method !== "GET") {
      cmdParts.push("-X", method);
    }
    cmdParts.push(`"${url.replace(/"/g, '\\"')}"`);
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
      } catch (e) {
        const escaped = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        cmdParts.push(`-d "${escaped}"`);
      }
    }
    copyToClipboard(cmdParts.join(" \\\n  "), "cURL command copied to clipboard");
  }
  function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        notify("info", successMessage);
      }).catch(() => notify("error", "\u274C Failed to copy to clipboard"));
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        notify("info", successMessage);
      } catch {
        notify("error", "\u274C Failed to copy to clipboard");
      } finally {
        document.body.removeChild(textarea);
      }
    }
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
  init_state();

  // src/webview/collections.js
  init_state();
  init_api();
  init_ui();

  // src/webview/shortcuts.js
  init_api();
  init_request();
  init_ui();
  function matchesShortcut(e, shortcutStr) {
    if (!shortcutStr) {
      return false;
    }
    const parts = shortcutStr.toLowerCase().split("+");
    const requiresCtrl = parts.includes("ctrl") || parts.includes("cmd");
    const requiresShift = parts.includes("shift");
    const requiresAlt = parts.includes("alt");
    const key = parts[parts.length - 1];
    const hasCtrl = e.ctrlKey || e.metaKey;
    if (requiresCtrl !== hasCtrl) {
      return false;
    }
    if (requiresShift !== e.shiftKey) {
      return false;
    }
    if (requiresAlt !== e.altKey) {
      return false;
    }
    let eKey = e.key.toLowerCase();
    if (eKey === " ") {
      eKey = "space";
    }
    return eKey === key;
  }
  function handleKeyboardShortcuts(e) {
    if (e.target && e.target.classList && e.target.classList.contains("shortcut-input")) {
      return;
    }
    const shortcuts = state.settings.shortcuts || {
      sendRequest: "ctrl+enter",
      saveRequest: "ctrl+s",
      clearForm: "ctrl+k",
      closeModal: "escape"
    };
    if (matchesShortcut(e, shortcuts.sendRequest)) {
      e.preventDefault();
      sendRequest();
    } else if (matchesShortcut(e, shortcuts.closeModal)) {
      hideModals();
    } else if (matchesShortcut(e, shortcuts.saveRequest)) {
      e.preventDefault();
      const saveBtn = document.getElementById("save-btn");
      if (saveBtn) {
        saveBtn.click();
      }
    } else if (matchesShortcut(e, shortcuts.clearForm)) {
      e.preventDefault();
      clearRequestForm();
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
    post({ type: "webviewReady" });
  });
  function setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll(".res-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchResponseTab(btn.dataset.resTab));
    });
    document.getElementById("send")?.addEventListener("click", sendRequest);
    document.getElementById("add-param")?.addEventListener("click", () => {
      state.queryParams.push({ key: "", value: "" });
      renderQueryParams();
    });
    document.getElementById("add-header")?.addEventListener("click", () => {
      state.headers.push({ key: "", value: "" });
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
    document.getElementById("copy-response")?.addEventListener("click", () => {
      const activeResTab = document.querySelector(".res-tab-btn.active")?.dataset.resTab;
      if (activeResTab === "headers") {
        const headers = state.lastResponseHeaders || {};
        const text = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n");
        navigator.clipboard.writeText(text);
        notify("info", "Response headers copied to clipboard");
      } else {
        const body = document.getElementById("response-body")?.textContent || "";
        navigator.clipboard.writeText(body);
        notify("info", "Response copied to clipboard");
      }
    });
    document.addEventListener("keydown", handleKeyboardShortcuts);
    window.addEventListener("message", handleMessage);
  }
  function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
      case "environments":
        state.environments = msg.environments || [];
        state.activeEnvironment = msg.activeEnvironment || "none";
        updateEnvironmentIndicator(state.activeEnvironment);
        break;
      case "loadRequest":
        loadRequestIntoForm(msg.data || msg.request, msg.collectionName);
        break;
      case "response":
        handleResponse(msg);
        break;
      case "error":
        handleError(msg);
        break;
      case "retryAttempt":
        document.getElementById("send").textContent = `Retrying (${msg.attempt}/${msg.total})...`;
        break;
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
      btn.classList.remove("loading");
    }
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const sizeBadge = document.getElementById("size-badge");
    const responseBody = document.getElementById("response-body");
    if (statusBadge) {
      statusBadge.textContent = `${res.status} ${res.statusText}`;
      statusBadge.className = `badge ${res.status < 300 ? "badge-2xx" : res.status < 500 ? "badge-4xx" : "badge-5xx"}`;
    }
    if (timeBadge) {
      timeBadge.textContent = `${res.duration} ms`;
    }
    if (sizeBadge) {
      sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : "-- KB";
    }
    state.lastResponseHeaders = res.headers || {};
    renderResponseHeaders(res.headers);
    if (responseBody) {
      try {
        if (typeof res.data === "object" && res.data !== null) {
          responseBody.innerHTML = `<pre style="margin:0">${syntaxHighlightJson(JSON.stringify(res.data, null, 2))}</pre>`;
        } else {
          responseBody.textContent = String(res.data);
        }
      } catch {
        responseBody.textContent = String(res.data);
      }
    }
  }
  function handleError(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById("send");
    if (btn) {
      btn.textContent = "Send";
      btn.classList.remove("loading");
    }
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const responseBody = document.getElementById("response-body");
    if (statusBadge) {
      statusBadge.textContent = res.cancelled ? "Cancelled" : "Error";
      statusBadge.className = "badge badge-5xx";
    }
    if (timeBadge) {
      timeBadge.textContent = res.duration ? `${res.duration} ms` : "--";
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
