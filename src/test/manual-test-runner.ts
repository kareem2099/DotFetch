import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { logger } from '../logger';

/**
 * Manual Test Runner for DotFetch v1.0.0
 * This script helps automate and document manual testing scenarios
 */

interface TestResult {
    test: string;
    passed: boolean;
    expected: string;
    actual: string;
    error?: string;
    timestamp: string;
}

interface TestSuite {
    name: string;
    tests: TestResult[];
    passed: number;
    total: number;
}

export class ManualTestRunner {
    private results: TestSuite[] = [];
    private outputDir: string;
    private rl: readline.Interface;

    constructor() {
        this.outputDir = path.join(__dirname, '..', '..', 'test-results');
        this.ensureOutputDir();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    private ensureOutputDir(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private askQuestion(query: string): Promise<string> {
        return new Promise(resolve => this.rl.question(query, resolve));
    }

    /**
     * Run all test suites
     */
    public async runAllTests(): Promise<void> {
        logger.log('Starting DotFetch v1.0.0 Manual Test Suite');
        logger.log('For each test, verify in VS Code UI and answer (y/n)');

        // Test suites to run - use arrow functions to prevent immediate execution
        const testSuites = [
            () => this.testCoreHTTPMethods(),
            () => this.testEnvironmentVariables(),
            () => this.testHeadersAndAuth(),
            () => this.testErrorHandling(),
            () => this.testCollectionsAndHistory(),
            () => this.testCurlImportExport(),
            () => this.testUIUX()
        ];

        for (const runSuite of testSuites) {
            const result = await runSuite();
            this.results.push(result);
        }

        this.generateReport();
        logger.log('Test suite completed. Check test-results/ for detailed reports.');
        this.rl.close();
    }

    /**
     * Test Core HTTP Methods
     */
    private async testCoreHTTPMethods(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'Core HTTP Methods',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            { method: 'GET', url: 'https://httpbin.org/get', description: 'GET Request' },
            { method: 'POST', url: 'https://httpbin.org/post', description: 'POST Request' },
            { method: 'PUT', url: 'https://httpbin.org/put', description: 'PUT Request' },
            { method: 'DELETE', url: 'https://httpbin.org/delete', description: 'DELETE Request' },
            { method: 'PATCH', url: 'https://httpbin.org/patch', description: 'PATCH Request' }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: 'Status 200 with request details',
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test Environment Variables
     */
    private async testEnvironmentVariables(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'Environment Variables',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: 'URL Substitution',
                input: '{{TEST_URL}}/get',
                expected: 'https://httpbin.org/get'
            },
            {
                description: 'Header Substitution',
                input: 'Authorization: Bearer {{API_KEY}}',
                expected: 'Authorization: Bearer test12345'
            },
            {
                description: 'Body Substitution',
                input: '{"debug": {{DEBUG}}, "timeout": {{TIMEOUT}}}',
                expected: '{"debug": true, "timeout": 5000}'
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: testCase.expected,
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test Headers and Authentication
     */
    private async testHeadersAndAuth(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'Headers & Authentication',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: 'Custom Headers',
                headers: [
                    'X-DotFetch-Test: Working',
                    'Content-Type: application/json',
                    'Authorization: Bearer token123'
                ]
            },
            {
                description: 'Multiple Headers',
                headers: [
                    'User-Agent: DotFetch/1.0.0',
                    'Accept: application/json',
                    'X-API-Version: v1'
                ]
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: 'All headers sent to server and visible in response',
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test Error Handling
     */
    private async testErrorHandling(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'Error Handling',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: '404 Error',
                url: 'https://httpbin.org/status/404',
                expected: 'Clear error message, status 404'
            },
            {
                description: 'Invalid URL',
                url: 'htt://invalid-url',
                expected: 'Validation error before sending'
            },
            {
                description: 'Network Issues',
                url: 'https://nonexistent-domain-12345.com',
                expected: 'Network error message, not hanging'
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: testCase.expected,
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test Collections and History
     */
    private async testCollectionsAndHistory(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'Collections & History',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: 'Save Request',
                action: 'Create and save request to collection'
            },
            {
                description: 'Load Request',
                action: 'Load saved request from collection'
            },
            {
                description: 'History',
                action: 'Send multiple requests and check history'
            },
            {
                description: 'New Collection',
                action: 'Create new collection'
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: 'Functionality works as expected',
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test cURL Import/Export
     */
    private async testCurlImportExport(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'cURL Import/Export',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: 'Export cURL',
                action: 'Create request and export to cURL'
            },
            {
                description: 'Import cURL',
                curlCommand: 'curl -X POST https://httpbin.org/post -H "Content-Type: application/json" -H "Authorization: Bearer test123" -d \'{"test": "value"}\''
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: 'cURL functionality works accurately',
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Test UI/UX
     */
    private async testUIUX(): Promise<TestSuite> {
        const suite: TestSuite = {
            name: 'UI/UX',
            tests: [],
            passed: 0,
            total: 0
        };

        const testCases = [
            {
                description: 'Dark Theme',
                check: 'UI matches VS Code dark theme'
            },
            {
                description: 'Loading States',
                check: 'Clear loading indicators during requests'
            },
            {
                description: 'Keyboard Navigation',
                check: 'Full keyboard accessibility'
            },
            {
                description: 'Tab Switching',
                check: 'Smooth transitions between tabs'
            }
        ];

        logger.log(`Testing: ${suite.name} ---`);

        for (const testCase of testCases) {
            suite.total++;
            const answer = await this.askQuestion(`👉 Did [${testCase.description}] work? (y/n): `);
            const isSuccess = answer.toLowerCase().trim() === 'y';

            const testResult: TestResult = {
                test: testCase.description,
                passed: isSuccess,
                expected: 'UI is responsive and accessible',
                actual: isSuccess ? 'Verified manually' : 'Failed in manual test',
                timestamp: new Date().toISOString()
            };

            if (!isSuccess) {
                logger.warn(`FAILED`);
            } else {
                logger.log(`PASSED`);
            }

            suite.tests.push(testResult);
        }

        suite.passed = suite.tests.filter(t => t.passed).length;
        return suite;
    }

    /**
     * Generate test report
     */
    private generateReport(): void {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.outputDir, `test-report-${timestamp}.md`);
        
        let report = '# DotFetch v1.0.0 Test Report\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;

        let totalPassed = 0;
        let totalTests = 0;

        for (const suite of this.results) {
            report += `## ${suite.name}\n\n`;
            report += `**Results:** ${suite.passed}/${suite.total} tests passed\n\n`;
            
            totalPassed += suite.passed;
            totalTests += suite.total;

            report += '| Test | Status | Expected | Actual | Error |\n';
            report += '|------|--------|----------|--------|-------|\n';

            for (const test of suite.tests) {
                const status = test.passed ? '✅ PASS' : '❌ FAIL';
                const error = test.error || '';
                report += `| ${test.test} | ${status} | ${test.expected} | ${test.actual} | ${error} |\n`;
            }
            report += '\n';
        }

        report += `## Summary\n\n`;
        report += `**Total:** ${totalPassed}/${totalTests} tests passed\n`;
        report += `**Success Rate:** ${((totalPassed / totalTests) * 100).toFixed(1)}%\n\n`;

        if (totalPassed === totalTests) {
            report += '🎉 All tests passed!\n';
        } else {
            report += '⚠️ Some tests need attention.\n';
        }

        fs.writeFileSync(reportFile, report);
        logger.log(`Test report saved to: ${reportFile}`);
    }

    /**
     * Get test results summary
     */
    public getSummary(): { totalPassed: number; totalTests: number; successRate: number } {
        const totalPassed = this.results.reduce((sum, suite) => sum + suite.passed, 0);
        const totalTests = this.results.reduce((sum, suite) => sum + suite.total, 0);
        const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

        return { totalPassed, totalTests, successRate };
    }
}

// Export for use in other files
export default ManualTestRunner;