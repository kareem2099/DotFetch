# DotFetch v1.0.0 Manual Testing Scenarios

## Test Environment Setup

### 1. Create Test .env File
Create a `.env` file in your workspace root with these variables:
```
TEST_URL=https://httpbin.org
API_KEY=test12345
DEBUG=true
TIMEOUT=5000
AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

### 2. Test URLs (using httpbin.org)
- Base URL: `https://httpbin.org`
- GET endpoint: `https://httpbin.org/get`
- POST endpoint: `https://httpbin.org/post`
- PUT endpoint: `https://httpbin.org/put`
- DELETE endpoint: `https://httpbin.org/delete`
- PATCH endpoint: `https://httpbin.org/patch`
- Error endpoint: `https://httpbin.org/status/404`

## Test Scenarios

### 1. Core HTTP Methods Test
**Purpose**: Verify all HTTP methods work correctly

**Test Cases**:
- [ ] **GET Request**: `https://httpbin.org/get`
  - Expected: Status 200, response contains request details
- [ ] **POST Request**: `https://httpbin.org/post` with JSON body
  - Body: `{"test": "value", "timestamp": "2026-01-15"}`
  - Expected: Status 200, response contains sent data
- [ ] **PUT Request**: `https://httpbin.org/put` with JSON body
  - Body: `{"update": "complete", "version": 1}`
  - Expected: Status 200, response contains sent data
- [ ] **DELETE Request**: `https://httpbin.org/delete`
  - Expected: Status 200, response contains request details
- [ ] **PATCH Request**: `https://httpbin.org/patch` with JSON body
  - Body: `{"partial": "update"}`
  - Expected: Status 200, response contains sent data

### 2. Environment Variables Test
**Purpose**: Verify variable substitution works correctly

**Test Cases**:
- [ ] **URL Substitution**: `{{TEST_URL}}/get`
  - Expected: Should resolve to `https://httpbin.org/get`
- [ ] **Header Substitution**: 
  - Header: `Authorization: Bearer {{API_KEY}}`
  - Expected: Should resolve to `Authorization: Bearer test12345`
- [ ] **Body Substitution**: 
  - Body: `{"debug": {{DEBUG}}, "timeout": {{TIMEOUT}}}`
  - Expected: Should resolve to `{"debug": true, "timeout": 5000}`
- [ ] **Mixed Variables**: 
  - URL: `{{TEST_URL}}/post`
  - Headers: `Authorization: Bearer {{AUTH_TOKEN}}`
  - Body: `{"api_key": "{{API_KEY}}"}`
  - Expected: All variables should resolve correctly

### 3. Headers & Authentication Test
**Purpose**: Verify custom headers are sent correctly

**Test Cases**:
- [ ] **Custom Headers**: 
  - Headers:
    ```
    X-DotFetch-Test: Working
    Content-Type: application/json
    Authorization: Bearer token123
    ```
  - Expected: Response should contain all custom headers
- [ ] **Multiple Headers**: 
  - Headers:
    ```
    User-Agent: DotFetch/1.0.0
    Accept: application/json
    X-API-Version: v1
    ```
  - Expected: All headers should be sent to server

### 4. Request Body Test
**Purpose**: Verify different body types work correctly

**Test Cases**:
- [ ] **JSON Body**: 
  - Body: `{"name": "test", "value": 123}`
  - Expected: Response should contain the JSON data
- [ ] **Text Body**: 
  - Body: `plain text content`
  - Expected: Response should contain the text
- [ ] **Empty Body**: 
  - Body: (empty)
  - Expected: Request should still work for GET/DELETE

### 5. Error Handling Test
**Purpose**: Verify proper error handling and user feedback

**Test Cases**:
- [ ] **404 Error**: `https://httpbin.org/status/404`
  - Expected: Clear error message, status 404
- [ ] **Invalid URL**: `htt://invalid-url`
  - Expected: Validation error before sending
- [ ] **Network Issues**: Try with no internet
  - Expected: Network error message, not hanging
- [ ] **Invalid JSON**: Malformed JSON in body
  - Expected: Clear error message about JSON format

### 6. Collections & History Test
**Purpose**: Verify request organization features

**Test Cases**:
- [ ] **Save Request**: 
  - Create a request and save to collection
  - Expected: Request appears in collections
- [ ] **Load Request**: 
  - Load saved request from collection
  - Expected: All fields populated correctly
- [ ] **History**: 
  - Send multiple requests
  - Expected: Requests appear in history
- [ ] **New Collection**: 
  - Create new collection
  - Expected: Collection appears in list

### 7. cURL Import/Export Test
**Purpose**: Verify cURL functionality

**Test Cases**:
- [ ] **Export cURL**: 
  - Create a request with headers and body
  - Export to cURL
  - Expected: Valid cURL command generated
- [ ] **Import cURL**: 
  - Import this cURL command:
    ```
    curl -X POST https://httpbin.org/post -H "Content-Type: application/json" -H "Authorization: Bearer test123" -d '{"test": "value"}'
    ```
  - Expected: All fields populated correctly

### 8. UI/UX Test
**Purpose**: Verify user interface and experience

**Test Cases**:
- [ ] **Dark Theme**: 
  - Verify UI matches VS Code dark theme
  - Expected: Consistent styling
- [ ] **Loading States**: 
  - Send request and observe loading
  - Expected: Clear loading indicators
- [ ] **Keyboard Navigation**: 
  - Navigate using keyboard
  - Expected: Full keyboard accessibility
- [ ] **Tab Switching**: 
  - Switch between Request, History, Collections, Settings
  - Expected: Smooth transitions

### 9. Environment Variables UI Test
**Purpose**: Verify environment variable management

**Test Cases**:
- [ ] **Environment Selection**: 
  - Switch between environments
  - Expected: Variables update accordingly
- [ ] **Variable Preview**: 
  - Use preview feature for variables
  - Expected: Shows substituted values
- [ ] **Variable Validation**: 
  - Use missing variables
  - Expected: Clear error messages

## Test Execution Notes

1. **Test Order**: Execute tests in order, as some depend on previous tests
2. **Expected Results**: Document actual vs expected results
3. **Bug Reporting**: Note any discrepancies or errors
4. **Performance**: Note any slow operations or UI issues
5. **Edge Cases**: Try unusual inputs or combinations

## Success Criteria

- All core HTTP methods work correctly
- Environment variables substitute properly
- Error handling provides clear feedback
- Collections and history function as expected
- cURL import/export works accurately
- UI is responsive and accessible
- No crashes or unexpected behavior

## Post-Test Actions

1. Document any bugs found
2. Note areas for improvement
3. Identify missing features
4. Plan v1.0.1+ enhancements based on findings