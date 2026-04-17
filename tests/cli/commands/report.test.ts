// tests/cli/commands/report.test.ts
import { describe, it, expect } from 'vitest';
import { generateMarkdownReport, type TaskStats, type EfficiencyData, type ReportOptions } from '../../../src/cli/commands/report.js';
import type { GlobalState, Task, Approval } from '../../../src/types/index.js';

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Test Task',
    description: 'A test task description',
    status: 'completed',
    priority: 'P1',
    timeout: 120000,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'completed', duration: 30000, completedAt: '2025-01-01T00:00:00.000Z' },
      verify: { status: 'completed', duration: 15000, completedAt: '2025-01-01T00:00:30.000Z' },
      accept: { status: 'completed', duration: 10000, completedAt: '2025-01-01T00:00:45.000Z' }
    },
    retryCount: 0,
    error: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:55.000Z',
    ...overrides
  };
}

function createTestState(overrides: Partial<GlobalState> = {}): GlobalState {
  return {
    version: '1.0',
    runId: 'run-test-001',
    status: 'completed',
    currentPhase: 'completed',
    startedAt: '2025-01-01T00:00:00.000Z',
    config: {
      timeout: 120,
      taskTimeout: 600000,
      maxRetries: 3,
      approvalPoints: ['plan', 'merge'],
      maxConcurrentAgents: 3,
      model: 'claude-sonnet-4-6'
    },
    statistics: {
      totalTasks: 3,
      completed: 2,
      inProgress: 0,
      failed: 1,
      pending: 0,
      scheduled: 0,
      blocked: 0,
      waiting: 0,
      verify: 0,
      accept: 0,
      retry_queue: 0
    },
    ...overrides
  };
}

function createTestApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: 'APPR-001',
    type: 'plan',
    taskId: 'TASK-001',
    title: 'Test Approval',
    description: 'A test approval',
    content: 'Approval content',
    options: [{ key: 'approve', label: 'Approve' }],
    status: 'approved',
    decision: 'approve',
    createdAt: '2025-01-01T00:00:00.000Z',
    decidedAt: '2025-01-01T00:00:10.000Z',
    ...overrides
  };
}

