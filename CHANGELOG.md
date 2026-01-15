# Change Log

All notable changes to the "dotfetch" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
