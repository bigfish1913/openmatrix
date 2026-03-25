import { StateManager } from './state-manager.js';
export interface TestResult {
    taskId: string;
    testName: string;
    status: 'passed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
    duration: number;
}
export interface FullTestReport {
    runId: string;
    executedAt: string;
    summary: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
        coverage?: number;
    };
    results: TestResult[];
    recommendations: string[];
}
export declare class FullTestRunner {
    private stateManager;
    constructor(stateManager: StateManager);
    /**
     * Run full integration test suite
     */
    runTests(): Promise<FullTestReport>;
    private runTaskTests;
    private runIntegrationTests;
    generateRecommendations(report: FullTestReport): string[];
}
