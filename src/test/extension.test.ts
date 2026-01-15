import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { EnvironmentManager, EnvironmentVariables } from '../environmentManager';

suite('Extension Test Suite', () => {
	let testWorkspacePath: string;
	let environmentManager: EnvironmentManager;
	let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

	suiteSetup(async function(this: Mocha.Context) {
		// Store original workspace folders
		originalWorkspaceFolders = vscode.workspace.workspaceFolders;

		// Create a temporary directory for testing
		testWorkspacePath = path.join(os.tmpdir(), 'dotenv-test-' + Date.now());
		fs.mkdirSync(testWorkspacePath, { recursive: true });

		// Create test .env files
		const envDefaultPath = path.join(testWorkspacePath, '.env');
		const envLocalPath = path.join(testWorkspacePath, '.env.local');
		const envDevPath = path.join(testWorkspacePath, '.env.development');
		const envProdPath = path.join(testWorkspacePath, '.env.production');

		fs.writeFileSync(envDefaultPath, `# Default environment variables (base)
API_BASE_URL=https://api.default.com
API_KEY=default_key_00000
AUTH_TOKEN=Bearer default_token
DATABASE_URL=postgres://default-db:5432/myapp
DEBUG=true
PORT=3000
`);

		fs.writeFileSync(envLocalPath, `# Local environment variables
API_BASE_URL=https://api.localhost.com
API_KEY=local_key_12345
AUTH_TOKEN=Bearer local_token
DATABASE_URL=postgres://localhost:5432/myapp
DEBUG=true
PORT=3000
`);

		fs.writeFileSync(envDevPath, `# Development environment
API_BASE_URL=https://api.dev.example.com
API_KEY=dev_key_67890
AUTH_TOKEN=Bearer dev_token
DATABASE_URL=postgres://dev-db:5432/myapp
DEBUG=true
PORT=3001
TIMEOUT=5000
`);

		fs.writeFileSync(envProdPath, `API_BASE_URL=https://api.production.com
API_KEY=prod_key_secret
AUTH_TOKEN=Bearer prod_token
DATABASE_URL=postgres://prod-db:5432/myapp
DEBUG=false
PORT=80
`);

		// Create invalid .env file to test comments and edge cases
		const envTestPath = path.join(testWorkspacePath, '.env.test');
		fs.writeFileSync(envTestPath, `# Test environment with various edge cases
EMPTY_VAR=
QUOTED_VAR="hello world"
SINGLE_QUOTED_VAR='single quotes'
SPACED_VAR= value with spaces
# COMMENTED_VAR=should_not_appear
VALID_VAR=valid_value
`);

		// Mock vscode.workspace to return our test path
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			get: () => [{
				uri: { fsPath: testWorkspacePath },
				name: 'test-workspace',
				index: 0
			}],
			configurable: true
		});

		environmentManager = new EnvironmentManager();
	});

	suiteTeardown(function() {
		// Restore original workspace folders
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			get: () => originalWorkspaceFolders,
			configurable: true
		});

		// Clean up test directory
		try {
			if (testWorkspacePath && fs.existsSync(testWorkspacePath)) {
				fs.rmSync(testWorkspacePath, { recursive: true, force: true });
			}
		} catch (error) {
			console.warn('Failed to clean up test directory:', error);
		}
	});

	suite('Environment File Detection', () => {
		test('should detect all environment files', () => {
			const environments = environmentManager.getEnvironments();
			assert.strictEqual(environments.length, 5, 'Should detect 5 environment files');

			const envNames = environments.map(env => env.name).sort();
			assert.deepStrictEqual(envNames, ['default', 'development', 'local', 'production', 'test'], 'Should detect all expected environments');
		});

		test('should correctly name environments', () => {
			const defaultEnv = environmentManager.getEnvironmentByName('default');
			const devEnv = environmentManager.getEnvironmentByName('development');
			const prodEnv = environmentManager.getEnvironmentByName('production');
			const testEnv = environmentManager.getEnvironmentByName('test');

			assert.ok(defaultEnv, 'Default environment should exist');
			assert.ok(devEnv, 'Development environment should exist');
			assert.ok(prodEnv, 'Production environment should exist');
			assert.ok(testEnv, 'Test environment should exist');

			// Environment naming follows standard .env conventions
			assert.strictEqual(defaultEnv?.fileName, '.env', 'Default uses base .env file');
			assert.strictEqual(devEnv?.fileName, '.env.development', 'Development should use .env.development');
			assert.strictEqual(prodEnv?.fileName, '.env.production', 'Production should use .env.production');
			assert.strictEqual(testEnv?.fileName, '.env.test', 'Test should use .env.test');
		});

		test('should return undefined for non-existent environment', () => {
			const nonExistent = environmentManager.getEnvironmentByName('nonexistent');
			assert.strictEqual(nonExistent, undefined, 'Should return undefined for non-existent environment');
		});
	});

	suite('Environment Variable Parsing', () => {
		test('should parse basic key=value pairs', () => {
			const localEnv = environmentManager.getEnvironmentByName('local');
			assert.ok(localEnv, 'Local environment should exist');

			assert.strictEqual(localEnv.variables['API_BASE_URL'], 'https://api.localhost.com', 'Should parse API_BASE_URL');
			assert.strictEqual(localEnv.variables['API_KEY'], 'local_key_12345', 'Should parse API_KEY');
			assert.strictEqual(localEnv.variables['DEBUG'], 'true', 'Should parse DEBUG as string');
			assert.strictEqual(localEnv.variables['PORT'], '3000', 'Should parse PORT as string');
		});

		test('should handle comments and empty lines', () => {
			const testEnv = environmentManager.getEnvironmentByName('test');
			assert.ok(testEnv, 'Test environment should exist');

			// Valid variables should be present
			assert.strictEqual(testEnv.variables['VALID_VAR'], 'valid_value', 'Should parse valid variables');

			// Empty variables should be parsed
			assert.strictEqual(testEnv.variables['EMPTY_VAR'], '', 'Should parse empty variables');

			// Commented variables should not appear
			assert.strictEqual(testEnv.variables['COMMENTED_VAR'], undefined, 'Should ignore commented variables');
		});

		test('should handle quoted values', () => {
			const testEnv = environmentManager.getEnvironmentByName('test');
			assert.ok(testEnv, 'Test environment should exist');

			assert.strictEqual(testEnv.variables['QUOTED_VAR'], 'hello world', 'Should remove double quotes');
			assert.strictEqual(testEnv.variables['SINGLE_QUOTED_VAR'], 'single quotes', 'Should remove single quotes');
			assert.strictEqual(testEnv.variables['SPACED_VAR'], 'value with spaces', 'Should trim leading spaces');
		});

		test('should handle different environments separately', () => {
			const localEnv = environmentManager.getEnvironmentByName('local');
			const prodEnv = environmentManager.getEnvironmentByName('production');

			assert.ok(localEnv && prodEnv, 'Both environments should exist');

			// Same keys, different values
			assert.strictEqual(localEnv.variables['API_BASE_URL'], 'https://api.localhost.com', 'Local API URL should be localhost');
			assert.strictEqual(prodEnv.variables['API_BASE_URL'], 'https://api.production.com', 'Production API URL should be production');

			assert.strictEqual(localEnv.variables['PORT'], '3000', 'Local port should be 3000');
			assert.strictEqual(prodEnv.variables['PORT'], '80', 'Production port should be 80');

			assert.strictEqual(localEnv.variables['DEBUG'], 'true', 'Local debug should be true');
			assert.strictEqual(prodEnv.variables['DEBUG'], 'false', 'Production debug should be false');
		});
	});

	suite('Variable Substitution', () => {
		test('should substitute simple variables', () => {
			const result = environmentManager.substituteVariables('{{API_BASE_URL}}/posts', 'local');
			assert.strictEqual(result, 'https://api.localhost.com/posts', 'Should substitute API_BASE_URL');

			const result2 = environmentManager.substituteVariables('{{API_KEY}}', 'production');
			assert.strictEqual(result2, 'prod_key_secret', 'Should substitute API_KEY from production env');
		});

		test('should substitute multiple variables in same text', () => {
			const text = 'URL: {{API_BASE_URL}}/users/{{API_KEY}}/data';
			const result = environmentManager.substituteVariables(text, 'development');
			assert.strictEqual(result, 'URL: https://api.dev.example.com/users/dev_key_67890/data', 'Should substitute multiple variables');
		});

		test('should handle whitespace in variable names', () => {
			const result = environmentManager.substituteVariables('{{ API_BASE_URL }}', 'local');
			assert.strictEqual(result, 'https://api.localhost.com', 'Should handle whitespace around variable names');
		});

		test('should leave unsubstitutable variables unchanged', () => {
			const result = environmentManager.substituteVariables('{{NON_EXISTENT_VAR}}', 'local');
			assert.strictEqual(result, '{{NON_EXISTENT_VAR}}', 'Should leave unknown variables unchanged');

			const result2 = environmentManager.substituteVariables('{{API_BASE_URL}} {{MISSING_VAR}}', 'local');
			assert.strictEqual(result2, 'https://api.localhost.com {{MISSING_VAR}}', 'Should substitute known variables and leave unknown ones');
		});

		test('should work with JSON-like structures', () => {
			const jsonTemplate = '{"baseUrl": "{{API_BASE_URL}}", "key": "{{API_KEY}}", "debug": {{DEBUG}}}';
			const result = environmentManager.substituteVariables(jsonTemplate, 'development');
			const expected = '{"baseUrl": "https://api.dev.example.com", "key": "dev_key_67890", "debug": true}';
			assert.strictEqual(result, expected, 'Should work with JSON structures');
		});

		test('should return text unchanged for non-existent environment', () => {
			const result = environmentManager.substituteVariables('{{API_BASE_URL}}', 'nonexistent');
			assert.strictEqual(result, '{{API_BASE_URL}}', 'Should return unchanged text for non-existent environment');
		});

		test('should handle empty text', () => {
			const result = environmentManager.substituteVariables('', 'local');
			assert.strictEqual(result, '', 'Should handle empty text');

			const result2 = environmentManager.substituteVariables(null as any, 'local');
			assert.ok(result2 === null, 'Should handle null input');
		});
	});

	suite('Variable Validation', () => {
		test('should validate when all variables exist', () => {
			const text = '{{API_BASE_URL}}/{{API_KEY}}';
			const validation = environmentManager.validateVariables(text, 'local');
			assert.strictEqual(validation.valid, true, 'Should be valid when all variables exist');
			assert.deepStrictEqual(validation.missing, [], 'Should have no missing variables');
		});

		test('should detect missing variables', () => {
			const text = '{{API_BASE_URL}}/{{NON_EXISTENT_VAR}}';
			const validation = environmentManager.validateVariables(text, 'local');
			assert.strictEqual(validation.valid, false, 'Should be invalid when variable is missing');
			assert.deepStrictEqual(validation.missing, ['NON_EXISTENT_VAR'], 'Should list missing variables');
		});

		test('should detect multiple missing variables', () => {
			const text = '{{MISSING1}} {{API_BASE_URL}} {{MISSING2}} {{MISSING1}}';
			const validation = environmentManager.validateVariables(text, 'local');
			assert.strictEqual(validation.valid, false, 'Should be invalid when multiple variables are missing');
			assert.deepStrictEqual(validation.missing.sort(), ['MISSING1', 'MISSING2'], 'Should list all unique missing variables');
		});

		test('should handle whitespace in variable names during validation', () => {
			const text = '{{ LOCAL_VAR }} {{ NON_EXISTENT }}';
			const validation = environmentManager.validateVariables(text, 'local');
			assert.strictEqual(validation.valid, false, 'Should handle whitespace in variable names');
			assert.deepStrictEqual(validation.missing.sort(), ['LOCAL_VAR', 'NON_EXISTENT'], 'Should find missing variables with whitespace');
		});

		test('should return valid for text without variables', () => {
			const validation = environmentManager.validateVariables('plain text without variables', 'local');
			assert.strictEqual(validation.valid, true, 'Should be valid for text without variables');
			assert.deepStrictEqual(validation.missing, [], 'Should have no missing variables for plain text');
		});

		test('should return valid for non-existent environment', () => {
			const validation = environmentManager.validateVariables('{{API_BASE_URL}}', 'nonexistent');
			assert.strictEqual(validation.valid, true, 'Should be valid for non-existent environment (graceful handling)');
			assert.deepStrictEqual(validation.missing, [], 'Should have no missing variables for non-existent environment');
		});

		test('should handle empty or invalid input', () => {
			const validation1 = environmentManager.validateVariables('', 'local');
			assert.strictEqual(validation1.valid, true, 'Should be valid for empty text');
			assert.deepStrictEqual(validation1.missing, [], 'Should have no missing variables for empty text');

			const validation2 = environmentManager.validateVariables(null as any, 'local');
			assert.strictEqual(validation2.valid, true, 'Should handle null input gracefully');
			assert.deepStrictEqual(validation2.missing, [], 'Should have no missing variables for null input');
		});
	});

	suite('Complex Integration Tests', () => {
		test('should handle real HTTP request templates', () => {
			const urlTemplate = '{{API_BASE_URL}}/api/v1/users';
			const headersTemplate = 'Authorization: {{AUTH_TOKEN}}\nContent-Type: application/json\nX-API-Key: {{API_KEY}}';
			const bodyTemplate = '{"action": "get_posts", "debug": {{DEBUG}}, "timeout": "{{TIMEOUT}}"}';

			const resultUrl = environmentManager.substituteVariables(urlTemplate, 'local');
			const resultHeaders = environmentManager.substituteVariables(headersTemplate, 'local');
			const resultBody = environmentManager.substituteVariables(bodyTemplate, 'development');

			assert.strictEqual(resultUrl, 'https://api.localhost.com/api/v1/users', 'Should substitute URL variables');

			// Check that headers contain substituted values
			assert.ok(resultHeaders && resultHeaders.includes('Bearer local_token'), 'Should substitute auth token in headers');
			assert.ok(resultHeaders && resultHeaders.includes('local_key_12345'), 'Should substitute API key in headers');

			// Check body substitution with JSON structure
			assert.strictEqual(resultBody, '{"action": "get_posts", "debug": true, "timeout": "5000"}', 'Should substitute variables in JSON');

			// Validate that all variables are present
			const validation = environmentManager.validateVariables(bodyTemplate, 'development');
			assert.strictEqual(validation.valid, true, 'Body template should have all required variables');
		});

		test('environment file edge cases', () => {
			// Test that environments have expected variables
			const localVars = Object.keys(environmentManager.getEnvironmentByName('local')!.variables);
			const prodVars = Object.keys(environmentManager.getEnvironmentByName('production')!.variables);
			const devVars = Object.keys(environmentManager.getEnvironmentByName('development')!.variables);

			assert.ok(localVars.length >= 5, 'Local should have at least 5 variables');
			assert.ok(prodVars.length >= 5, 'Production should have at least 5 variables');
			assert.ok(devVars.length >= 6, 'Development should have TIMEOUT variable');

			assert.ok(localVars.includes('DEBUG'), 'Local should have DEBUG variable');
			assert.ok(prodVars.includes('API_BASE_URL'), 'Production should have required variables');
			assert.ok(!devVars.includes('NON_EXISTENT'), 'Dev should not have non-existent variables');
		});
	});

	// Skip integration tests that require VS Code to run properly
	suite.skip('Integration Tests (require VS Code)', () => {
		test('should handle file watching', () => {
			// This would test the file watching functionality
			// Skipped because it requires VS Code to be running
		});

		test('should handle workspace folder changes', () => {
			// This would test workspace folder changes
			// Skipped because it requires VS Code to be running
		});
	});
});
