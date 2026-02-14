# Logger Configuration Guide

DotFetch now uses a centralized logging system to keep logs clean and avoid performance overhead for users.

## Overview

The logging system has two parts:
1. **TypeScript Logger** (`src/logger.ts`) - For extension host logs
2. **JavaScript Logger** (`media/logger.js`) - For webview logs

Both loggers use an `isDevelopment` flag to control output:
- **isDevelopment = true** → All logs are output (development mode)
- **isDevelopment = false** → No logs are output (production mode, zero overhead)

## How to Toggle Logger

### During Development (isDevelopment = true)

When working on features, logs are enabled:

```typescript
// src/logger.ts
class Logger {
  private isDevelopment: boolean = true;  // ← Set to true for development
}
```

```javascript
// media/logger.js
class WebViewLogger {
  constructor() {
    this.isDevelopment = true;  // ← Set to true for development
  }
}
```

**Result**: All logs appear in VS Code's output channel and browser console.

### For Production Release (isDevelopment = false)

Before releasing to users, toggle the flag:

```typescript
// src/logger.ts
class Logger {
  private isDevelopment: boolean = false;  // ← Set to false for production
}
```

```javascript
// media/logger.js
class WebViewLogger {
  constructor() {
    this.isDevelopment = false;  // ← Set to false for production
  }
}
```

**Result**: 
- Zero logging overhead
- No noise for users
- Full performance
- Extension behaves identically to users

## Logger API

### TypeScript Logger (src/logger.ts)

```typescript
import { logger } from './logger';

// Log informational message
logger.log('message');
logger.log('message with data', { key: 'value' });

// Log warning
logger.warn('warning message');
logger.warn('warning with data', { key: 'value' });

// Log error
logger.error('error message');
logger.error('error with exception', errorObject);

// Set development mode at runtime
logger.setDevelopment(true);  // Enable logs
logger.setDevelopment(false); // Disable logs

// Check current mode
if (logger.isDev()) {
  // Logs are enabled
}
```

### JavaScript Logger (media/logger.js)

```javascript
// Log informational message
logger.log('message');
logger.log('message with data', { key: 'value' });

// Log warning
logger.warn('warning message');
logger.warn('warning with data', { key: 'value' });

// Log error
logger.error('error message');
logger.error('error with exception', errorObject);

// Set development mode at runtime
logger.setDevelopment(true);  // Enable logs
logger.setDevelopment(false); // Disable logs

// Check current mode
if (logger.isDev()) {
  // Logs are enabled
}
```

## Best Practices

1. **Use logger instead of console.log()**
   ```javascript
   // ❌ Don't do this
   console.log('message');
   
   // ✅ Do this
   logger.log('message');
   ```

2. **Include structured data for better debugging**
   ```typescript
   // ❌ Avoid
   logger.log('Request sent: ' + method + ' ' + url);
   
   // ✅ Better
   logger.log('Request sent:', { method, url });
   ```

3. **Remember to toggle before release**
   ```bash
   # Before releasing to VS Code Marketplace:
   # 1. Change isDevelopment = false in src/logger.ts
   # 2. Change isDevelopment = false in media/logger.js
   # 3. Run: npm run compile
   # 4. Create VSIX: vsce package
   ```

## Migration from Old Console Logs

All old `console.log`, `console.error`, `console.warn` calls have been replaced with `logger.log`, `logger.error`, and `logger.warn`.

### Example Migration

**Before:**
```typescript
// src/extension.ts (OLD)
this.outputChannel.appendLine('[INFO] Webview ready');
this.outputChannel.appendLine('[ERROR] Request error: ' + error.message);
```

**After:**
```typescript
// src/extension.ts (NEW)
logger.log('Webview ready');
logger.error('Request error:', error);
```

**Before:**
```javascript
// media/script.js (OLD)
console.log('[DotFetch] Request sent:', { method, url });
console.error('Clipboard error:', err);
```

**After:**
```javascript
// media/script.js (NEW)
logger.log('Request sent:', { method, url });
logger.error('Clipboard error:', err);
```

## Checking Logs During Development

### Extension Host Logs
1. Open VS Code
2. Click **View → Output**
3. Select **"DotFetch"** from dropdown

### Webview Logs
1. Press **Ctrl+Shift+I** (or **Cmd+Option+I** on Mac) to open DevTools
2. Go to **Console** tab
3. Look for `[DotFetch]` prefixed messages

## Performance Impact

| Mode | Impact | Use Case |
|------|--------|----------|
| `isDevelopment = true` | Minimal overhead (~1-2ms per log) | Development only |
| `isDevelopment = false` | Zero overhead (logs disabled) | Production releases |

When `isDevelopment = false`, the if-check at the start of each method returns immediately with zero logging overhead.

## Troubleshooting

**Q: I'm not seeing logs after setting isDevelopment = true**

A: Make sure to:
1. Change the flag in the source file
2. Run `npm run compile`
3. Reload VS Code window (Ctrl+R)
4. Check Output panel shows "DotFetch"

**Q: Can I toggle logging without recompiling?**

A: Yes! Use the `setDevelopment()` method at runtime:
```typescript
// In extension.ts, you could add a command:
vscode.commands.registerCommand('dotfetch.toggleLogging', () => {
  logger.setDevelopment(!logger.isDev());
});
```

**Q: Will users see any logs in production?**

A: No. When `isDevelopment = false`, all logger methods return immediately before any output, so there's zero chance of logs reaching users.

## Summary

- ✅ Logs disabled by default for production (`isDevelopment = false`)
- ✅ Enable by setting `isDevelopment = true` during development
- ✅ Zero overhead in production
- ✅ Clean, structured logging system
- ✅ Can toggle at runtime with `setDevelopment()`
