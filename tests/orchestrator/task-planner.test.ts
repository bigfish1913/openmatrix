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
        goalTypes: ['development', 'development', 'development'],
        goalComplexity: ['low', 'medium', 'high'],
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
        goalTypes: [],
        goalComplexity: [],
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
        goalTypes: ['development'],
        goalComplexity: ['medium'],
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
        goalTypes: ['development', 'development', 'development'],
        goalComplexity: ['medium', 'medium', 'medium'],
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
        goalTypes: ['development'],
        goalComplexity: ['medium'],
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
        goalTypes: ['development'],
        goalComplexity: ['medium'],
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
        goalTypes: ['development', 'development'],
        goalComplexity: ['medium', 'medium'],
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
        goalTypes: ['development'],
        goalComplexity: ['medium'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {
        'e2e_tests': 'true',
        'e2e_type': 'web'
      });

      const e2eTask = result.find(t => t.title.includes('端到端'));
      expect(e2eTask).toBeDefined();
      expect(e2eTask!.acceptanceCriteria!.length).toBeGreaterThan(0);
    });
  });

  describe('breakdown with plan', () => {
    it('should include plan text in task descriptions as raw context', () => {
      const parsedTask: ParsedTask = {
        title: 'E-commerce System',
        description: 'Build e-commerce',
        goals: ['实现电商系统'],
        goalTypes: ['development'],
        goalComplexity: ['high'],
        constraints: [],
        deliverables: ['完整系统'],
        rawContent: ''
      };
      const plan = `技术栈
- TypeScript
- Node.js
- PostgreSQL

数据模型
- users 表
- orders 表
- products 表`;

      const result = planner.breakdown(parsedTask, {}, undefined, plan);

      expect(result.length).toBeGreaterThan(2);

      // 验证 plan 原文被包含在任务描述中
      const devTask = result.find(t => t.title.startsWith('实现:'));
      expect(devTask).toBeDefined();
      expect(devTask!.description).toContain('TypeScript');
      expect(devTask!.description).toContain('数据模型');
    });

    it('should create integration task when multiple goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Multi-module System',
        description: 'Build multi-module system',
        goals: ['实现用户管理', '实现订单处理', '实现商品管理'],
        goalTypes: ['development', 'development', 'development'],
        goalComplexity: ['medium', 'medium', 'medium'],
        constraints: [],
        deliverables: ['系统A', '系统B'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {}, undefined, '3个领域模块: 用户, 订单, 商品');

      const integrationTask = result.find(t => t.title.startsWith('系统集成'));
      expect(integrationTask).toBeDefined();
    });

    it('should create code review task', () => {
      const parsedTask: ParsedTask = {
        title: 'Review Test',
        description: 'Test review task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        goalComplexity: ['medium'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {}, undefined, '实现系统');

      const reviewTask = result.find(t => t.title === '代码审查');
      expect(reviewTask).toBeDefined();
      expect(reviewTask?.assignedAgent).toBe('reviewer');
    });

    it('should create E2E test task when enabled', () => {
      const parsedTask: ParsedTask = {
        title: 'E2E Test',
        description: 'Test E2E task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        goalComplexity: ['medium'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {
        'e2e_tests': 'true',
        'e2e_type': 'web'
      }, undefined, '实现系统');

      const e2eTask = result.find(t => t.title.includes('E2E'));
      expect(e2eTask).toBeDefined();
      expect(e2eTask?.priority).toBe('P0');
    });

    it('should create documentation task when level is set', () => {
      const parsedTask: ParsedTask = {
        title: 'Doc Test',
        description: 'Test doc task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        goalComplexity: ['medium'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {
        'documentation_level': '完整文档'
      }, undefined, '实现系统');

      const docTask = result.find(t => t.title === '文档编写');
      expect(docTask).toBeDefined();
    });

    it('should include acceptance criteria for dev tasks', () => {
      const parsedTask: ParsedTask = {
        title: 'Criteria Test',
        description: 'Test acceptance criteria',
        goals: ['实现用户管理'],
        goalTypes: ['development'],
        goalComplexity: ['medium'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {}, undefined, '实现系统');

      const devTasks = result.filter(t => t.title.startsWith('实现:'));
      for (const task of devTasks) {
        expect(task.acceptanceCriteria).toBeDefined();
        expect(task.acceptanceCriteria!.length).toBeGreaterThan(0);
      }
    });

    it('should use goalComplexity from AI annotation', () => {
      const parsedTask: ParsedTask = {
        title: 'Complexity Test',
        description: 'Test complexity',
        goals: ['简单配置', '核心架构', '一般功能'],
        goalTypes: ['development', 'development', 'development'],
        goalComplexity: ['low', 'high', 'medium'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});
      const devTasks = result.filter(t => t.title.startsWith('实现:'));

      expect(devTasks[0].estimatedComplexity).toBe('low');
      expect(devTasks[1].estimatedComplexity).toBe('high');
      expect(devTasks[2].estimatedComplexity).toBe('medium');
    });

    it('should use mixed goal types', () => {
      const parsedTask: ParsedTask = {
        title: 'Mixed Task',
        description: 'Mixed types',
        goals: ['实现用户模块', '编写单元测试', '编写API文档'],
        goalTypes: ['development', 'testing', 'documentation'],
        goalComplexity: ['high', 'medium', 'low'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      const devTasks = result.filter(t => t.assignedAgent === 'coder');
      const testTasks = result.filter(t => t.assignedAgent === 'tester');
      const docTasks = result.filter(t => t.assignedAgent === 'executor');

      expect(devTasks.length).toBe(1);
      expect(testTasks.length).toBeGreaterThanOrEqual(1);
      expect(docTasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
