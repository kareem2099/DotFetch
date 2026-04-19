"use strict";
(() => {
  // src/webview/state.js
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
      shortcuts: {
        sendRequest: "ctrl+enter",
        saveRequest: "ctrl+s",
        clearForm: "ctrl+k",
        closeModal: "escape"
      }
    },
    environments: [],
    isRequestInProgress: false,
    authConfig: { type: "none", username: "", password: "", token: "", keyName: "", keyValue: "", keyIn: "header" },
    lastLoadedCollection: null
  };

  // src/webview/api.js
  var _vscode = null;
  function initApi(vscode) {
    _vscode = vscode;
  }
  function post(message) {
    _vscode.postMessage(message);
  }
  function notify(level, text) {
    _vscode.postMessage({ type: "notify", level, text });
  }

  // src/webview/ui.js
  function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    const tabContent = document.getElementById(tabName + "-tab");
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabContent) tabContent.classList.add("active");
    if (tabButton) tabButton.classList.add("active");
  }
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function renderQueryParams() {
    const container = document.getElementById("params-list");
    if (!container) return;
    container.innerHTML = "";
    state.queryParams.forEach((param, index) => {
      container.appendChild(_makeKVRow(param, index, "queryParams", updateParamsCount));
    });
    updateParamsCount();
  }
  function renderHeaders() {
    const container = document.getElementById("headers-list");
    if (!container) return;
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
      if (onUpdate) onUpdate();
    });
    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.className = "url-input kv-value";
    valInput.placeholder = "Value";
    valInput.value = escapeHtml(item.value);
    valInput.addEventListener("input", (e) => {
      state[stateKey][index].value = e.target.value;
      if (onUpdate) onUpdate();
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
    if (!el) return;
    const n = state.queryParams.filter((p) => p.key).length;
    el.textContent = n > 0 ? String(n) : "";
  }
  function updateHeadersCount() {
    const el = document.getElementById("headers-count");
    if (!el) return;
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
      if (idx < 1) return null;
      return { key: line.substring(0, idx).trim(), value: line.substring(idx + 1).trim() };
    }).filter(Boolean);
  }
  function constructFullUrl() {
    const urlInput = document.getElementById("url");
    if (!urlInput) return "";
    let baseUrl = urlInput.value.trim();
    if (!baseUrl) return "";
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
    if (!badge) return;
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
  function syntaxHighlightJson(json) {
    if (typeof json !== "string") json = JSON.stringify(json, null, 2);
    json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/.test(match)) cls = /:$/.test(match) ? "json-key" : "json-string";
        else if (/true|false/.test(match)) cls = "json-boolean";
        else if (/null/.test(match)) cls = "json-null";
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }

  // src/webview/curl.js
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
    if (input) input.value = "";
  }

  // src/webview/main.js
  window.addEventListener("load", () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
    renderHeaders();
    post({ type: "webviewReady" });
  });
  function setupEventListeners() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
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
      state.authConfig.type = e.target.value;
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
      post({ type: "toggleFavorite", request: getRequestData() });
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
    document.getElementById("confirm-save")?.addEventListener("click", () => {
      const name = document.getElementById("save-name")?.value?.trim();
      const collectionId = document.getElementById("save-collection")?.value;
      const requestData = getRequestData();
      if (!name) return notify("error", "Please enter a name");
      if (!collectionId) return notify("error", "Please select a collection");
      if (!requestData.url || requestData.url.trim() === "") {
        return notify("error", "Cannot save an empty request (URL is required)");
      }
      post({ type: "saveRequest", request: requestData, name, collectionId });
      hideModals();
    });
    document.getElementById("cancel-save")?.addEventListener("click", hideModals);
    document.getElementById("copy-response")?.addEventListener("click", () => {
      const body = document.getElementById("response-body")?.textContent || "";
      navigator.clipboard.writeText(body);
      notify("info", "Response copied to clipboard");
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendRequest();
    });
    window.addEventListener("message", handleMessage);
  }
  function renderAuthFields(type) {
    const container = document.getElementById("auth-fields");
    if (!container) return;
    switch (type) {
      case "basic":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username" autocomplete="off">
                    <input type="password" id="auth-password" class="url-input" placeholder="Password" autocomplete="off">
                </div>`;
        document.getElementById("auth-username").addEventListener("input", (e) => state.authConfig.username = e.target.value);
        document.getElementById("auth-password").addEventListener("input", (e) => state.authConfig.password = e.target.value);
        break;
      case "bearer":
        container.innerHTML = `<input type="text" id="auth-token" class="url-input" placeholder="Bearer token" autocomplete="off">`;
        document.getElementById("auth-token").addEventListener("input", (e) => state.authConfig.token = e.target.value);
        break;
      case "apikey":
        container.innerHTML = `
                <div class="auth-fields-inner">
                    <input type="text" id="auth-key-name" class="url-input" placeholder="Key name (e.g. X-API-Key)" autocomplete="off">
                    <input type="text" id="auth-key-value" class="url-input" placeholder="Value" autocomplete="off">
                    <select id="auth-key-in" class="method-select" style="width:140px;">
                        <option value="header">Add to Header</option>
                        <option value="query">Add to Query</option>
                    </select>
                </div>`;
        document.getElementById("auth-key-name").addEventListener("input", (e) => state.authConfig.keyName = e.target.value);
        document.getElementById("auth-key-value").addEventListener("input", (e) => state.authConfig.keyValue = e.target.value);
        document.getElementById("auth-key-in").addEventListener("change", (e) => state.authConfig.keyIn = e.target.value);
        break;
      default:
        container.innerHTML = "";
    }
  }
  function sendRequest() {
    const btn = document.getElementById("send");
    if (state.isRequestInProgress) {
      post({ type: "cancelRequest" });
      btn.textContent = "Send";
      btn.classList.remove("loading");
      state.isRequestInProgress = false;
      return;
    }
    state.isRequestInProgress = true;
    btn.textContent = "Cancel \u2715";
    btn.classList.add("loading");
    post({ type: "sendRequest", ...getRequestData() });
  }
  function getRequestData() {
    const envBadge = document.getElementById("env-badge");
    const activeEnv = envBadge?.textContent === "No Environment" ? "none" : envBadge?.textContent || "none";
    let headers = serializeHeaders();
    const authType = state.authConfig.type;
    if (authType === "bearer") {
      const token = document.getElementById("auth-token")?.value || "";
      if (token) headers = `Authorization: Bearer ${token}
` + headers;
    } else if (authType === "basic") {
      const user = document.getElementById("auth-username")?.value || "";
      const pass = document.getElementById("auth-password")?.value || "";
      if (user || pass) headers = `Authorization: Basic ${btoa(`${user}:${pass}`)}
` + headers;
    } else if (authType === "apikey") {
      const keyName = document.getElementById("auth-key-name")?.value || "";
      const keyValue = document.getElementById("auth-key-value")?.value || "";
      const keyIn = document.getElementById("auth-key-in")?.value || "header";
      if (keyName && keyValue && keyIn === "header") headers = `${keyName}: ${keyValue}
` + headers;
    }
    return {
      id: state.currentRequest?.id,
      name: state.currentRequest?.name,
      method: document.getElementById("method")?.value || "GET",
      url: constructFullUrl(),
      headers,
      body: document.getElementById("body")?.value || "",
      notes: document.getElementById("notes")?.value || "",
      queryParams: state.queryParams,
      auth: state.authConfig,
      environment: activeEnv,
      retryCount: parseInt(document.getElementById("retry-count")?.value || "0", 10),
      timeout: parseInt(document.getElementById("timeout")?.value || "10000", 10)
    };
  }
  function handleMessage(event) {
    const msg = event.data;
    switch (msg.type) {
      case "environments":
        state.environments = msg.environments || [];
        updateEnvironmentIndicator(msg.activeEnvironment || "none");
        break;
      case "loadRequest":
        loadRequestIntoUI(msg.data || msg.request, msg.collectionName);
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
    }
  }
  function loadRequestIntoUI(req, collectionName) {
    if (!req) return;
    state.currentRequest = req;
    state.lastLoadedCollection = collectionName || null;
    const method = document.getElementById("method");
    const url = document.getElementById("url");
    const body = document.getElementById("body");
    const notes = document.getElementById("notes");
    if (method) method.value = req.method || "GET";
    if (url) url.value = (req.url || "").split("?")[0];
    if (body) body.value = req.body || "";
    if (notes) notes.value = req.notes || "";
    parseHeadersIntoState(req.headers || "");
    renderHeaders();
    if (req.queryParams?.length) {
      state.queryParams = req.queryParams.map((p) => ({ ...p }));
    } else {
      try {
        const urlObj = new URL(req.url || "");
        state.queryParams = [];
        urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
        if (url) url.value = urlObj.origin + urlObj.pathname;
      } catch {
        state.queryParams = [];
      }
    }
    renderQueryParams();
    if (req.retryCount !== void 0) {
      const rc = document.getElementById("retry-count");
      if (rc) rc.value = req.retryCount;
    }
    if (req.timeout !== void 0) {
      const to = document.getElementById("timeout");
      if (to) to.value = req.timeout;
    }
    if (req.auth) {
      state.authConfig = { ...req.auth };
      const authTypeSelect = document.getElementById("auth-type");
      if (authTypeSelect) authTypeSelect.value = state.authConfig.type;
      renderAuthFields(state.authConfig.type);
      if (state.authConfig.type === "basic") {
        const u = document.getElementById("auth-username");
        const p = document.getElementById("auth-password");
        if (u) u.value = state.authConfig.username || "";
        if (p) p.value = state.authConfig.password || "";
      } else if (state.authConfig.type === "bearer") {
        const t = document.getElementById("auth-token");
        if (t) t.value = state.authConfig.token || "";
      } else if (state.authConfig.type === "apikey") {
        const n = document.getElementById("auth-key-name");
        const v = document.getElementById("auth-key-value");
        const i = document.getElementById("auth-key-in");
        if (n) n.value = state.authConfig.keyName || "";
        if (v) v.value = state.authConfig.keyValue || "";
        if (i) i.value = state.authConfig.keyIn || "header";
      }
    }
    notify("info", `Loaded: ${req.name || "Request"}`);
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
    if (timeBadge) timeBadge.textContent = `${res.duration} ms`;
    if (sizeBadge) sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : "-- KB";
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
    if (timeBadge) timeBadge.textContent = res.duration ? `${res.duration} ms` : "--";
    if (responseBody) responseBody.innerHTML = `<div style="color:#f85149;padding:8px;">\u26A0\uFE0F ${res.error || "Unknown error"}</div>`;
  }
  function populateCollectionsDropdown(collections) {
    const select = document.getElementById("save-collection");
    if (!select || !Array.isArray(collections)) return;
    select.innerHTML = collections.length ? collections.map((c) => `<option value="${c.id}">${c.name}</option>`).join("") : '<option value="">No collections yet \u2014 create one first</option>';
    if (state.lastLoadedCollection) {
      select.value = state.lastLoadedCollection;
    }
  }
})();
//# sourceMappingURL=script.js.map
