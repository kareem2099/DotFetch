# DotFetch v2.x Roadmap

This roadmap outlines the planned feature progression for DotFetch from v2.0.0 through v2.4.0. The focus is on delivering real, useful improvements incrementally — no feature is listed unless it can be fully implemented within the VS Code extension model.

---

## ✅ v2.0.0 — Foundation & MVC Refactor *(Current)*

*Focus: clean architecture, stable state, polished UI.*

### Architecture
- **MVC for Webview** — split monolithic `script.js` into `main.js`, `api.js`, `ui.js`, `state.js`.
- **DataManager stabilization** — defensive fallbacks for empty history/collections on first install.
- **UI refresh** — CSS Grid/Flexbox layout, key-value tables for Params and Headers (replaces raw textarea).
- **Standardized messaging protocol** — consistent `postMessage` payloads between `webviewPanel.ts` and frontend.

### Bug Fixes
- Fixed startup crash (`Cannot read properties of undefined (reading 'map')`) for new users.
- Fixed environment badge stuck on "No Environment" after Webview reload.
- Fixed Favorites: unsaved requests now get a UUID before being favorited.

---

## ✅ v2.1.0 — Authentication Upgrade *(Current)*

*Focus: cover the auth flows developers actually use day-to-day.*

- **Bearer Token** — already done in v2.0.0; persist token across requests in the same session.
- **Basic Auth** — already done; add base64 preview so user can verify encoding before sending.
- **API Key auth** — add to header or query param, configurable per-request.
- **OAuth 2.0 Client Credentials** — the simplest OAuth flow (no browser redirect needed): enter `client_id`, `client_secret`, `token_url`; DotFetch fetches and injects the token automatically.
- **SSL toggle** — disable certificate verification for local `https://localhost` development (off by default, warning shown when disabled).

> **Not in scope for v2.1**: Authorization Code flow (requires a browser redirect loop that doesn't fit cleanly in VS Code WebView), AWS Signature v4 (very niche, better handled via a pre-request script in v2.2).

---

## ⚙️ v2.2.0 — Pre/Post Request Scripts

*Focus: programmable control without a full test framework.*

- **Pre-request script tab** — small JS textarea that runs before the request is sent. Useful for: generating timestamps, computing HMAC signatures, setting dynamic headers.
- **`dotfetch` sandbox object** — expose `dotfetch.env.get(key)` and `dotfetch.env.set(key, value)` so scripts can read and write environment variables.
- **Post-response assertions tab** — write simple checks like `assert(res.status === 200)` or `assert(res.body.id !== null)`. Results shown inline as pass/fail badges.
- **Script errors** — shown clearly in the response pane, not silently swallowed.

> **Not in scope for v2.2**: A full Mocha/Chai runner. Assertions are plain JS with a thin `assert()` helper — no test runner dependency.

---

## 📡 v2.3.0 — GraphQL & WebSocket Support

*Focus: protocol expansion for the two most-requested non-REST formats.*

- **GraphQL mode** — when URL ends with `/graphql` or user switches mode manually:
  - Separate fields for Query and Variables (two textareas, not one).
  - Automatically sets `Content-Type: application/json` and wraps payload correctly.
  - Schema introspection via `__schema` query with a "Fetch Schema" button.
- **WebSocket client** — new connection type for `ws://` / `wss://`:
  - Connect / Disconnect buttons.
  - Send a message and see the stream of incoming messages in the response pane.
  - No reconnection logic in this version — manual reconnect only.
- **Form-data body** — add a visual table for `multipart/form-data` (key + value + optional file path from workspace), next to the existing JSON/Text options.

> **Not in scope for v2.3**: gRPC (requires `.proto` file parsing and a different transport layer — a separate extension concern, not a tab).

---

## ☁️ v2.4.0 — Collaboration & Import/Export

*Focus: make it easy to share and reuse work across a team.*

- **OpenAPI / Swagger import** — paste a Swagger JSON/YAML URL or upload a file; DotFetch generates a collection with one request per endpoint.
- **Export collection as JSON** — standard format so collections can be committed to the repo and shared with the team.
- **Import collection from JSON** — load a previously exported collection.
- **GitHub Gist sync** — optional: save/load collections and environments to a private Gist using a personal access token stored in VS Code `SecretStorage`. No custom cloud service.
- **Request chaining (basic)** — after a request completes, allow extracting a value from the response (via a JSONPath expression) and storing it as an environment variable for use in the next request.

> **Not in scope for v2.4**: A standalone DotFetch CLI / NPM package. That's a separate project, not an extension feature.

---

## Out of Scope (for any v2.x release)

| Feature | Reason |
|---|---|
| DotFetch CLI / Newman-style runner | Separate project, out of VS Code extension model |
| Dedicated DotFetch cloud sync service | Infrastructure cost; GitHub Gist covers the need |
| AWS Signature v4 built-in | Addressable via pre-request script in v2.2 |
| gRPC support | Needs `.proto` parser + different transport; extension-within-extension complexity |
| Full OAuth Authorization Code flow | Browser redirect loop conflicts with WebView sandbox |
| Monaco Editor integration | Heavy dependency; the VS Code editor itself is already available for `.http` files |