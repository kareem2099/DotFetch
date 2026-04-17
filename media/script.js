"use strict";
(() => {
  // src/webview/state.js
  var state = {
    queryParams: [],
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
    isUpdatingPreview: false,
    previewTimeout: null,
    authConfig: { type: "none", username: "", password: "", token: "" }
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
      const row = document.createElement("div");
      row.className = "query-param-row";
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.marginBottom = "8px";
      row.innerHTML = `
            <input type="text" class="url-input param-key" placeholder="Key" value="${escapeHtml(param.key)}">
            <input type="text" class="url-input param-value" placeholder="Value" value="${escapeHtml(param.value)}">
            <button class="tool-btn remove-param" title="Remove">\u274C</button>
        `;
      row.querySelector(".param-key").addEventListener("input", (e) => {
        state.queryParams[index].key = e.target.value;
      });
      row.querySelector(".param-value").addEventListener("input", (e) => {
        state.queryParams[index].value = e.target.value;
      });
      row.querySelector(".remove-param").addEventListener("click", () => {
        state.queryParams.splice(index, 1);
        renderQueryParams();
      });
      container.appendChild(row);
    });
  }
  function updateEnvironmentIndicator(envName) {
    const badge = document.getElementById("env-badge");
    if (badge) {
      badge.textContent = envName === "none" ? "No Environment" : envName;
      if (envName.toLowerCase().includes("prod")) {
        badge.style.color = "#f85149";
        badge.style.background = "rgba(248, 81, 73, 0.15)";
      } else {
        badge.style.color = "#58a6ff";
        badge.style.background = "rgba(56, 139, 253, 0.15)";
      }
    }
  }
  function hideModals() {
    const modal = document.getElementById("save-modal");
    if (modal) modal.style.display = "none";
  }
  function syntaxHighlightJson(json) {
    if (typeof json !== "string") {
      json = JSON.stringify(json, null, 2);
    }
    json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function(match) {
      var cls = "json-number";
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "json-key";
        } else {
          cls = "json-string";
        }
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return '<span class="' + cls + '">' + match + "</span>";
    });
  }

  // src/webview/main.js
  window.addEventListener("load", () => {
    const vscode = acquireVsCodeApi();
    initApi(vscode);
    setupEventListeners();
    renderQueryParams();
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
    document.getElementById("auth-type")?.addEventListener("change", (e) => {
      const authFields = document.getElementById("auth-fields");
      const type = e.target.value;
      if (type === "basic") {
        authFields.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="auth-username" class="url-input" placeholder="Username">
                    <input type="password" id="auth-password" class="url-input" placeholder="Password">
                </div>`;
      } else if (type === "bearer") {
        authFields.innerHTML = `<input type="text" id="auth-token" class="url-input" placeholder="Bearer Token">`;
      } else {
        authFields.innerHTML = "";
      }
      state.authConfig.type = type;
    });
    document.getElementById("export-curl")?.addEventListener("click", () => {
      const data = getRequestData();
      let curl = `curl -X ${data.method} '${data.url}'`;
      if (data.headers) {
        data.headers.split("\n").filter((l) => l.includes(":")).forEach((h) => {
          curl += ` \\
  -H '${h.trim()}'`;
        });
      }
      if (data.body && ["POST", "PUT", "PATCH"].includes(data.method)) {
        curl += ` \\
  -d '${data.body.replace(/'/g, "\\'")}'`;
      }
      navigator.clipboard.writeText(curl);
      notify("info", "cURL copied to clipboard!");
    });
    document.getElementById("favorite-btn")?.addEventListener("click", () => {
      post({ type: "toggleFavorite", request: getRequestData() });
      const btn = document.getElementById("favorite-btn");
      const isFav = btn.textContent === "\u{1F31F}";
      btn.textContent = isFav ? "\u2B50" : "\u{1F31F}";
      notify("info", isFav ? "Removed from favorites" : "Added to favorites");
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        sendRequest();
      }
    });
    document.getElementById("save-btn")?.addEventListener("click", () => {
      const modal = document.getElementById("save-modal");
      if (modal) {
        modal.style.display = "flex";
        document.getElementById("save-name").focus();
        post({ type: "getCollections" });
      }
    });
    document.getElementById("confirm-save")?.addEventListener("click", () => {
      const name = document.getElementById("save-name").value;
      const collectionId = document.getElementById("save-collection").value;
      if (!name) return notify("error", "Please enter a name");
      post({
        type: "saveRequest",
        request: getRequestData(),
        name,
        collectionId
      });
      hideModals();
    });
    document.getElementById("cancel-save")?.addEventListener("click", hideModals);
    document.getElementById("copy-response")?.addEventListener("click", () => {
      const body = document.getElementById("response-body").textContent;
      navigator.clipboard.writeText(body);
      notify("info", "Response copied to clipboard");
    });
    window.addEventListener("message", handleMessage);
  }
  function handleMessage(event) {
    const message = event.data;
    switch (message.type) {
      case "environments":
        state.environments = message.environments || [];
        updateEnvironmentIndicator(message.activeEnvironment || "none");
        break;
      case "loadRequest":
        loadRequestIntoUI(message.data || message.request);
        break;
      case "response":
        handleResponse(message);
        break;
      case "error":
        handleError(message);
        break;
      case "retryAttempt":
        handleRetryAttempt(message);
        break;
      case "collections":
        populateCollectionsDropdown(message.collections);
        break;
    }
  }
  function sendRequest() {
    const btn = document.getElementById("send");
    if (state.isRequestInProgress) {
      post({ type: "cancelRequest" });
      btn.textContent = "Send";
      state.isRequestInProgress = false;
      return;
    }
    state.isRequestInProgress = true;
    btn.textContent = "Cancel \u2715";
    const request = getRequestData();
    post({ type: "sendRequest", ...request });
  }
  function getRequestData() {
    const envBadge = document.getElementById("env-badge");
    const activeEnv = envBadge ? envBadge.textContent === "No Environment" ? "none" : envBadge.textContent : "none";
    let headers = document.getElementById("headers").value;
    const authType = document.getElementById("auth-type")?.value;
    if (authType === "bearer") {
      const token = document.getElementById("auth-token")?.value;
      if (token) headers = `Authorization: Bearer ${token}
` + headers;
    } else if (authType === "basic") {
      const user = document.getElementById("auth-username")?.value || "";
      const pass = document.getElementById("auth-password")?.value || "";
      if (user || pass) {
        const encoded = btoa(`${user}:${pass}`);
        headers = `Authorization: Basic ${encoded}
` + headers;
      }
    }
    return {
      id: state.currentRequest?.id,
      name: state.currentRequest?.name,
      method: document.getElementById("method").value,
      url: document.getElementById("url").value,
      headers,
      body: document.getElementById("body").value,
      notes: document.getElementById("notes").value,
      queryParams: state.queryParams,
      environment: activeEnv,
      retryCount: parseInt(document.getElementById("retry-count")?.value || "0", 10),
      timeout: parseInt(document.getElementById("timeout")?.value || "10000", 10)
    };
  }
  function loadRequestIntoUI(req) {
    if (!req) return;
    state.currentRequest = req;
    document.getElementById("method").value = req.method || "GET";
    document.getElementById("url").value = req.url || "";
    document.getElementById("headers").value = req.headers || "";
    document.getElementById("body").value = req.body || "";
    document.getElementById("notes").value = req.notes || "";
    if (req.retryCount !== void 0) {
      document.getElementById("retry-count").value = req.retryCount;
    }
    if (req.timeout !== void 0) {
      document.getElementById("timeout").value = req.timeout;
    }
    state.queryParams = req.queryParams || [];
    renderQueryParams();
    notify("info", `Loaded: ${req.name || "Request"}`);
  }
  function handleResponse(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById("send");
    btn.textContent = "Send";
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const sizeBadge = document.getElementById("size-badge");
    const responseBody = document.getElementById("response-body");
    statusBadge.textContent = `${res.status} ${res.statusText}`;
    statusBadge.className = `badge ${res.status < 300 ? "badge-2xx" : res.status < 500 ? "badge-4xx" : "badge-5xx"}`;
    timeBadge.textContent = `${res.duration} ms`;
    sizeBadge.textContent = res.size ? `${(res.size / 1024).toFixed(2)} KB` : "-- KB";
    try {
      const data = res.data;
      if (typeof data === "object" && data !== null) {
        const formatted = syntaxHighlightJson(JSON.stringify(data, null, 2));
        responseBody.innerHTML = `<pre style="margin:0">${formatted}</pre>`;
      } else {
        responseBody.textContent = String(data);
      }
    } catch (e) {
      responseBody.textContent = String(res.data);
    }
  }
  function handleError(res) {
    state.isRequestInProgress = false;
    const btn = document.getElementById("send");
    btn.textContent = "Send";
    const statusBadge = document.getElementById("status-badge");
    const timeBadge = document.getElementById("time-badge");
    const responseBody = document.getElementById("response-body");
    statusBadge.textContent = res.cancelled ? "Cancelled" : "Error";
    statusBadge.className = "badge badge-5xx";
    timeBadge.textContent = res.duration ? `${res.duration} ms` : "--";
    responseBody.innerHTML = `<div style="color: #f85149; padding: 8px;">\u26A0\uFE0F ${res.error || "Unknown error"}</div>`;
  }
  function handleRetryAttempt(res) {
    const btn = document.getElementById("send");
    btn.textContent = `Retrying (${res.attempt}/${res.total})...`;
  }
  function populateCollectionsDropdown(collections) {
    const select = document.getElementById("save-collection");
    if (!select || !Array.isArray(collections)) return;
    select.innerHTML = collections.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    if (collections.length === 0) {
      select.innerHTML = '<option value="">No collections yet \u2014 create one first</option>';
    }
  }
})();
//# sourceMappingURL=script.js.map
