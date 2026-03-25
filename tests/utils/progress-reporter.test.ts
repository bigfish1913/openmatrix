// tests/utils/progress-reporter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressReporter } from '../../src/utils/progress-reporter.js';
import type { Task } from '../../src/types/index.js';

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
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

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;

  beforeEach(() => {
    reporter = new ProgressReporter({ width: 20, showEta: true, showCount: true });
  });

  describe('renderProgressBar', () => {
    it('should render progress bar with percentage', () => {
      const result = reporter.renderProgressBar(5, 10);

      expect(result).toContain('50%');
      expect(result).toContain('5/10');
      expect(result).toContain('━');
      expect(result).toContain('─');
    });

    it('should render 100% progress', () => {
      const result = reporter.renderProgressBar(10, 10);

      expect(result).toContain('100%');
      expect(result).toContain('10/10');
    });

    it('should render 0% progress', () => {
      const result = reporter.renderProgressBar(0, 10);

      expect(result).toContain('0%');
      expect(result).toContain('0/10');
    });

    it('should handle zero total', () => {
      const result = reporter.renderProgressBar(0, 0);

      expect(result).toContain('0%');
      expect(result).toContain('无任务');
    });

    it('should include label when provided', () => {
      const result = reporter.renderProgressBar(5, 10, 'Building');

      expect(result).toContain('📋 Building');
    });
  });

  describe('getStatusIcon', () => {
    it('should return correct icons for each status', () => {
      expect(reporter.getStatusIcon('pending')).toBe('⏳');
      expect(reporter.getStatusIcon('scheduled')).toBe('📅');
      expect(reporter.getStatusIcon('in_progress')).toBe('🔄');
      expect(reporter.getStatusIcon('blocked')).toBe('🔴');
      expect(reporter.getStatusIcon('waiting')).toBe('⏸️');
      expect(reporter.getStatusIcon('verify')).toBe('🔍');
      expect(reporter.getStatusIcon('accept')).toBe('✅');
      expect(reporter.getStatusIcon('completed')).toBe('✅');
      expect(reporter.getStatusIcon('failed')).toBe('❌');
      expect(reporter.getStatusIcon('retry_queue')).toBe('🔁');
    });

    it('should return question mark for unknown status', () => {
      // @ts-expect-error Testing unknown status
      expect(reporter.getStatusIcon('unknown')).toBe('❓');
    });
  });

  describe('renderDependencyGraph', () => {
    it('should render single task', () => {
      const tasks = [createTestTask()];

      const result = reporter.renderDependencyGraph(tasks);

      expect(result).toContain('Test Task');
      expect(result).toContain('✅'); // completed icon
    });

    it('should render task with dependencies', () => {
      const task1 = createTestTask({ id: 'TASK-001', title: 'Parent Task' });
      const task2 = createTestTask({
        id: 'TASK-002',
        title: 'Child Task',
        dependencies: ['TASK-001']
      });

      const result = reporter.renderDependencyGraph([task1, task2]);

      expect(result).toContain('Parent Task');
      expect(result).toContain('Child Task');
      expect(result).toContain('└─');
    });

    it('should handle empty tasks', () => {
      const result = reporter.renderDependencyGraph([]);

      expect(result).toBe('无任务');
    });

    it('should render multiple levels', () => {
      const task1 = createTestTask({ id: 'TASK-001', title: 'Root Task' });
      const task2 = createTestTask({
        id: 'TASK-002',
        title: 'Mid Task',
        dependencies: ['TASK-001']
      });
      const task3 = createTestTask({
        id: 'TASK-003',
        title: 'Leaf Task',
        dependencies: ['TASK-002']
      });

      const result = reporter.renderDependencyGraph([task1, task2, task3]);

      expect(result).toContain('Root Task');
      expect(result).toContain('Mid Task');
      expect(result).toContain('Leaf Task');
    });
  });

  describe('renderTaskCard', () => {
    it('should render task card with all info', () => {
      const task = createTestTask();

      const result = reporter.renderTaskCard(task);

      expect(result).toContain('TASK-001');
      expect(result).toContain('Test Task');
      expect(result).toContain('P1');
      expect(result).toContain('coder');
      expect(result).toContain('已完成');
    });

    it('should include error when present', () => {
      const task = createTestTask({
        status: 'failed',
        error: 'Build failed'
      });

      const result = reporter.renderTaskCard(task);

      expect(result).toContain('❌');
      expect(result).toContain('Build failed');
    });
  });

  describe('renderStatistics', () => {
    it('should render statistics summary', () => {
      const result = reporter.renderStatistics({
        total: 10,
        completed: 7,
        inProgress: 2,
        pending: 0,
        failed: 1
      });

      expect(result).toContain('📊');
      expect(result).toContain('任务统计');
      expect(result).toContain('完成: 7');
      expect(result).toContain('进行中: 2');
      expect(result).toContain('待处理: 0');
      expect(result).toContain('失败: 1');
      expect(result).toContain('70%');
    });

    it('should handle zero total', () => {
      const result = reporter.renderStatistics({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        failed: 0
      });

      expect(result).toContain('0%');
    });
  });

  describe('renderFailureSuggestion', () => {
    it('should render failure suggestions', () => {
      const task = createTestTask({
        status: 'failed',
        error: 'Timeout exceeded',
        timeout: 120000
      });

      const result = reporter.renderFailureSuggestion(task);

      expect(result).toContain('❌');
      expect(result).toContain('执行失败');
      expect(result).toContain('Timeout exceeded');
      expect(result).toContain('增加超时时间');
      expect(result).toContain('120s');
    });
  });

  describe('renderEfficiencyAnalysis', () => {
    it('should render efficiency analysis', () => {
      const result = reporter.renderEfficiencyAnalysis({
        totalDuration: 3660000, // 1h 1m
        agentCalls: 10,
        retryCount: 2,
        parallelism: 3.5,
        targetParallelism: 4
      });

      expect(result).toContain('🏆');
      expect(result).toContain('效率分析');
      expect(result).toContain('1h 1m');
      expect(result).toContain('10 次');
      expect(result).toContain('2 次');
      expect(result).toContain('3.5 / 4');
    });

    it('should show optimization suggestion when parallelism low', () => {
      const result = reporter.renderEfficiencyAnalysis({
        totalDuration: 3600000,
        agentCalls: 10,
        retryCount: 0,
        parallelism: 2,
        targetParallelism: 4
      });

      expect(result).toContain('💡');
      expect(result).toContain('增加并发数');
    });

    it('should not show suggestion when parallelism high', () => {
      const result = reporter.renderEfficiencyAnalysis({
        totalDuration: 3600000,
        agentCalls: 10,
        retryCount: 0,
        parallelism: 3.8,
        targetParallelism: 4
      });

      expect(result).not.toContain('💡');
    });
  });

  describe('renderFullReport', () => {
    it('should render complete report', () => {
      const tasks = [
        createTestTask({ id: 'TASK-001' }),
        createTestTask({ id: 'TASK-002', status: 'failed', error: 'Error' })
      ];

      const result = reporter.renderFullReport({
        tasks,
        statistics: {
          total: 2,
          completed: 1,
          inProgress: 0,
          pending: 0,
          failed: 1
        },
        efficiency: {
          totalDuration: 300000,
          agentCalls: 5,
          retryCount: 1,
          parallelism: 2,
          targetParallelism: 4
        }
      });

      expect(result).toContain('📋');
      expect(result).toContain('执行报告');
      expect(result).toContain('任务统计');
      expect(result).toContain('任务依赖图');
      expect(result).toContain('效率分析');
      expect(result).toContain('失败任务');
    });

    it('should not include failed section when no failures', () => {
      const tasks = [createTestTask()];

      const result = reporter.renderFullReport({
        tasks,
        statistics: {
          total: 1,
          completed: 1,
          inProgress: 0,
          pending: 0,
          failed: 0
        },
        efficiency: {
          totalDuration: 300000,
          agentCalls: 5,
          retryCount: 0,
          parallelism: 4,
          targetParallelism: 4
        }
      });

      expect(result).not.toContain('❌ 失败任务');
    });
  });
});
