# Change Log

All notable changes to the "dotfetch" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.0.0] - 2026-04-19

### 🚀 Package Updates
- [MODIFY] [package.json](file:///home/kareem/StudioProjects/DotFetch/package.json): Update all dependencies and devDependencies to their latest stable versions.

### 🚀 Major UI/UX Overhaul
- **New Modular Architecture**: Split monolithic scripts into maintainable modules (`main.js`, `api.js`, `ui.js`, `curl.js`, `state.js`).
- **Premium Design Refresh**: Enhanced UI with professional glassmorphism, smooth CSS transitions, and VS Code native theme integration.
- **Improved Request Builder**: Replaced raw textareas with structured key-value tables for Parameters and Headers.
- **Micro-animations**: Added pulse effects for request loading and smooth modal transitions.

### ✨ Features & Improvements
- **Auth Persistence**: Full state restoration for Basic, Bearer, and API Key authentication.
- **Enhanced cURL Handling**: Rewritten cURL import/export logic to match the new structured UI.
- **Stabilized State**: Robust handling of first-run scenarios and empty history/collections.
- **Performance**: Optimized rendering logic and reduced bundle size via `esbuild` modularization.

### 🐛 Fixed
- Resolved environment badge desync issues after webview reloads.
- Fixed UUID generation for unsaved requests before favoriting.
- Addressed multiple "undefined" property crashes in the webview.

## [1.2.0] - 2026-03-19

### ✨ Added (New Features & Refinements)

#### Authentication & Authorization
- **Comprehensive Auth Support**: Added specialized UI for Bearer Token, Basic Auth, OAuth 2.0, and API Key authentication methods.
- **OAuth 2.0 Integration**: Added support for major providers (GitHub, Google, Twitter/X, Facebook, Reddit) with popup-based flow and secure token extraction.

#### Advanced Request Management
- **Pre-Request & Post-Response Scripts**: Support for executing sandboxed JavaScript code before a request is sent and after a response is received.
- **Request Templates**: Save frequently used requests as reusable templates that can be loaded with one click.
- **Retry Mechanism**: Added automatic retry for failed networking requests with exponential backoff configurations.
- **Request Annotations**: Add custom notes and comments to saved requests for better documentation.

#### Enhanced Data Flow & UI
- **History Search & Filtering**: Quickly find past requests using URL parameters, methods, and status codes.
- **Collection Export**: Export your entire request collections to portable JSON files for backup and sharing.
- **Response Size Warnings**: Added visual indicators for large payloads (>1MB warning, >5MB limit).
- **Customizable Keyboard Shortcuts**: Map your own keys to common actions (Send, Save, Clear, Close) inside the Settings tab.
- **Native VS Code Theming**: Rebuilt CSS architecture to natively inherit VS Code's active color theme (supports all Dark, Light, and High Contrast themes automatically).
- **Enhanced Error Messages**: Human-readable explanations for common networking errors (ENOTFOUND, ECONNREFUSED, ETIMEDOUT) with copy-to-clipboard functionality.

### 🐛 Fixed / Refactored
- Resolved OAuth flow callbacks for Facebook, Reddit, and Twitter.
- Addressed hashtag logic parsing in various flows.
- Overhauled Webview architecture by breaking monolithic scripts into modular components (`api.js`, `collections.js`, `history.js`, `request.js`, `shortcuts.js`, `ui.js`).

## [1.1.0] - 2026-02-14

### ✨ Added (Critical Bug Fixes & Security)

#### Security Enhancements
- **Content Security Policy (CSP)** with nonce-based script protection and 'unsafe-inline' fallback
- **Stricter URL Validation** with protocol enforcement (http/https only)
- **Safe Variable Substitution** with null/undefined handling and circular reference detection

#### Request Management
- **Request Cancellation** with AbortController for in-flight requests
- **Response Size Limits** (10MB max, 1MB display threshold with truncation)
- **Query Parameter Management** with proper URL encoding and decoding
- **Advanced cURL Export** with smart JSON/string escaping and multiline formatting
- **cURL Import** with comprehensive parsing

#### Environment System Improvements
- **Multiple File Watcher Callbacks** for reactive updates
- **Debounced File Watching** (300ms) to prevent cascading reloads
- **Enhanced .env Parsing**:
  - Support for all `.env*` patterns (`.env.local`, `.env.development`, etc.)
  - Multiline value support with quote handling
  - Escape sequence support (`\\n`, `\\r`, `\\t`, `\\\\`, `\\'`, `\\\"`)
  - Variable name validation with regex enforcement
- **Nested Variable Substitution** (up to 10 iterations with circular reference detection)
- **Helper Methods**: `getAllVariableNames()`, `hasVariable()`, `getVariable()`, `getUniqueVariableNames()`
- **Tree Expansion State** persistence for environments and collections

#### UI/UX Enhancements
- **Keyboard Shortcuts**:
  - Ctrl/Cmd + Enter: Send request
  - Escape: Close modals
  - Ctrl/Cmd + S: Save request
  - Ctrl/Cmd + K: Clear form
- **Collection Management**:
  - Delete collections with confirmation dialog
  - Delete individual requests with instant feedback
  - Collection expansion state preservation
- **Preview Debouncing** with `isUpdatingPreview` flag (prevents excessive updates)
- **Environment Tree Visual Indicators**:
  - Color-coded icons (production=lock/red, dev=beaker/blue, staging=rocket/yellow, test=flask/green)
  - Markdown tooltips showing environment details
  - Empty state messages with helpful hints
  - Long value truncation with character count
- **Settings Tab** with timeout configuration (1-300000ms range validation)
- **Modal Improvements**:
  - Close buttons (×) with proper ARIA labels
  - Modal headers with titles
  - Keyboard navigation support

#### Code Quality & Logging
- **Comprehensive Logging** across extension and webview with [INFO], [WARN], [ERROR] prefixes
- **Improved Error Handling** for:
  - DNS lookup failures (ENOTFOUND)
  - Connection refused (ECONNREFUSED)
  - Request timeouts (ECONNABORTED)
  - Detailed error messages for debugging
- **Proper Type Handling** with safe null/undefined checks throughout codebase
- **Output Channel** for debugging with request/response details

#### Accessibility (WCAG Compliance)
- **ARIA Labels** on all interactive elements
- **ARIA Roles** for dialogs (role="dialog"), tabs (role="tab"), alerts (role="alert")
- **Semantic HTML** with proper form elements (textarea, input, select)
- **Live Regions** for dynamic content updates (aria-live="assertive")
- **Modal Focus Management** with close buttons

#### Form & Input Improvements
- **Textarea Elements** replacing contenteditable for better stability
- **Proper Input Validation** with user feedback
- **Value-based Properties** (`.value` instead of `.textContent`)
- **Spell Check Disabled** for code inputs (spellcheck="false")
- **Placeholder Text** with helpful examples

### 🐛 Fixed
- State loading race condition (webview ready signal before state send)
- Header key validation preventing invalid characters
- Contenteditable data loss and cursor issues
- Response display truncation for very large payloads (500KB+)
- Circular variable reference detection and loop prevention
- File permission error handling (EACCES) in environment parsing
- Unclosed multiline value handling at end of file

### 🎨 Styling Updates
- **Modal Styles**: Headers, footers, close buttons
- **Button Variants**: Primary (blue) and cancel (gray) with hover states
- **Settings UI**: Proper input styling and validation feedback
- **Response Placeholder**: Loading state and empty state styles
- **Section Headers**: Clear visual hierarchy with spacing
- **Textarea/Input Styles**: Proper sizing, focus states, and colors
- **Environment Indicators**: Color-matched to icon themes

### 📚 Documentation
- Comprehensive README for v1.1.0 features
- Detailed CHANGELOG tracking all improvements
- Inline code comments for complex logic
- Accessibility guidelines in code

## [1.0.0] - 2026-01-15

### ✨ Added

#### Core HTTP Client Features
- **Complete HTTP Methods Support**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- **Dynamic URL Builder**: With query parameters management
- **Advanced Headers Management**: Custom headers with validation
- **Flexible Request Body**: JSON, text, and form data support
- **Comprehensive Response Viewer**: Body, Headers, and status codes
- **Configurable Timeout Settings**: Customizable request timeouts
- **Request History**: Automatic saving and loading of previous requests

#### Environment Variables System
- **Multi-Environment Support**: Support for .env, .env.local, .env.development, .env.production, .env.test
- **Variable Substitution**: `{{VARIABLE_NAME}}` syntax with real-time replacement
- **Variable Highlighting**: Live syntax highlighting in input fields
- **Variable Validation**: Pre-send validation for missing variables
- **Environment Tree View**: Dedicated VS Code sidebar for variable management
- **Live Preview**: Show substituted values before sending requests

#### Collections & Organization
- **Request Collections**: Organize requests by project/feature
- **Auto-Create Default Collection**: Automatic setup for first-time users
- **Collection Management**: Full CRUD operations for collections
- **Request Saving**: Save requests with custom names and metadata
- **Quick Load**: One-click loading from collections

#### Import/Export Features
- **cURL Export**: Generate complete cURL commands from requests
- **cURL Import**: Parse and convert cURL commands to requests
- **Smart Parsing**: Automatic extraction of method, URL, headers, and body
- **Clipboard Integration**: Seamless copy/paste operations

#### UI/UX Enhancements
- **Native Dark Theme**: Full VS Code dark theme integration
- **Responsive Design**: Optimized for different screen sizes
- **Method Color Coding**: Visual distinction for HTTP methods
- **Loading States**: Visual feedback during operations
- **Error Handling**: Clear error messages and notifications
- **Keyboard Navigation**: Full keyboard accessibility
- **Context Menus**: Right-click actions and shortcuts

#### VS Code Integration
- **Webview Provider**: Native VS Code webview implementation
- **Secure Message Passing**: Safe communication between webview and extension
- **State Persistence**: Automatic saving of settings, history, and collections
- **Tree View Integration**: Environment variables in sidebar
- **VS Code Commands**: Copy variables, refresh environments
- **Native Notifications**: VS Code notification system instead of browser alerts

### 🐛 Fixed

#### JavaScript Issues
- **Missing Functions**: Added `showPreviewEmpty()` and `hideAllPreviews()`
- **Highlighting Problems**: Fixed HTML injection in textarea/input elements
- **Save Functionality**: Resolved collection selection validation
- **Modal Issues**: Fixed "New Collection" button functionality
- **Blocked Alerts/Prompts**: Replaced with VS Code native notifications
- **cURL Import/Export**: Fixed blocked prompt/alert calls in webviews

### 🔧 Technical Improvements

#### Development & Build
- **TypeScript Compilation**: Robust build process with error checking
- **ESLint Integration**: Code quality and consistency
- **Testing Framework**: Mocha setup for unit and integration tests
- **VS Code Tasks**: Build and development task configuration
- **Package Management**: Optimized npm scripts for development workflow

#### Security & Performance
- **Input Sanitization**: Secure handling of all user inputs
- **Clipboard Security**: Safe clipboard operations
- **Memory Management**: Proper cleanup and resource management
- **Error Boundaries**: Graceful error handling throughout the application
- **Debounced Updates**: Performance optimization for real-time features

#### Accessibility
- **Keyboard Navigation**: Full keyboard accessibility support
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Focus Management**: Proper focus indicators and navigation
- **Color Contrast**: WCAG compliant color schemes
- **RTL Support**: Ready for right-to-left languages

### 📊 Statistics

- **Total Features**: 45+ production-ready features
- **Files Modified**: 8 core files (HTML, CSS, JS, TS)
- **Bug Fixes**: 6 critical JavaScript issues resolved
- **UI Improvements**: Complete dark theme integration
- **Testing Coverage**: Comprehensive test suite setup

### 🎯 Release Notes

DotFetch v1.0.0 is a complete, production-ready HTTP client extension for VS Code. This release includes all planned features for a professional API testing tool, with robust error handling, comprehensive UI, and seamless VS Code integration.

Key highlights:
- Full HTTP client functionality with environment variable support
- Professional dark theme matching VS Code
- Advanced cURL import/export capabilities
- Complete request/response management
- Secure and performant architecture

The extension is now ready for public release and production use.
