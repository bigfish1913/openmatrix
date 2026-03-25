// tests/orchestrator/full-test-runner.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { FullTestRunner } from '../../src/orchestrator/full-test-runner.js';
import { StateManager } from '../../src/storage/state-manager.js';
import type { Task, GlobalState } from '../../src/types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), '.openmatrix-test-fulltest');

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `TASK-${Date.now()}`,
    title: 'Test Task',
    description: 'A test task',
    status: 'completed',
    priority: 'P1',
    timeout: 120000,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
      verify: { status: 'completed', duration: 15, completedAt: new Date().toISOString() },
      accept: { status: 'completed', duration: 10, completedAt: new Date().toISOString() }
    },
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('FullTestRunner', () => {
  let runner: FullTestRunner;
  let stateManager: StateManager;

  beforeEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}

    // 创建测试目录
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(TEST_DIR, 'approvals'), { recursive: true });

    stateManager = new StateManager(TEST_DIR);
    await stateManager.initialize();

    runner = new FullTestRunner(stateManager);
  });

  describe('runFullTest', () => {
    it('should return complete report', async () => {
      // 创建一些完成的任务
      await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const report = await runner.runFullTest();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('runId');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('phases');
      expect(report).toHaveProperty('completionCriteria');
    });

    it('should check environment', async () => {
      const report = await runner.runFullTest();

      expect(report.phases.environment).toHaveProperty('passed');
      expect(report.phases.environment).toHaveProperty('nodeVersion');
      expect(report.phases.environment.nodeVersion).toMatch(/^v\d+/);
    });

    it('should aggregate unit tests', async () => {
      const report = await runner.runFullTest();

      expect(report.phases.unitTests).toHaveProperty('total');
      expect(report.phases.unitTests).toHaveProperty('passedCount');
      expect(report.phases.unitTests).toHaveProperty('coverage');
    });

    it('should run integration tests', async () => {
      const report = await runner.runFullTest();

      expect(report.phases.integration).toHaveProperty('passed');
      expect(report.phases.integration).toHaveProperty('total');
    });

    it('should run regression tests', async () => {
      const report = await runner.runFullTest();

      expect(report.phases.regression).toHaveProperty('passed');
      expect(report.phases.regression).toHaveProperty('checkedTasks');
    });
  });

  describe('checkCompletionCriteria', () => {
    it('should return false when tasks pending', async () => {
      // 创建一个未完成的任务
      await stateManager.createTask({
        title: 'Incomplete Task',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const state = await stateManager.getState();
      const tasks = await stateManager.listTasks();

      const criteria = await runner.checkCompletionCriteria(state, tasks, {
        unitTests: { passed: true, total: 10, passedCount: 10, failedCount: 0, skippedCount: 0, coverage: 85, duration: 1000, testFiles: [], failures: [] },
        integration: { passed: true, total: 5, passedCount: 5, failedCount: 0, duration: 500, failures: [] },
        regression: { passed: true, checkedTasks: 5, issues: [] }
      });

      expect(criteria.allTasksCompleted).toBe(false);
      expect(criteria.isComplete).toBe(false);
    });

    it('should return false when tests failing', async () => {
      const state = await stateManager.getState();
      const tasks: Task[] = [];

      const criteria = await runner.checkCompletionCriteria(state, tasks, {
        unitTests: { passed: false, total: 10, passedCount: 8, failedCount: 2, skippedCount: 0, coverage: 75, duration: 1000, testFiles: [], failures: ['test 1 failed'] },
        integration: { passed: true, total: 5, passedCount: 5, failedCount: 0, duration: 500, failures: [] },
        regression: { passed: true, checkedTasks: 0, issues: [] }
      });

      expect(criteria.fullTestPassed).toBe(false);
      expect(criteria.isComplete).toBe(false);
    });

    it('should return true when all criteria met', async () => {
      const state = await stateManager.getState();
      const tasks: Task[] = [];

      const criteria = await runner.checkCompletionCriteria(state, tasks, {
        unitTests: { passed: true, total: 10, passedCount: 10, failedCount: 0, skippedCount: 0, coverage: 85, duration: 1000, testFiles: [], failures: [] },
        integration: { passed: true, total: 5, passedCount: 5, failedCount: 0, duration: 500, failures: [] },
        regression: { passed: true, checkedTasks: 0, issues: [] }
      });

      expect(criteria.allTasksCompleted).toBe(true);
      expect(criteria.fullTestPassed).toBe(true);
      expect(criteria.noPendingApprovals).toBe(true);
      expect(criteria.isComplete).toBe(true);
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate valid markdown', async () => {
      const report = await runner.runFullTest();
      const markdown = runner.generateMarkdownReport(report);

      expect(markdown).toContain('# Full Test Report');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('## Test Results');
      expect(markdown).toContain('## Completion Criteria');
    });

    it('should include recommendations', async () => {
      // 创建一个未完成的任务
      await stateManager.createTask({
        title: 'Task',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const report = await runner.runFullTest();
      const markdown = runner.generateMarkdownReport(report);

      expect(markdown).toContain('## Recommendations');
    });
  });
});
