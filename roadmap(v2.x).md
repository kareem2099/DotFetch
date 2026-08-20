# 🚀 DotFetch v2.x Roadmap

This roadmap outlines the planned feature progression for DotFetch from **v2.0.0** through **v2.4.0**. The focus is on delivering high-performance, developer-first improvements incrementally while maintaining strict architectural boundaries and rock-solid stability.

---

## 📅 Version Milestones Overview

```text
v2.0.0  Foundation & Modular MVC               ✅ Shipped
v2.1.0  Authentication & Security Upgrade      ✅ Shipped & Tagged
v2.1.1  UI & UX Polish Pass (Engine Frozen)   🎯 Current Focus
v2.2.0  Pre/Post Request Scripts & Assertions ⏳ Next
v2.3.0  GraphQL & WebSocket Protocol Expansion ⏳ Planned
v2.4.0  Collaboration & OpenAPI Import/Export  ⏳ Planned
```

---

## ✅ v2.0.0 — Foundation & Modular MVC *(Released)*

*Focus: Clean architecture, stable state, and responsive UI.*

### Delivered:
* **MVC-Inspired Modular Architecture** — Decoupled frontend into `main.js`, `request.js`, `auth.js`, `ui.js`, `curl.js`, `shortcuts.js`, `state.js`, and `api.js`.
* **Sub-50ms esbuild Bundling** — Single IIFE bundle (`media/script.js`) adhering strictly to VS Code Webview CSP nonce rules.
* **Key-Value Tables** — Replaced raw textareas with structured tables for Query Parameters and Headers.
* **DataManager Stabilization** — Defensive fallbacks for empty history/collections on initial launch.
* **Native VS Code Theme Integration** — Dark theme optimization matching VS Code design tokens.

---

## ✅ v2.1.0 — Authentication & Security Upgrade *(Released & Tagged)*

*Focus: Cover all real-world authentication methods with zero-leak credential privacy and runtime hardening.*

### Delivered:
* **API Key Authentication** — Configurable in `Header` (`X-API-Key`) or `Query Parameter` (`?api_key=...`) with live preview and quick copy.
* **OAuth 2.0 Client Credentials** — 1-click **"⚡ Fetch & Inject Token"** retrieving access tokens via RFC 6749 §2.3.1 compliant URL-encoding, with active token card and expiry validation.
* **Bearer Token & Basic Auth** — Server-side variable substitution for `{{USER}}` and `{{PASS}}` before Base64 encoding.
* **SSL/TLS Verification Toggle** — Configurable setting (`dotfetch.sslVerify`) and UI toggle with warning badge (`⚠️ SSL Ignored`) for localhost and self-signed certificates.
* **Interactive Secret Visibility** — Show/Hide eye buttons (👁️ / 🙈) on all password, token, and secret fields.
* **Response Headers Inspector** — Dedicated key-value headers table alongside the formatted JSON body viewer.
* **Zero-Persistence Plaintext Secrets** — Collections, Favorites, and Request History strictly store configuration schema while omitting plaintext secrets and ephemeral tokens from `globalState`.
* **Response Size & Memory Guard** — 10 MB network limits (`maxContentLength` & `maxBodyLength`) with truncated 1000-character previews for oversized responses (> 1 MB).
* **Runtime Verified** — Manually tested and verified across 25 real-world scenarios.

---

## 🎯 v2.1.1 — UI & UX Polish Pass *(Current Focus)*

*Focus: Make DotFetch feel fast, deliberate, keyboard-friendly, and visually superior to standalone clients — without touching the stable request engine.*

### 🔒 Architectural Ground Rule: Engine Freeze
During the v2.1.1 Polish Pass, the underlying request and transport engine is strictly frozen:
* `RequestService.ts` 🔒 **Freeze**
* Auth execution & RFC logic 🔒 **Freeze**
* Credential persistence boundaries 🔒 **Freeze**
* Network retry, timeout & SSL transport 🔒 **Freeze**

All polish work is strictly localized to:
* `src/webview/ui.js`, `src/webview/shortcuts.js`, `src/webview/main.js`
* `media/styles.css`, `media/index.html`
* Sidebar Tree Item formatters & VS Code Commands

---

### 🎨 Implementation Phases for v2.1.1

#### 🔹 P1 — Request Builder & Row Ergonomics
* **Send Button States** — Distinct states for *Idle* (`Send`), *Loading/In-Flight* (`Cancel ✕` with spinner), *Retrying* (`Retry 1/2`), and immediate revert on cancel.
* **HTTP Method Visual Tags** — Subtle, professional color differentiation for `GET` (green), `POST` (blue/purple), `PUT` (orange), `PATCH` (yellow), `DELETE` (red).
* **Smart Tab Content Badges**:
  * `Params (2)` / `Headers (3)` — Numeric active counts.
  * `Auth ●` / `Body ●` — Subtle dot indicator when content or auth is configured.
* **Row-Level Active Checkboxes (`☑ / ☐`)** — Enable/disable individual Header or Query Parameter rows without deleting them.

#### 🔹 P2 — Response Viewer & Inspector
* **Pretty / Raw JSON Toggle** — Instant switching between formatted JSON and compact raw text.
* **Enhanced Status Hierarchy** — Prominent status badge (`200 OK`, `401 Unauthorized`), time (`42 ms`), and payload size (`1.2 KB`) with clear visual hierarchy.
* **One-Click Actions** — Improved copy feedback with distinct tooltip and clipboard state.