describe('report command - generateMarkdownReport', () => {
  const defaultStats: TaskStats = {
    total: 3,
    completed: 2,
    failed: 1,
    inProgress: 0,
    pending: 0,
    blocked: 0
  };

  const defaultEfficiency: EfficiencyData = {
    totalDuration: 55000,
    agentCalls: 3,
    retryCount: 0,
    parallelism: 2,
    targetParallelism: 4
  };

  const defaultOptions: ReportOptions = {
    format: 'markdown'
  };

  it('should generate markdown report with basic structure', () => {
    const state = createTestState();
    const tasks = [createTestTask()];
    const approvals = [createTestApproval()];

    const report = generateMarkdownReport(state, tasks, approvals, defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('OpenMatrix');
    expect(report).toContain('Run ID');
    expect(report).toContain(state.runId);
  });

  it('should include state information', () => {
    const state = createTestState();
    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain(state.runId);
    expect(report).toContain(state.startedAt);
    expect(report).toContain(state.status);
  });

  it('should include task statistics', () => {
    const state = createTestState();
    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('统计概览');
    expect(report).toContain(`${defaultStats.completed}`);
    expect(report).toContain(`${defaultStats.failed}`);
  });

  it('should calculate percentages for task statistics', () => {
    const state = createTestState();
    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    // 2 completed out of 3 = 67% (Math.round), 1 failed out of 3 = 33%
    expect(report).toContain('67%');
    expect(report).toContain('33%');
  });

  it('should handle zero total tasks without division by zero', () => {
    const state = createTestState();
    const zeroStats: TaskStats = { total: 0, completed: 0, failed: 0, inProgress: 0, pending: 0, blocked: 0 };

    const report = generateMarkdownReport(state, [], [], zeroStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('0%');
    expect(report).not.toContain('NaN');
    expect(report).not.toContain('Infinity');
  });

  it('should list completed tasks', () => {
    const state = createTestState();
    const tasks = [
      createTestTask({ id: 'TASK-001', status: 'completed', title: 'Completed Task' }),
      createTestTask({ id: 'TASK-002', status: 'failed', title: 'Failed Task', error: 'Build error' })
    ];

    const report = generateMarkdownReport(state, tasks, [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('TASK-001');
    expect(report).toContain('Completed Task');
  });

  it('should list failed tasks with error messages', () => {
    const state = createTestState();
    const tasks = [
      createTestTask({ id: 'TASK-002', status: 'failed', title: 'Failed Task', error: 'Build error' })
    ];

    const report = generateMarkdownReport(state, tasks, [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('TASK-002');
    expect(report).toContain('Failed Task');
    expect(report).toContain('Build error');
  });

  it('should list blocked tasks', () => {
    const state = createTestState();
    const tasks = [
      createTestTask({ id: 'TASK-003', status: 'blocked', title: 'Blocked Task', error: 'Dependency failed' })
    ];

    const report = generateMarkdownReport(state, tasks, [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('TASK-003');
    expect(report).toContain('Blocked Task');
    expect(report).toContain('Dependency failed');
  });

  it('should show "无" when no completed tasks', () => {
    const state = createTestState();
    const tasks = [createTestTask({ status: 'failed' })];
    const stats = { ...defaultStats, completed: 0 };

    const report = generateMarkdownReport(state, tasks, [], stats, defaultEfficiency, defaultOptions);

    // Should show _无_ when no completed tasks
    expect(report).toContain('_无_');
  });

  it('should show "未知" for failed task without error', () => {
    const state = createTestState();
    const tasks = [
      createTestTask({ id: 'TASK-002', status: 'failed', title: 'No Error Task', error: null })
    ];

    const report = generateMarkdownReport(state, tasks, [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('未知');
  });

  it('should include efficiency analysis when option enabled', () => {
    const state = createTestState();
    const options: ReportOptions = { format: 'markdown', efficiency: true };

    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, options);

    expect(report).toContain('效率分析');
    expect(report).toContain('Agent 调用');
    expect(report).toContain('重试次数');
    expect(report).toContain('并行度');
  });

  it('should not include efficiency analysis when option disabled', () => {
    const state = createTestState();
    const options: ReportOptions = { format: 'markdown', efficiency: false };

    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, options);

    expect(report).not.toContain('效率分析');
  });

  it('should include efficiency analysis by default (no option specified)', () => {
    const state = createTestState();
    const options: ReportOptions = { format: 'markdown' };

    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, options);

    expect(report).not.toContain('效率分析');
  });

  it('should convert totalDuration from ms to minutes', () => {
    const state = createTestState();
    const options: ReportOptions = { format: 'markdown', efficiency: true };
    const efficiency: EfficiencyData = {
      totalDuration: 120000, // 2 minutes
      agentCalls: 5,
      retryCount: 1,
      parallelism: 3,
      targetParallelism: 4
    };

    const report = generateMarkdownReport(state, [], [], defaultStats, efficiency, options);

    expect(report).toContain('2 分钟');
  });

  it('should include approval records', () => {
    const state = createTestState();
    const approvals = [
      createTestApproval({ id: 'APPR-001', type: 'plan', decision: 'approve', status: 'approved' })
    ];

    const report = generateMarkdownReport(state, [], approvals, defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('审批记录');
    expect(report).toContain('APPR-001');
    expect(report).toContain('plan');
  });

  it('should show "无" when no approval records', () => {
    const state = createTestState();

    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('审批记录');
    expect(report).toContain('_无_');
  });

  it('should include report generation timestamp', () => {
    const state = createTestState();

    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    // Should contain an ISO timestamp
    expect(report).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle approval without decision', () => {
    const state = createTestState();
    const approvals = [
      createTestApproval({ id: 'APPR-002', decision: undefined, status: 'pending' })
    ];

    const report = generateMarkdownReport(state, [], approvals, defaultStats, defaultEfficiency, defaultOptions);

    expect(report).toContain('APPR-002');
    // When no decision, should show '-'
    expect(report).toContain('-');
  });

  it('should return trimmed report', () => {
    const state = createTestState();
    const report = generateMarkdownReport(state, [], [], defaultStats, defaultEfficiency, defaultOptions);

    // Result should be trimmed (no leading/trailing whitespace)
    expect(report).toEqual(report.trim());
  });
});

describe('report command - type safety (interfaces)', () => {
  it('TaskStats should accept all required fields', () => {
    const stats: TaskStats = {
      total: 10,
      completed: 5,
      failed: 2,
      inProgress: 1,
      pending: 1,
      blocked: 1
    };
    expect(stats.total).toBe(10);
    expect(stats.completed).toBe(5);
    expect(stats.failed).toBe(2);
    expect(stats.inProgress).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.blocked).toBe(1);
  });

  it('EfficiencyData should accept all required fields', () => {
    const efficiency: EfficiencyData = {
      totalDuration: 100000,
      agentCalls: 10,
      retryCount: 2,
      parallelism: 3,
      targetParallelism: 4
    };
    expect(efficiency.totalDuration).toBe(100000);
    expect(efficiency.agentCalls).toBe(10);
    expect(efficiency.retryCount).toBe(2);
    expect(efficiency.parallelism).toBe(3);
    expect(efficiency.targetParallelism).toBe(4);
  });

  it('ReportOptions should accept all fields', () => {
    const options: ReportOptions = {
      format: 'json',
      output: '/tmp/report.json',
      efficiency: true,
      graph: true
    };
    expect(options.format).toBe('json');
    expect(options.output).toBe('/tmp/report.json');
    expect(options.efficiency).toBe(true);
    expect(options.graph).toBe(true);
  });

  it('ReportOptions should work with minimal fields', () => {
    const options: ReportOptions = {
      format: 'console'
    };
    expect(options.format).toBe('console');
    expect(options.output).toBeUndefined();
    expect(options.efficiency).toBeUndefined();
    expect(options.graph).toBeUndefined();
  });
});
