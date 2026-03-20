"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/webview/state.js
  var state;
  var init_state = __esm({
    "src/webview/state.js"() {
      "use strict";
      state = {
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
  function saveVsState(state2) {
    _vscode.setState(state2);
  }
  var _vscode;
  var init_api = __esm({
    "src/webview/api.js"() {
      "use strict";
      _vscode = null;
    }
  });

  // src/webview/ui.js
  var ui_exports = {};
  __export(ui_exports, {
    confirmAction: () => confirmAction,
    constructFullUrl: () => constructFullUrl,
    currentConfirmCallback: () => currentConfirmCallback,
    escapeHtml: () => escapeHtml,
    executeConfirmAction: () => executeConfirmAction,
    hideAllPreviews: () => hideAllPreviews,
    hideModals: () => hideModals,
    renderQueryParams: () => renderQueryParams,
    showPreview: () => showPreview,
    switchResponseTab: () => switchResponseTab,
    switchTab: () => switchTab,
    updateEnvironmentIndicator: () => updateEnvironmentIndicator,
    updatePreview: () => updatePreview,
    updateVariableCount: () => updateVariableCount
  });
  function updatePreview() {
    if (state.isUpdatingPreview) {
      return;
    }
    state.isUpdatingPreview = true;
    const environmentSelect = document.getElementById("environment");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const envName = environmentSelect ? environmentSelect.value : "none";
    if (envName === "none") {
      hideAllPreviews();
      state.isUpdatingPreview = false;
      return;
    }
    post({
      type: "previewVariables",
      environment: envName,
      inputs: {
        url: constructFullUrl(),
        headers: headersTextarea ? headersTextarea.value : "",
        body: bodyTextarea ? bodyTextarea.value : ""
      }
    });
    setTimeout(() => {
      state.isUpdatingPreview = false;
    }, 50);
  }
  function escapeHtml(text) {
    if (!text) {
      return "";
    }
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
    const tabContent = document.getElementById(tabName + "-tab");
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabContent) {
      tabContent.classList.add("active");
    }
    if (tabButton) {
      tabButton.classList.add("active");
    }
  }
  function switchResponseTab(tabName) {
    document.querySelectorAll(".response-content").forEach((c) => c.classList.remove("active"));
    document.querySelectorAll(".response-tab-button").forEach((b) => b.classList.remove("active"));
    const tabContent = document.getElementById("response-" + tabName + "-tab");
    const tabButton = document.querySelector(`[data-response-tab="${tabName}"]`);
    if (tabContent) {
      tabContent.classList.add("active");
    }
    if (tabButton) {
      tabButton.classList.add("active");
    }
  }
  function hideModals() {
    document.querySelectorAll(".modal").forEach((m) => {
      m.style.display = "none";
      m.classList.remove("modal-visible");
    });
  }
  function confirmAction(message, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    if (!modal) return;
    document.getElementById("confirm-modal-message").textContent = message;
    currentConfirmCallback = onConfirm;
    modal.style.display = "block";
  }
  function executeConfirmAction() {
    if (currentConfirmCallback) currentConfirmCallback();
    hideModals();
  }
  function hideAllPreviews() {
    const urlPreview = document.getElementById("url-preview");
    const headersPreview = document.getElementById("headers-preview");
    const bodyPreview = document.getElementById("body-preview");
    [urlPreview, headersPreview, bodyPreview].forEach((el) => {
      if (el) {
        el.classList.add("preview-hidden");
        el.classList.remove("preview-visible");
      }
    });
  }
  function showPreview(urlResult, headersResult, bodyResult, errors) {
    const updateBlock = (element, result, hasError) => {
      if (!element) {
        return;
      }
      if (result && result.trim() !== "") {
        element.textContent = hasError ? "Error resolving variables" : `Resolved: ${result}`;
        element.style.display = "block";
        element.className = hasError ? "preview-hint error" : "preview-hint";
      } else {
        element.style.display = "none";
      }
    };
    updateBlock(document.getElementById("url-preview"), urlResult, errors.url);
    updateBlock(document.getElementById("headers-preview"), headersResult, errors.headers);
    updateBlock(document.getElementById("body-preview"), bodyResult, errors.body);
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
      const queryString = validParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
      return `${baseUrl}${separator}${queryString}`;
    }
    return baseUrl;
  }
  function renderQueryParams() {
    const container = document.getElementById("query-params-list");
    if (!container) {
      return;
    }
    container.innerHTML = "";
    state.queryParams.forEach((param, index) => {
      const row = document.createElement("div");
      row.className = "query-param-row flex-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = `
            <input type="text" class="param-key param-input" placeholder="Key" value="${escapeHtml(param.key)}">
            <input type="text" class="param-value param-input" placeholder="Value" value="${escapeHtml(param.value)}">
            <button class="remove-btn remove-param-btn" title="Remove parameter">\u274C</button>
        `;
      row.querySelector(".param-key").addEventListener("input", (e) => {
        state.queryParams[index].key = e.target.value;
      });
      row.querySelector(".param-value").addEventListener("input", (e) => {
        state.queryParams[index].value = e.target.value;
      });
      row.querySelector(".remove-btn").addEventListener("click", () => {
        state.queryParams.splice(index, 1);
        renderQueryParams();
      });
      container.appendChild(row);
    });
  }
  function updateEnvironmentIndicator(env) {
    const envIndicator = document.getElementById("env-indicator");
    if (envIndicator) {
      envIndicator.textContent = env === "none" ? "No Environment" : env;
      envIndicator.className = "env-indicator";
      if (env === "production") {
        envIndicator.classList.add("env-production");
      } else if (env === "development") {
        envIndicator.classList.add("env-development");
      } else if (env === "staging") {
        envIndicator.classList.add("env-staging");
      }
    }
  }
  function updateVariableCount(envName) {
    const envCount = document.getElementById("env-count");
    if (!envCount) {
      return;
    }
    if (envName === "none") {
      envCount.textContent = "0 variables";
    } else {
      const env = state.environments.find((e) => e.name === envName);
      const count = env ? Object.keys(env.variables).length : 0;
      envCount.textContent = `${count} variable${count !== 1 ? "s" : ""}`;
    }
  }
  var currentConfirmCallback;
  var init_ui = __esm({
    "src/webview/ui.js"() {
      "use strict";
      init_state();
      init_api();
      currentConfirmCallback = null;
    }
  });

  // src/webview/auth.js
  function onAuthTypeChange() {
    const authTypeSelect = document.getElementById("auth-type");
    const basicAuthFields = document.getElementById("basic-auth-fields");
    const bearerAuthFields = document.getElementById("bearer-auth-fields");
    state.authConfig.type = authTypeSelect ? authTypeSelect.value : "none";
    if (basicAuthFields) {
      basicAuthFields.classList.add("hidden-element");
    }
    if (bearerAuthFields) {
      bearerAuthFields.classList.add("hidden-element");
    }
    if (state.authConfig.type === "basic" && basicAuthFields) {
      basicAuthFields.classList.remove("hidden-element");
      updateBasicAuthPreview();
    } else if (state.authConfig.type === "bearer" && bearerAuthFields) {
      bearerAuthFields.classList.remove("hidden-element");
      updateBearerAuthPreview();
    }
  }
  function updateBasicAuthPreview() {
    const authUsername = document.getElementById("auth-username");
    const authPassword = document.getElementById("auth-password");
    state.authConfig.username = authUsername ? authUsername.value : "";
    state.authConfig.password = authPassword ? authPassword.value : "";
    const preview = document.getElementById("basic-auth-preview");
    if (!preview) {
      return;
    }
    if (state.authConfig.username) {
      const encoded = btoa(`${state.authConfig.username}:${state.authConfig.password}`);
      preview.textContent = `Authorization: Basic ${encoded}`;
      preview.classList.add("auth-preview-visible");
    } else {
      preview.textContent = "";
      preview.classList.remove("auth-preview-visible");
    }
  }
  function updateBearerAuthPreview() {
    const authToken = document.getElementById("auth-token");
    state.authConfig.token = authToken ? authToken.value : "";
    const preview = document.getElementById("bearer-auth-preview");
    if (!preview) {
      return;
    }
    if (state.authConfig.token) {
      preview.textContent = `Authorization: Bearer ${state.authConfig.token}`;
      preview.classList.add("auth-preview-visible");
    } else {
      preview.textContent = "";
      preview.classList.remove("auth-preview-visible");
    }
  }
  function buildAuthHeader() {
    if (state.authConfig.type === "basic" && state.authConfig.username) {
      const encoded = btoa(`${state.authConfig.username}:${state.authConfig.password}`);
      return `Authorization: Basic ${encoded}`;
    }
    if (state.authConfig.type === "bearer" && state.authConfig.token) {
      return `Authorization: Bearer ${state.authConfig.token}`;
    }
    return null;
  }
  function restoreAuthUI(savedAuth) {
    if (!savedAuth || savedAuth.type === "none") {
      return;
    }
    state.authConfig = { ...savedAuth };
    const authTypeSelect = document.getElementById("auth-type");
    const basicAuthFields = document.getElementById("basic-auth-fields");
    const bearerAuthFields = document.getElementById("bearer-auth-fields");
    if (authTypeSelect) {
      authTypeSelect.value = state.authConfig.type;
    }
    if (state.authConfig.type === "basic") {
      const authUsername = document.getElementById("auth-username");
      const authPassword = document.getElementById("auth-password");
      if (authUsername) {
        authUsername.value = state.authConfig.username || "";
      }
      if (authPassword) {
        authPassword.value = state.authConfig.password || "";
      }
      if (basicAuthFields) {
        basicAuthFields.classList.remove("hidden-element");
      }
      updateBasicAuthPreview();
    } else if (state.authConfig.type === "bearer") {
      const authToken = document.getElementById("auth-token");
      if (authToken) {
        authToken.value = state.authConfig.token || "";
      }
      if (bearerAuthFields) {
        bearerAuthFields.classList.remove("hidden-element");
      }
      updateBearerAuthPreview();
    }
  }
  var init_auth = __esm({
    "src/webview/auth.js"() {
      "use strict";
      init_state();
      init_api();
    }
  });

  // src/webview/request.js
  var request_exports = {};
  __export(request_exports, {
    clearRequestForm: () => clearRequestForm,
    loadRequestIntoForm: () => loadRequestIntoForm,
    saveRequest: () => saveRequest,
    sendRequest: () => sendRequest,
    validateCurrentRequest: () => validateCurrentRequest
  });
  async function sendRequest() {
    const methodSelect = document.getElementById("method");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const environmentSelect = document.getElementById("environment");
    const sendButton = document.getElementById("send");
    const retryCountInput = document.getElementById("retry-count");
    const notesTextarea = document.getElementById("request-notes");
    const method = methodSelect.value;
    const url = constructFullUrl();
    const headers = headersTextarea ? headersTextarea.value : "";
    const body = bodyTextarea ? bodyTextarea.value : "";
    const notes = notesTextarea ? notesTextarea.value : "";
    const selectedEnvironment = environmentSelect ? environmentSelect.value : "none";
    const retryCount = retryCountInput ? parseInt(retryCountInput.value) || 0 : 0;
    let finalHeaders = headers;
    const authHeader = buildAuthHeader();
    if (authHeader) {
      const hasAuthHeader = finalHeaders.toLowerCase().includes("authorization:");
      if (!hasAuthHeader) {
        finalHeaders = finalHeaders.trim() ? `${finalHeaders.trim()}
${authHeader}` : authHeader;
      }
    }
    if (!url || url.trim() === "") {
      notify("error", "URL is required");
      return;
    }
    if (state.isRequestInProgress) {
      post({ type: "cancelRequest" });
      if (sendButton) {
        sendButton.textContent = "Send Request";
        sendButton.disabled = false;
      }
      state.isRequestInProgress = false;
      return;
    }
    state.currentRequest = { method, url, headers, body, notes };
    if (sendButton) {
      sendButton.textContent = "Cancel";
      sendButton.disabled = false;
    }
    state.isRequestInProgress = true;
    post({
      type: "sendRequest",
      method,
      url,
      headers: finalHeaders,
      body,
      timeout: state.settings.timeout || 1e4,
      environment: selectedEnvironment,
      retryCount: Math.min(Math.max(retryCount, 0), 5)
    });
  }
  function clearRequestForm() {
    const methodSelect = document.getElementById("method");
    const urlInput = document.getElementById("url");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("request-notes");
    const authTypeSelect = document.getElementById("auth-type");
    const basicAuthFields = document.getElementById("basic-auth-fields");
    const bearerAuthFields = document.getElementById("bearer-auth-fields");
    if (methodSelect) {
      methodSelect.value = "GET";
    }
    if (urlInput) {
      urlInput.value = "";
    }
    if (headersTextarea) {
      headersTextarea.value = "";
    }
    if (bodyTextarea) {
      bodyTextarea.value = "";
    }
    if (notesTextarea) {
      notesTextarea.value = "";
    }
    state.queryParams = [];
    renderQueryParams();
    state.authConfig = { type: "none", username: "", password: "", token: "" };
    if (authTypeSelect) {
      authTypeSelect.value = "none";
    }
    if (basicAuthFields) {
      basicAuthFields.classList.add("hidden-element");
    }
    if (bearerAuthFields) {
      bearerAuthFields.classList.add("hidden-element");
    }
  }
  function loadRequestIntoForm(item) {
    if (!item) {
      return;
    }
    const methodSelect = document.getElementById("method");
    const urlInput = document.getElementById("url");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("request-notes");
    const authTypeSelect = document.getElementById("auth-type");
    const basicAuthFields = document.getElementById("basic-auth-fields");
    const bearerAuthFields = document.getElementById("bearer-auth-fields");
    if (methodSelect) {
      methodSelect.value = item.method || "GET";
    }
    if (item.queryParams && item.queryParams.length > 0) {
      if (urlInput) {
        urlInput.value = item.url.split("?")[0];
      }
      state.queryParams = item.queryParams.map((p) => ({ ...p }));
    } else {
      try {
        const urlObj = new URL(item.url);
        if (urlInput) {
          urlInput.value = urlObj.origin + urlObj.pathname;
        }
        state.queryParams = [];
        urlObj.searchParams.forEach((value, key) => state.queryParams.push({ key, value }));
      } catch (e) {
        const [baseUrl, queryString] = item.url.split("?");
        if (urlInput) {
          urlInput.value = baseUrl;
        }
        state.queryParams = queryString ? queryString.split("&").map((param) => {
          const eqIndex = param.indexOf("=");
          if (eqIndex === -1) {
            return { key: decodeURIComponent(param), value: "" };
          }
          return { key: decodeURIComponent(param.substring(0, eqIndex)), value: decodeURIComponent(param.substring(eqIndex + 1)) };
        }).filter((p) => p.key) : [];
      }
    }
    if (headersTextarea) {
      headersTextarea.value = item.headers || "";
    }
    if (bodyTextarea) {
      bodyTextarea.value = item.body || "";
    }
    if (notesTextarea) {
      notesTextarea.value = item.notes || "";
    }
    if (item.auth) {
      restoreAuthUI(item.auth);
    } else {
      state.authConfig = { type: "none", username: "", password: "", token: "" };
      if (authTypeSelect) {
        authTypeSelect.value = "none";
      }
      if (basicAuthFields) {
        basicAuthFields.classList.add("hidden-element");
      }
      if (bearerAuthFields) {
        bearerAuthFields.classList.add("hidden-element");
      }
    }
    renderQueryParams();
    switchTab("request");
  }
  function validateCurrentRequest() {
    const environmentSelect = document.getElementById("environment");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const envName = environmentSelect ? environmentSelect.value : "none";
    post({
      type: "validateVariables",
      environment: envName,
      inputs: {
        url: constructFullUrl(),
        headers: headersTextarea ? headersTextarea.value : "",
        body: bodyTextarea ? bodyTextarea.value : ""
      }
    });
  }
  function saveRequest() {
    const nameInput = document.getElementById("save-name");
    const collSelect = document.getElementById("save-collection");
    const methodSelect = document.getElementById("method");
    const urlInput = document.getElementById("url");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("request-notes");
    if (!nameInput || !collSelect) {
      return;
    }
    const name = nameInput.value.trim();
    const collection = collSelect.value;
    if (!name) {
      notify("error", "Please enter a request name");
      return;
    }
    if (!collection) {
      notify("error", "Please select a collection");
      return;
    }
    const reqToSave = {
      name,
      method: methodSelect ? methodSelect.value : "GET",
      url: urlInput ? urlInput.value : "",
      headers: headersTextarea ? headersTextarea.value : "",
      body: bodyTextarea ? bodyTextarea.value : "",
      notes: notesTextarea ? notesTextarea.value : "",
      queryParams: [...state.queryParams],
      auth: { ...state.authConfig }
    };
    if (!state.collections[collection]) {
      state.collections[collection] = [];
    }
    state.collections[collection].push(reqToSave);
    saveState();
    Promise.resolve().then(() => (init_collections(), collections_exports)).then((m) => {
      m.renderCollections();
      m.updateSaveCollectionOptions();
    });
    Promise.resolve().then(() => (init_ui(), ui_exports)).then((m) => m.hideModals());
    nameInput.value = "";
    notify("info", `Request saved to "${collection}"`);
  }
  var init_request = __esm({
    "src/webview/request.js"() {
      "use strict";
      init_state();
      init_api();
      init_ui();
      init_auth();
      init_collections();
    }
  });

  // src/webview/collections.js
  var collections_exports = {};
  __export(collections_exports, {
    TEMPLATES_COLLECTION: () => TEMPLATES_COLLECTION,
    confirmSaveAsTemplate: () => confirmSaveAsTemplate,
    createCollection: () => createCollection,
    deleteCollection: () => deleteCollection,
    deleteRequest: () => deleteRequest,
    deleteSelectedTemplate: () => deleteSelectedTemplate,
    exportCollection: () => exportCollection,
    loadSelectedTemplate: () => loadSelectedTemplate,
    renderCollections: () => renderCollections,
    renderTemplateSelector: () => renderTemplateSelector,
    saveAsTemplate: () => saveAsTemplate,
    saveState: () => saveState,
    showCollectionModal: () => showCollectionModal,
    updateSaveCollectionOptions: () => updateSaveCollectionOptions
  });
  function saveState() {
    const s = { history: state.history, collections: state.collections, settings: state.settings };
    saveVsState(s);
    post({ type: "saveState", state: s });
  }
  function renderCollections() {
    const container = document.getElementById("collections-list");
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const collectionNames = Object.keys(state.collections);
    if (collectionNames.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-message";
      emptyDiv.textContent = "No collections yet";
      container.appendChild(emptyDiv);
      return;
    }
    collectionNames.forEach((name) => {
      const requests = state.collections[name];
      const isExpanded = state.expandedCollections.has(name);
      const icon = isExpanded ? "\u{1F4C2}" : "\u{1F4C1}";
      const div = document.createElement("div");
      div.className = "collection-item";
      const header = document.createElement("div");
      header.className = "collection-header";
      header.innerHTML = `
            <span><strong>${icon} ${escapeHtml(name)}</strong> <span class="count-badge">(${requests.length})</span></span>
            <div style="display: flex; gap: 4px;">
                <button class="export-collection-btn icon-btn" title="Export collection to JSON">\u2B07\uFE0F</button>
                <button class="delete-collection-btn icon-btn" title="Delete collection">\u{1F5D1}\uFE0F</button>
            </div>
        `;
      header.addEventListener("click", (e) => {
        if (e.target.closest(".delete-collection-btn")) {
          deleteCollection(name);
          return;
        }
        if (e.target.closest(".export-collection-btn")) {
          exportCollection(name);
          return;
        }
        if (state.expandedCollections.has(name)) {
          state.expandedCollections.delete(name);
        } else {
          state.expandedCollections.add(name);
        }
        renderCollections();
      });
      div.appendChild(header);
      if (isExpanded && requests.length > 0) {
        const subList = document.createElement("div");
        subList.className = "subheader-margin-left";
        requests.forEach((req, idx) => {
          const rDiv = document.createElement("div");
          rDiv.className = "request-item item-padding item-font-small flex-between cursor-pointer";
          rDiv.innerHTML = `
                    <span>
                        <span class="method ${req.method}">${req.method}</span>
                        <span class="method-name-span">${escapeHtml(req.name)}</span>
                    </span>
                    <button class="delete-request-btn icon-btn" title="Delete request">\u274C</button>
                `;
          rDiv.addEventListener("click", (e) => {
            if (e.target.closest(".delete-request-btn")) {
              deleteRequest(name, idx);
              return;
            }
            Promise.resolve().then(() => (init_request(), request_exports)).then((m) => m.loadRequestIntoForm(req));
          });
          rDiv.addEventListener("mouseenter", () => rDiv.classList.add("request-item-hover"));
          rDiv.addEventListener("mouseleave", () => rDiv.classList.remove("request-item-hover"));
          subList.appendChild(rDiv);
        });
        div.appendChild(subList);
      }
      container.appendChild(div);
    });
  }
  function deleteCollection(name) {
    confirmAction(`Delete collection "${name}"? This will delete all ${state.collections[name].length} request(s) in it.`, () => {
      delete state.collections[name];
      state.expandedCollections.delete(name);
      saveState();
      renderCollections();
      updateSaveCollectionOptions();
      notify("info", `Collection "${name}" deleted`);
    });
  }
  function exportCollection(name) {
    const requests = state.collections[name] || [];
    const payload = {
      metadata: {
        collectionName: name,
        exportTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        requestCount: requests.length,
        version: "1.2.0"
      },
      requests
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = name.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "collection";
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    a.download = `${safeName}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("info", `Collection "${name}" exported.`);
  }
  function deleteRequest(collectionName, requestIndex) {
    if (state.collections[collectionName] && state.collections[collectionName][requestIndex]) {
      const requestName = state.collections[collectionName][requestIndex].name;
      state.collections[collectionName].splice(requestIndex, 1);
      saveState();
      renderCollections();
      notify("info", `Request "${requestName}" deleted`);
    }
  }
  function updateSaveCollectionOptions() {
    const select = document.getElementById("save-collection");
    if (!select) {
      return;
    }
    select.innerHTML = '<option value="">Select Collection</option>';
    Object.keys(state.collections).sort().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }
  function showCollectionModal() {
    const modal = document.getElementById("collection-modal");
    const nameInput = document.getElementById("collection-name");
    if (modal) {
      modal.style.display = "block";
      modal.classList.add("modal-visible");
    }
    if (nameInput) {
      nameInput.value = "";
      nameInput.focus();
    }
  }
  function createCollection() {
    const nameInput = document.getElementById("collection-name");
    if (!nameInput) {
      return;
    }
    const name = nameInput.value.trim();
    if (!name) {
      notify("error", "Please enter a collection name");
      return;
    }
    if (state.collections[name]) {
      notify("error", "Collection already exists");
      return;
    }
    state.collections[name] = [];
    saveState();
    renderCollections();
    updateSaveCollectionOptions();
    hideModals();
    notify("info", `Collection "${name}" created`);
  }
  function renderTemplateSelector() {
    const templateSelect = document.getElementById("template-select");
    if (!templateSelect) {
      return;
    }
    const templates = state.collections[TEMPLATES_COLLECTION] || [];
    const currentValue = templateSelect.value;
    templateSelect.innerHTML = '<option value="">-- Select Template --</option>';
    templates.forEach((t) => {
      const option = document.createElement("option");
      option.value = t.name;
      const usageText = t.usageCount ? ` (used ${t.usageCount}\xD7)` : "";
      option.textContent = `${t.method} \u2014 ${t.name}${usageText}`;
      templateSelect.appendChild(option);
    });
    if (templates.some((t) => t.name === currentValue)) {
      templateSelect.value = currentValue;
    }
    const wrap = document.getElementById("template-selector-wrap");
    if (wrap) {
      wrap.style.display = templates.length > 0 ? "block" : "none";
    }
  }
  function saveAsTemplate() {
    const urlInput = document.getElementById("url");
    const url = urlInput ? urlInput.value.trim() : "";
    if (!url) {
      notify("error", "Please enter a URL before saving as template");
      return;
    }
    const methodSelect = document.getElementById("method");
    const method = methodSelect ? methodSelect.value : "GET";
    const urlPath = url.split("/").pop() || url;
    const modal = document.getElementById("template-modal");
    const nameInput = document.getElementById("template-name");
    if (modal) {
      modal.style.display = "block";
      modal.classList.add("modal-visible");
    }
    if (nameInput) {
      nameInput.value = `${method} ${urlPath}`;
      nameInput.focus();
      nameInput.select();
    }
  }
  function confirmSaveAsTemplate() {
    const nameInput = document.getElementById("template-name");
    if (!nameInput) {
      return;
    }
    const name = nameInput.value.trim();
    if (!name) {
      notify("error", "Please enter a template name");
      return;
    }
    if (!state.collections[TEMPLATES_COLLECTION]) {
      state.collections[TEMPLATES_COLLECTION] = [];
    }
    if (state.collections[TEMPLATES_COLLECTION].some((t) => t.name === name)) {
      notify("error", `Template "${name}" already exists`);
      return;
    }
    const urlInput = document.getElementById("url");
    const methodSelect = document.getElementById("method");
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const notesTextarea = document.getElementById("request-notes");
    const template = {
      name,
      method: methodSelect ? methodSelect.value : "GET",
      url: urlInput ? urlInput.value : "",
      headers: headersTextarea ? headersTextarea.value : "",
      body: bodyTextarea ? bodyTextarea.value : "",
      notes: notesTextarea ? notesTextarea.value : "",
      queryParams: [...state.queryParams],
      auth: { ...state.authConfig },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      usageCount: 0
    };
    state.collections[TEMPLATES_COLLECTION].push(template);
    saveState();
    renderCollections();
    renderTemplateSelector();
    hideModals();
    notify("info", `\u2705 Template "${name}" saved!`);
  }
  function loadSelectedTemplate() {
    const templateSelect = document.getElementById("template-select");
    if (!templateSelect || !templateSelect.value) {
      notify("error", "Please select a template first");
      return;
    }
    const templateName = templateSelect.value;
    const templates = state.collections[TEMPLATES_COLLECTION] || [];
    const template = templates.find((t) => t.name === templateName);
    if (!template) {
      notify("error", "Template not found");
      return;
    }
    template.usageCount = (template.usageCount || 0) + 1;
    saveState();
    Promise.resolve().then(() => (init_request(), request_exports)).then((m) => m.loadRequestIntoForm(template));
    notify("info", `\u{1F4CC} Template "${templateName}" loaded`);
  }
  function deleteSelectedTemplate() {
    const templateSelect = document.getElementById("template-select");
    if (!templateSelect || !templateSelect.value) {
      notify("error", "Please select a template first");
      return;
    }
    const templateName = templateSelect.value;
    confirmAction(`Delete template "${templateName}"?`, () => {
      const templates = state.collections[TEMPLATES_COLLECTION] || [];
      const index = templates.findIndex((t) => t.name === templateName);
      if (index !== -1) {
        state.collections[TEMPLATES_COLLECTION].splice(index, 1);
        saveState();
        renderCollections();
        renderTemplateSelector();
        notify("info", `Template "${templateName}" deleted`);
      }
    });
  }
  var TEMPLATES_COLLECTION;
  var init_collections = __esm({
    "src/webview/collections.js"() {
      "use strict";
      init_state();
      init_api();
      init_ui();
      TEMPLATES_COLLECTION = "Templates";
    }
  });

  // src/webview/history.js
  var history_exports = {};
  __export(history_exports, {
    addToHistory: () => addToHistory,
    clearHistory: () => clearHistory,
    renderHistory: () => renderHistory
  });
  function addToHistory(request, response, duration) {
    if (!request) {
      return;
    }
    const historyItem = {
      ...request,
      responseStatus: response.status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      duration
    };
    state.history.unshift(historyItem);
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50);
    }
    saveState();
    renderHistory();
  }
  function renderHistory() {
    const container = document.getElementById("history-list");
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const searchInput = document.getElementById("history-search");
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    let displayList = state.history;
    if (searchTerm) {
      displayList = displayList.filter((item) => {
        const urlMatch = (item.url || "").toLowerCase().includes(searchTerm);
        const methodMatch = (item.method || "").toLowerCase().includes(searchTerm);
        const statusMatch = (item.responseStatus || "").toString().includes(searchTerm);
        return urlMatch || methodMatch || statusMatch;
      });
    }
    if (displayList.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "empty-message";
      emptyDiv.textContent = searchTerm ? "No matching history found" : "No history yet";
      container.appendChild(emptyDiv);
      return;
    }
    displayList.forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item cursor-pointer";
      const statusClass = item.responseStatus >= 200 && item.responseStatus < 300 ? "status-success" : "status-error";
      const timestamp = new Date(item.timestamp).toLocaleString();
      div.innerHTML = `
            <div class="header-flex">
                <span class="method ${item.method}">${item.method}</span>
                <span class="url-span">${escapeHtml(item.url)}</span>
            </div>
            <div class="metadata-text">
                <span class="${statusClass}">${item.responseStatus}</span>
                <span class="metadata-separator">\u2022</span>
                <span>${item.duration}ms</span>
                <span class="metadata-separator">\u2022</span>
                <span>${timestamp}</span>
            </div>
        `;
      const tooltip = item.notes ? `

Notes:
${item.notes}` : "";
      div.title = `${item.method} ${item.url}
Status: ${item.responseStatus} \u2022 ${item.duration}ms${tooltip}`;
      div.addEventListener("click", () => {
        Promise.resolve().then(() => (init_request(), request_exports)).then((m) => m.loadRequestIntoForm(item));
      });
      container.appendChild(div);
    });
  }
  function clearHistory() {
    if (state.history.length === 0) return;
    confirmAction("Clear all history? This cannot be undone.", () => {
      state.history = [];
      saveState();
      renderHistory();
      notify("info", "History cleared");
    });
  }
  var init_history = __esm({
    "src/webview/history.js"() {
      "use strict";
      init_state();
      init_api();
      init_ui();
      init_collections();
    }
  });

  // src/webview/main.js
  init_state();
  init_api();
  init_ui();
  init_auth();

  // src/webview/highlighting.js
  function syntaxHighlightJson(json) {
    if (typeof json !== "string") {
      json = JSON.stringify(json, null, 2);
    }
    json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
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

  // src/webview/main.js
  init_history();
  init_collections();

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
    const headersTextarea = document.getElementById("headers");
    const bodyTextarea = document.getElementById("body");
    const method = methodSelect ? methodSelect.value : "GET";
    const headers = headersTextarea ? headersTextarea.value : "";
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
    const curlInput = document.getElementById("curl-import-input");
    if (!curlInput) {
      return;
    }
    const curlText = curlInput.value.trim();
    if (!curlText) {
      notify("error", "Please paste a cURL command");
      return;
    }
    try {
      const methodSelect = document.getElementById("method");
      const urlInput = document.getElementById("url");
      const headersTextarea = document.getElementById("headers");
      const bodyTextarea = document.getElementById("body");
      const methodMatch = curlText.match(/-X\s+(\w+)/i) || curlText.match(/--request\s+(\w+)/i);
      if (methodMatch && methodSelect) {
        methodSelect.value = methodMatch[1].toUpperCase();
      } else if (methodSelect) {
        methodSelect.value = "GET";
      }
      const urlMatch = curlText.match(/["'](https?:\/\/[^"']+)["']/) || curlText.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const fullUrl = urlMatch[1];
        if (fullUrl.includes("?")) {
          const [base, query] = fullUrl.split("?");
          if (urlInput) {
            urlInput.value = base;
          }
          state.queryParams = query.split("&").map((param) => {
            const [key = "", value = ""] = param.split("=");
            return { key: decodeURIComponent(key), value: decodeURIComponent(value) };
          }).filter((p) => p.key);
          renderQueryParams();
        } else {
          if (urlInput) {
            urlInput.value = fullUrl;
          }
          state.queryParams = [];
          renderQueryParams();
        }
      }
      const headerRegex = /-H\s+["']([^"']+)["']/g;
      let headerMatch;
      const headersList = [];
      while ((headerMatch = headerRegex.exec(curlText)) !== null) {
        headersList.push(headerMatch[1]);
      }
      if (headersTextarea) {
        headersTextarea.value = headersList.join("\n");
      }
      const dataMatch = curlText.match(/-d\s+['"]([^'"]+)['"]/) || curlText.match(/--data\s+['"]([^'"]+)['"]/);
      if (dataMatch && bodyTextarea) {
        try {
          bodyTextarea.value = JSON.stringify(JSON.parse(dataMatch[1]), null, 2);
        } catch {
          bodyTextarea.value = dataMatch[1];
        }
      } else if (bodyTextarea) {
        bodyTextarea.value = "";
      }
      hideModals();
      notify("info", "\u2705 cURL imported successfully!");
    } catch (e) {
      notify("error", "Error parsing cURL: " + e.message);
    }
  }

  // src/webview/main.js
  init_request();

  // src/webview/shortcuts.js
  init_state();
  init_collections();
  init_api();
  init_request();
  init_ui();
  function setupShortcutsUI() {
    const shortcutInputs = document.querySelectorAll(".shortcut-input");
    const shortcutError = document.getElementById("shortcut-error");
    shortcutInputs.forEach((input) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Tab") return;
        e.preventDefault();
        e.stopPropagation();
        let keys = [];
        if (e.ctrlKey || e.metaKey) keys.push("ctrl");
        if (e.shiftKey) keys.push("shift");
        if (e.altKey) keys.push("alt");
        let key = e.key.toLowerCase();
        if (["control", "meta", "shift", "alt"].includes(key)) return;
        if (key === " ") key = "space";
        keys.push(key);
        const newShortcut = keys.join("+");
        const action = input.dataset.action;
        const conflict = Object.entries(state.settings.shortcuts || {}).find(([a, s]) => s === newShortcut && a !== action);
        if (conflict) {
          if (shortcutError) {
            shortcutError.textContent = `Conflict: '${newShortcut}' is used by '${conflict[0]}'`;
            shortcutError.style.display = "inline";
            setTimeout(() => shortcutError.style.display = "none", 3e3);
          }
          return;
        }
        if (!state.settings.shortcuts) state.settings.shortcuts = {};
        state.settings.shortcuts[action] = newShortcut;
        input.value = newShortcut;
        saveState();
        if (shortcutError) shortcutError.style.display = "none";
      });
    });
    document.getElementById("reset-shortcuts")?.addEventListener("click", () => {
      state.settings.shortcuts = {
        sendRequest: "ctrl+enter",
        saveRequest: "ctrl+s",
        clearForm: "ctrl+k",
        closeModal: "escape"
      };
      shortcutInputs.forEach((input) => {
        input.value = state.settings.shortcuts[input.dataset.action] || "";
      });
      saveState();
      notify("info", "Shortcuts reset to defaults");
    });
  }
  function matchesShortcut(e, shortcutStr) {
    if (!shortcutStr) return false;
    const parts = shortcutStr.toLowerCase().split("+");
    const requiresCtrl = parts.includes("ctrl") || parts.includes("cmd");
    const requiresShift = parts.includes("shift");
    const requiresAlt = parts.includes("alt");
    const key = parts[parts.length - 1];
    const hasCtrl = e.ctrlKey || e.metaKey;
    if (requiresCtrl !== hasCtrl) return false;
    if (requiresShift !== e.shiftKey) return false;
    if (requiresAlt !== e.altKey) return false;
    let eKey = e.key.toLowerCase();
    if (eKey === " ") eKey = "space";
    return eKey === key;
  }
  function handleKeyboardShortcuts(e) {
    if (e.target && e.target.classList && e.target.classList.contains("shortcut-input")) return;
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
      const saveBtn = document.getElementById("save-request");
      if (saveBtn) saveBtn.click();
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
    loadEnvironments();
    post({ type: "webviewReady", level: "info", text: "DotFetch is ready!" });
  });
  function setupEventListeners() {
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });
    document.querySelectorAll(".response-tab-button").forEach((button) => {
      button.addEventListener("click", () => switchResponseTab(button.dataset.responseTab));
    });
    document.getElementById("send")?.addEventListener("click", sendRequest);
    document.getElementById("save-request")?.addEventListener("click", () => {
      Promise.resolve().then(() => (init_collections(), collections_exports)).then((m) => m.updateSaveCollectionOptions());
      const modal = document.getElementById("save-modal");
      const nameInput = document.getElementById("save-name");
      if (modal) {
        modal.style.display = "block";
        modal.classList.add("modal-visible");
      }
      if (nameInput) {
        nameInput.value = "";
        nameInput.focus();
      }
    });
    document.getElementById("export-curl")?.addEventListener("click", exportToCurl);
    document.getElementById("import-curl")?.addEventListener("click", showCurlImportModal);
    document.getElementById("validate-request")?.addEventListener("click", validateCurrentRequest);
    document.getElementById("add-query-param")?.addEventListener("click", () => {
      state.queryParams.push({ key: "", value: "" });
      renderQueryParams();
    });
    document.getElementById("clear-history")?.addEventListener("click", clearHistory);
    document.getElementById("history-search")?.addEventListener("input", (e) => {
      const clearBtn = document.getElementById("clear-history-search");
      if (clearBtn) {
        clearBtn.style.display = e.target.value ? "block" : "none";
      }
      Promise.resolve().then(() => (init_history(), history_exports)).then((m) => m.renderHistory());
    });
    document.getElementById("clear-history-search")?.addEventListener("click", () => {
      const searchInput = document.getElementById("history-search");
      if (searchInput) {
        searchInput.value = "";
        document.getElementById("clear-history-search").style.display = "none";
        Promise.resolve().then(() => (init_history(), history_exports)).then((m) => m.renderHistory());
      }
    });
    document.getElementById("create-collection")?.addEventListener("click", showCollectionModal);
    document.querySelectorAll(".cancel").forEach((btn) => btn.addEventListener("click", hideModals));
    document.getElementById("confirm-action-btn")?.addEventListener("click", executeConfirmAction);
    document.getElementById("confirm-save")?.addEventListener("click", saveRequest);
    document.getElementById("confirm-create-collection")?.addEventListener("click", createCollection);
    document.getElementById("confirm-import-curl")?.addEventListener("click", executeCurlImport);
    document.getElementById("save-as-template")?.addEventListener("click", saveAsTemplate);
    document.getElementById("confirm-save-template")?.addEventListener("click", confirmSaveAsTemplate);
    document.getElementById("load-template")?.addEventListener("click", loadSelectedTemplate);
    document.getElementById("delete-template")?.addEventListener("click", deleteSelectedTemplate);
    document.getElementById("environment")?.addEventListener("change", onEnvironmentChange);
    document.getElementById("refresh-environments")?.addEventListener("click", loadEnvironments);
    document.getElementById("toggle-variables")?.addEventListener("click", () => post({ type: "toggleEnvironmentTree" }));
    document.getElementById("auth-type")?.addEventListener("change", onAuthTypeChange);
    document.getElementById("auth-username")?.addEventListener("input", updateBasicAuthPreview);
    document.getElementById("auth-password")?.addEventListener("input", updateBasicAuthPreview);
    document.getElementById("auth-token")?.addEventListener("input", updateBearerAuthPreview);
    ["url", "headers", "body"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        if (state.isUpdatingPreview) {
          return;
        }
        clearTimeout(state.previewTimeout);
        state.previewTimeout = setTimeout(() => {
          state.isUpdatingPreview = true;
          updatePreview();
          setTimeout(() => {
            state.isUpdatingPreview = false;
          }, 100);
        }, 300);
      });
    });
    document.addEventListener("keydown", handleKeyboardShortcuts);
    const timeoutInput = document.getElementById("timeout");
    if (timeoutInput && !timeoutInput.dataset.listenerAdded) {
      timeoutInput.addEventListener("change", (e) => {
        const value = parseInt(e.target.value);
        if (value && value > 0 && value <= 3e5) {
          state.settings.timeout = value;
          saveState();
          notify("info", `Timeout updated to ${value}ms`);
        } else {
          notify("error", "Timeout must be between 1-300000ms");
          timeoutInput.value = state.settings.timeout;
        }
      });
      timeoutInput.dataset.listenerAdded = "true";
    }
    setupShortcutsUI();
  }
  function loadEnvironments() {
    post({ type: "getEnvironments" });
    const btn = document.getElementById("refresh-environments");
    if (btn) {
      btn.classList.add("rotating");
      setTimeout(() => btn.classList.remove("rotating"), 1e3);
    }
  }
  function onEnvironmentChange() {
    const environmentSelect = document.getElementById("environment");
    const selectedEnv = environmentSelect ? environmentSelect.value : "none";
    updateEnvironmentIndicator(selectedEnv);
    updateVariableCount(selectedEnv);
    updatePreview();
  }
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "loadState":
        if (message.state) {
          state.history = message.state.history || [];
          state.collections = message.state.collections || {};
          state.settings = message.state.settings || { timeout: 1e4 };
          if (Object.keys(state.collections).length === 0) {
            state.collections["Default"] = [];
          }
          renderHistory();
          renderCollections();
          updateSaveCollectionOptions();
          renderTemplateSelector();
          state.settings = message.state.settings || { timeout: 1e4 };
          if (!state.settings.shortcuts) {
            state.settings.shortcuts = {
              sendRequest: "ctrl+enter",
              saveRequest: "ctrl+s",
              clearForm: "ctrl+k",
              closeModal: "escape"
            };
          }
          const timeoutInput = document.getElementById("timeout");
          if (timeoutInput) {
            timeoutInput.value = state.settings.timeout || 1e4;
          }
          document.querySelectorAll(".shortcut-input").forEach((input) => {
            input.value = state.settings.shortcuts[input.dataset.action] || "";
          });
          loadEnvironments();
        }
        break;
      case "environments":
        state.environments = message.environments || [];
        const environmentSelect = document.getElementById("environment");
        const currentEnv = environmentSelect ? environmentSelect.value : "none";
        if (environmentSelect) {
          environmentSelect.innerHTML = '<option value="none">No Environment</option>';
          state.environments.forEach((env) => {
            const opt = document.createElement("option");
            opt.value = env.name;
            const varCount = Object.keys(env.variables).length;
            opt.textContent = `${env.name} (${varCount} var${varCount !== 1 ? "s" : ""})`;
            environmentSelect.appendChild(opt);
          });
          if (state.environments.some((e) => e.name === currentEnv)) {
            environmentSelect.value = currentEnv;
          }
        }
        onEnvironmentChange();
        break;
      case "response": {
        const sendButton = document.getElementById("send");
        if (sendButton) {
          sendButton.textContent = "Send Request";
          sendButton.disabled = false;
        }
        state.isRequestInProgress = false;
        const statusClass = message.status >= 200 && message.status < 300 ? "status-success" : "status-error";
        let sizeInfo = "";
        let sizeBadge = "";
        if (message.size !== void 0) {
          if (message.size > 5 * 1024 * 1024) {
            sizeInfo = ` \u2022 ${(message.size / (1024 * 1024)).toFixed(2)} MB`;
            sizeBadge = ' <span class="size-warning" title="Large payload (>5MB)">\u26A0\uFE0F Warning</span>';
          } else if (message.size > 1 * 1024 * 1024) {
            sizeInfo = ` \u2022 ${(message.size / (1024 * 1024)).toFixed(2)} MB`;
            sizeBadge = ' <span class="size-info" title="Large payload (>1MB)">\u2139\uFE0F Info</span>';
          } else if (message.size >= 1024) {
            sizeInfo = ` \u2022 ${(message.size / 1024).toFixed(2)} KB`;
          } else {
            sizeInfo = ` \u2022 ${message.size} B`;
          }
        }
        const responseInfo = document.getElementById("response-info");
        if (responseInfo) {
          responseInfo.innerHTML = "";
          const statusSpan = document.createElement("span");
          statusSpan.className = `${statusClass} status-badge-response`;
          statusSpan.textContent = `${message.status} ${message.statusText}`;
          responseInfo.appendChild(statusSpan);
          const durationSpan = document.createElement("span");
          durationSpan.className = "duration-info";
          let durationText = `${message.duration}ms${sizeInfo}`;
          if (message.attempts && message.attempts > 1) {
            durationText += ` \u2022 ${message.attempts} attempts`;
          }
          durationSpan.innerHTML = `${durationText}${sizeBadge}`;
          responseInfo.appendChild(durationSpan);
        }
        const responseBody = document.getElementById("response-body");
        if (responseBody) {
          try {
            if (message.isLarge) {
              responseBody.textContent = message.data;
            } else {
              const jsonBody = JSON.stringify(message.data, null, 2);
              if (jsonBody.length > 5e5) {
                responseBody.textContent = `[Response too large]

${jsonBody.substring(0, 1e3)}...`;
              } else {
                responseBody.innerHTML = syntaxHighlightJson(jsonBody);
              }
            }
          } catch (e) {
            responseBody.textContent = String(message.data);
          }
        }
        const responseHeaders = document.getElementById("response-headers");
        if (responseHeaders) {
          responseHeaders.textContent = message.headers ? JSON.stringify(message.headers, null, 2) : "No headers";
        }
        if (!message.cancelled && state.currentRequest) {
          addToHistory(state.currentRequest, message, message.duration);
        }
        break;
      }
      case "retryAttempt": {
        const sendButton = document.getElementById("send");
        if (sendButton) {
          sendButton.textContent = `Retry ${message.attempt}/${message.total}...`;
        }
        break;
      }
      case "error": {
        const sendButton = document.getElementById("send");
        if (sendButton) {
          sendButton.textContent = "Send Request";
          sendButton.disabled = false;
        }
        state.isRequestInProgress = false;
        const errorInfo = document.getElementById("response-info");
        if (errorInfo) {
          errorInfo.innerHTML = "";
          const span = document.createElement("span");
          span.className = "error-message";
          span.textContent = `\u274C Error: ${message.error}`;
          errorInfo.appendChild(span);
        }
        const errorBody = document.getElementById("response-body");
        if (errorBody) {
          errorBody.innerHTML = "";
          const card = document.createElement("div");
          card.style.padding = "15px";
          card.style.borderLeft = "4px solid var(--error-color)";
          card.style.background = "var(--panel-bg)";
          card.style.borderRadius = "4px";
          card.style.marginBottom = "10px";
          const container = document.createElement("div");
          container.style.display = "flex";
          container.style.justifyContent = "space-between";
          container.style.alignItems = "flex-start";
          const textContainer = document.createElement("div");
          const title = document.createElement("h3");
          title.style.marginTop = "0";
          title.style.color = "var(--error-color)";
          title.textContent = message.error;
          textContainer.appendChild(title);
          if (message.hint) {
            const hintP = document.createElement("p");
            hintP.style.margin = "10px 0";
            hintP.style.color = "var(--text-highlight)";
            hintP.style.fontSize = "13px";
            hintP.innerHTML = "\u{1F4A1} <strong>Hint:</strong> ";
            const hintSpan = document.createElement("span");
            hintSpan.textContent = message.hint;
            hintP.appendChild(hintSpan);
            textContainer.appendChild(hintP);
          }
          const copyBtn = document.createElement("button");
          copyBtn.className = "btn-secondary";
          copyBtn.style.fontSize = "11px";
          copyBtn.style.padding = "4px 8px";
          copyBtn.textContent = "\u{1F4CB} Copy Details";
          copyBtn.addEventListener("click", () => {
            const rawContent = message.rawDetails || message.error;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(rawContent).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = "\u2705 Copied!";
                setTimeout(() => {
                  copyBtn.textContent = originalText;
                }, 2e3);
              }).catch((err) => logger.error("Clipboard error:", err));
            } else {
              const textarea = document.createElement("textarea");
              textarea.value = rawContent;
              document.body.appendChild(textarea);
              textarea.select();
              document.execCommand("copy");
              document.body.removeChild(textarea);
              const originalText = copyBtn.textContent;
              copyBtn.textContent = "\u2705 Copied!";
              setTimeout(() => {
                copyBtn.textContent = originalText;
              }, 2e3);
            }
          });
          container.appendChild(textContainer);
          container.appendChild(copyBtn);
          card.appendChild(container);
          errorBody.appendChild(card);
          if (message.rawDetails) {
            const pre = document.createElement("pre");
            pre.style.marginTop = "15px";
            pre.style.padding = "10px";
            pre.style.background = "var(--vscode-bg)";
            pre.style.border = "1px dashed var(--border-color)";
            pre.style.whiteSpace = "pre-wrap";
            pre.style.fontSize = "11px";
            pre.style.color = "var(--text-muted)";
            pre.textContent = message.rawDetails;
            errorBody.appendChild(pre);
          }
        }
        break;
      }
      case "previewResult":
        showPreview(message.url, message.headers, message.body, message.errors);
        break;
      case "validationResult": {
        const validationContent = document.getElementById("validation-content");
        const validationPanel = document.getElementById("validation-panel");
        if (validationContent && validationPanel) {
          validationContent.innerHTML = "";
          const div = document.createElement("div");
          div.className = message.valid ? "success-message" : "error-message";
          div.textContent = message.valid ? "\u2713 All variables valid" : `\u26A0 ${message.message}`;
          validationContent.appendChild(div);
          validationPanel.classList.remove("preview-hidden");
          validationPanel.classList.add("preview-visible");
          setTimeout(() => {
            validationPanel.classList.add("preview-hidden");
            validationPanel.classList.remove("preview-visible");
          }, 5e3);
        }
        break;
      }
    }
  });
})();
//# sourceMappingURL=script.js.map