#### 🔹 P3 — Sidebar Ergonomics & Empty States
* **Clean History Row Formatting** — Display scan-friendly rows (`GET  /users  200  42ms`) with full URL on hover tooltip.
* **Clear History Action** — Toolbar button to clear history with quick confirmation.
* **Contextual Collection Actions** — Right-click menu for `Rename`, `Duplicate Request`, `Add to Favorites`, and `Delete`.
* **Polished Empty States** — Concise, helpful empty states for Favorites, Collections, History, and Response pane.

#### 🔹 P4 — Auth & Environment Presentation
* **Masked Auth Previews** — Masked preview for active secrets (e.g. `Authorization: Bearer dotf••••••••cret`) while copy action copies the true value.
* **Humanized OAuth Expiry** — Display natural expiration times (e.g. `Expires in: 58m` instead of raw seconds).
* **Environment Indicator Hover** — Tooltip displaying active environment name and variable count.
* **Missing Environment Hint** — Non-intrusive warning when `{{VARIABLES}}` are present in a request while `No Environment` is active.

#### 🔹 P5 — Keyboard-First Workflow & Command Palette
* **`Ctrl+L` / `Cmd+L` Focus Shortcut** — Instantly focus the URL input bar from anywhere in the editor.
* **Keyboard Shortcuts Overlay (`Ctrl+/` or `?`)** — Clean modal displaying all active keybindings.
* **Command Palette Integration** — Register core commands:
  * `DotFetch: New Request`
  * `DotFetch: Focus URL`
  * `DotFetch: Send Request`
  * `DotFetch: Clear Form`
  * `DotFetch: Clear History`
  * `DotFetch: Select Environment`

#### 🔹 P6 — Micro-Interactions & Toast System
* **Consistent Toast Notifications** — Structured toast alerts with tiered auto-dismiss timers:
  * *Info / Success*: 2.5s
  * *Warning*: 4.0s
  * *Error*: 5.0s
* **Fluid CSS Micro-Animations** — Smooth tab switches, subtle hover elevations, and clean modal entrances.

---

## ⚙️ v2.2.0 — Pre/Post Request Scripts & Assertions

*Focus: Programmable request control, dynamic payloads, and inline test assertions.*

* **Pre-Request Script Tab** — Embedded editor running lightweight JavaScript prior to request transmission. Useful for:
  * Dynamic timestamp generation (`Date.now()`).
  * HMAC / cryptographic signature calculation.
  * Setting dynamic request headers.
* **`dotfetch` Sandbox API** — Safe sandbox exposing:
  * `dotfetch.env.get(key)` / `dotfetch.env.set(key, value)` for reading/writing environment variables.
  * `dotfetch.request` for inspecting/mutating outgoing request data.
* **Post-Response Assertions Tab** — Write concise assertions:
  * `assert(res.status === 200, "Status must be 200")`
  * `assert(res.body.id !== null, "ID must exist")`
* **Test Results Badges** — Pass/Fail visual badges and summary inline in the Response pane.
* **Script Error Tracing** — Clear error reporting in the response pane without crashing the extension host.

---

## 📡 v2.3.0 — GraphQL & WebSocket Protocol Expansion

*Focus: Non-REST protocol support directly inside VS Code.*

* **GraphQL Client Mode**:
  * Dedicated split textareas for **Query** and **Variables**.
  * Automatic `Content-Type: application/json` wrapping.
  * Schema introspection via `__schema` query with a 1-click "Fetch Schema" action.
* **WebSocket Client**:
  * Dedicated connection management for `ws://` and `wss://`.
  * Live streaming log of incoming and outgoing WebSocket frames.
  * Send custom JSON / text payloads interactively.
* **Multipart Form-Data Builder** — Visual table for `multipart/form-data` supporting text fields and file attachments from the workspace.

---

## ☁️ v2.4.0 — Collaboration & OpenAPI Integration

*Focus: Seamless teamwork and API specification portability.*

* **OpenAPI / Swagger Import & Export**:
  * Import OpenAPI 3.0 / Swagger 2.0 specifications (URL or local JSON/YAML file).
  * Auto-generate organized DotFetch collections with pre-configured endpoints and parameters.
* **Portable Collection JSON Format** — Version-controlled JSON files that can be committed to Git repositories and shared across teams.
* **GitHub Gist Sync** — Optional two-way sync for collections and environments using GitHub Personal Access Tokens stored securely in VS Code `SecretStorage`.
* **Response Chaining (JSONPath)** — Extract response values (e.g. `$.token` or `$.data.id`) and automatically assign them to environment variables for sequential request workflows.

---

## 🚫 Out of Scope (Explicitly Excluded from v2.x)

| Feature | Rationale |
| :--- | :--- |
| **DotFetch CLI / Standalone Runner** | Separate architectural concern; out of scope for the in-editor extension model. |
| **Custom Cloud Backend Service** | High infrastructure cost and privacy liability; GitHub Gist sync covers team sharing without third-party servers. |
| **AWS Signature v4 Native UI** | Niche protocol requirement; handled cleanly via Pre-Request Scripts in v2.2.0. |
| **Full OAuth 2.0 Authorization Code Flow** | Browser redirect loops conflict with sandboxed WebView security. |
| **Monaco Editor Heavy Dependency** | Heavy bundle overhead; native VS Code textarea and syntax highlighting provide optimal performance. |