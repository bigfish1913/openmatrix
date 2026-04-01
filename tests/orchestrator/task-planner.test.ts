// tests/orchestrator/task-planner.test.ts
import { describe, it, expect } from 'vitest';
import { TaskPlanner } from '../../src/orchestrator/task-planner.js';
import type { ParsedTask, QualityConfig } from '../../src/types/index.js';

describe('TaskPlanner', () => {
  const planner = new TaskPlanner();

  describe('breakdown', () => {
    it('should break down task with multiple goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        description: 'A test task',
        goals: ['Goal 1', 'Goal 2', 'Goal 3'],
        constraints: ['Constraint 1'],
        deliverables: ['Deliverable 1'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      // Should have: 1 design + 3 dev + 3 test + 1 review = 8
      expect(result.length).toBeGreaterThanOrEqual(7);
      expect(result[0].title).toBeDefined();
      expect(result[0].priority).toBeDefined();
      expect(result[0].assignedAgent).toBeDefined();
    });

    it('should handle empty goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Empty Task',
        description: '',
        goals: [],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});
      expect(result).toHaveLength(0);
    });

    it('should break down single goal task', () => {
      const parsedTask: ParsedTask = {
        title: '实现用户登录系统',
        description: '实现完整的用户登录系统',
        goals: ['实现基于JWT的用户登录认证'],
        constraints: [],
        deliverables: ['src/auth/login.ts'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      // Should have at least: 1 dev + 1 test = 2 (design if complex)
      expect(result.length).toBeGreaterThanOrEqual(2);

      const devTasks = result.filter(t => t.assignedAgent === 'coder');
      const testTasks = result.filter(t => t.assignedAgent === 'tester');
      expect(devTasks.length).toBe(1);
      expect(testTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should create parallel dev tasks (not serial dependencies)', () => {
      const parsedTask: ParsedTask = {
        title: '多模块任务',
        description: '',
        goals: ['模块A', '模块B', '模块C'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      const devTasks = result.filter(t => t.assignedAgent === 'coder' && !t.title.startsWith('系统集成'));

      // All dev tasks should only depend on design task (or nothing), not on each other
      for (const devTask of devTasks) {
        const hasDevDependency = devTask.dependencies.some(dep =>
          devTasks.some(other => other.taskId === dep)
        );
        expect(hasDevDependency).toBe(false);
      }
    });

    it('should pass quality config to test coverage', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        description: '',
        goals: ['实现功能A'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const strictConfig: QualityConfig = {
        tdd: true,
        minCoverage: 80,
        strictLint: true,
        securityScan: true,
        e2eTests: false,
        level: 'strict'
      };

      const result = planner.breakdown(parsedTask, {}, strictConfig);

      const testTask = result.find(t => t.assignedAgent === 'tester');
      expect(testTask).toBeDefined();
      expect(testTask!.description).toContain('80%');
    });

    it('should use 60% coverage for balanced config', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        description: '',
        goals: ['实现功能A'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const balancedConfig: QualityConfig = {
        tdd: false,
        minCoverage: 60,
        strictLint: true,
        securityScan: true,
        e2eTests: false,
        level: 'balanced'
      };

      const result = planner.breakdown(parsedTask, {}, balancedConfig);

      const testTask = result.find(t => t.assignedAgent === 'tester');
      expect(testTask).toBeDefined();
      expect(testTask!.description).toContain('60%');
    });

    it('should create code review task depending on all dev tasks', () => {
      const parsedTask: ParsedTask = {
        title: 'Multi Task',
        description: '',
        goals: ['Goal 1', 'Goal 2'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      const reviewTask = result.find(t => t.assignedAgent === 'reviewer');
      expect(reviewTask).toBeDefined();

      const devTasks = result.filter(t => t.assignedAgent === 'coder');
      const devTaskIds = devTasks.map(t => t.taskId);

      // Review should depend on all dev tasks
      for (const devId of devTaskIds) {
        expect(reviewTask!.dependencies).toContain(devId);
      }
    });

    it('should create E2E test task when enabled', () => {
      const parsedTask: ParsedTask = {
        title: 'Web App',
        description: '',
        goals: ['实现首页'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {
        'E2E测试': 'true',
        'E2E类型': 'web'
      });

      const e2eTask = result.find(t => t.title.includes('端到端'));
      expect(e2eTask).toBeDefined();
      expect(e2eTask!.acceptanceCriteria!.length).toBeGreaterThan(0);
    });
  });
});
