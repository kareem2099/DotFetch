# DotFetch v1.0.0 Manual Testing Guide

## Overview

This guide provides step-by-step instructions for manually testing DotFetch v1.0.0 to ensure all features work correctly before releasing v1.0.1+.

## Prerequisites

1. **DotFetch Extension**: Ensure v1.0.0 is installed and running in VS Code
2. **Test Environment**: The `.env` file should be created with test variables
3. **Test Runner**: The manual test runner is available at `src/test/manual-test-runner.ts`
4. **Test URLs**: Use httpbin.org for testing (returns your request data)

## Quick Start

### Option 1: Use the Interactive Test Runner (Recommended)

1. Open terminal in the DotFetch project directory
2. Run the test runner:
   ```bash
   node -e "
   const { ManualTestRunner } = require('./out/test/manual-test-runner');
   const runner = new ManualTestRunner();
   runner.runAllTests().then(() => {
     const summary = runner.getSummary();
     console.log('📊 Final Summary:', summary);
   });
   "
   ```

3. Follow the prompts in the terminal
4. Answer `y` for passed tests, `n` for failed tests
5. Check the generated report in `test-results/` folder

### Option 2: Manual Testing

Follow the test scenarios in `test-scenarios.md` and verify each feature manually.

## Test Categories

### 1. Core HTTP Methods
- **GET Request**: `https://httpbin.org/get`
- **POST Request**: `https://httpbin.org/post` with JSON body
- **PUT Request**: `https://httpbin.org/put` with JSON body
- **DELETE Request**: `https://httpbin.org/delete`
- **PATCH Request**: `https://httpbin.org/patch` with JSON body

**Expected**: All requests should return status 200 with request details

### 2. Environment Variables
- **URL Substitution**: `{{TEST_URL}}/get` → `https://httpbin.org/get`
- **Header Substitution**: `Authorization: Bearer {{API_KEY}}` → `Authorization: Bearer test12345`
- **Body Substitution**: `{"debug": {{DEBUG}}, "timeout": {{TIMEOUT}}}` → `{"debug": true, "timeout": 5000}`

**Expected**: Variables should resolve correctly before sending

### 3. Headers & Authentication
- **Custom Headers**: Test sending custom headers
- **Multiple Headers**: Test multiple headers in one request

**Expected**: All headers should be sent to server and visible in response

### 4. Error Handling
- **404 Error**: `https://httpbin.org/status/404`
- **Invalid URL**: `htt://invalid-url`
- **Network Issues**: Try with no internet connection

**Expected**: Clear error messages, no hanging

### 5. Collections & History
- **Save Request**: Create and save a request to a collection
- **Load Request**: Load a saved request from collection
- **History**: Send multiple requests and check history
- **New Collection**: Create a new collection

**Expected**: All functionality should work as expected

### 6. cURL Import/Export
- **Export cURL**: Create a request and export to cURL
- **Import cURL**: Import a cURL command and verify fields

**Expected**: cURL functionality should work accurately

### 7. UI/UX
- **Dark Theme**: Verify UI matches VS Code dark theme
- **Loading States**: Check loading indicators during requests
- **Keyboard Navigation**: Test full keyboard accessibility
- **Tab Switching**: Test smooth transitions between tabs

**Expected**: UI should be responsive and accessible

## Test Environment Setup

The `.env` file should contain:
```
TEST_URL=https://httpbin.org
API_KEY=test12345
DEBUG=true
TIMEOUT=5000
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

## Success Criteria

- All core HTTP methods work correctly
- Environment variables substitute properly
- Error handling provides clear feedback
- Collections and history function as expected
- cURL import/export works accurately
- UI is responsive and accessible
- No crashes or unexpected behavior

## Troubleshooting

### Common Issues

1. **Variables not substituting**: Check `.env` file exists and has correct format
2. **Requests failing**: Verify internet connection and test URLs
3. **UI not loading**: Check VS Code extension is properly installed
4. **Test runner not working**: Ensure TypeScript is compiled (`npm run compile`)

### Getting Help

- Check the generated test report for detailed results
- Review the console output for error messages
- Verify all prerequisites are met

## Next Steps

After completing manual testing:

1. **Review Results**: Check the test report for any failures
2. **Fix Issues**: Address any bugs or problems found
3. **Plan v1.0.1+**: Based on test results and user feedback, plan new features
4. **Document**: Update documentation with any changes or improvements

## Test Report Location

Test reports are saved to:
```
test-results/test-report-{timestamp}.md
```

Each report includes:
- Detailed test results for each category
- Pass/fail status for each test
- Overall success rate
- Summary of any issues found