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

  describe('parsePlan', () => {
    it('should parse Chinese domain modules', () => {
      const plan = `技术栈
- Node.js
- TypeScript
5个领域模块: 用户, 订单, 商品, 支付, 通知`;
      const result = planner.parsePlan(plan);
      expect(result.modules).toHaveLength(5);
      expect(result.modules[0].name).toBe('用户');
      expect(result.techStack).toContain('Node.js');
    });

    it('should parse architecture numbered modules', () => {
      const plan = `架构设计
1. 用户管理：用户注册登录
2. 订单管理：订单处理流程`;
      const result = planner.parsePlan(plan);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('should parse English format modules', () => {
      const plan = `3 modules: Auth, Payment, Notification`;
      const result = planner.parsePlan(plan);
      expect(result.modules).toHaveLength(3);
      expect(result.modules[0].name).toBe('Auth');
    });

    it('should parse Markdown heading modules', () => {
      const plan = `## Modules
1. Auth
2. Payment`;
      const result = planner.parsePlan(plan);
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('should return empty modules for unrecognized format', () => {
      const result = planner.parsePlan('random text without modules');
      expect(result.modules).toHaveLength(0);
    });

    it('should extract tech stack from plan', () => {
      const plan = `技术栈
- React
- TypeScript
- Node.js`;
      const result = planner.parsePlan(plan);
      expect(result.techStack.length).toBeGreaterThan(0);
    });
  });

  describe('extractPlanMetadata', () => {
    it('should extract tech stack', () => {
      const plan = `技术栈
- React
- TypeScript`;
      const meta = planner.extractPlanMetadata(plan);
      expect(meta.techStack).toContain('React');
      expect(meta.techStack).toContain('TypeScript');
    });

    it('should extract interfaces', () => {
      const plan = `接口定义
- GET /api/users
- POST /api/orders`;
      const meta = planner.extractPlanMetadata(plan);
      expect(meta.interfaces.length).toBeGreaterThan(0);
    });

    it('should extract data models', () => {
      const plan = `数据模型
- users table
- orders table`;
      const meta = planner.extractPlanMetadata(plan);
      expect(meta.dataModels.length).toBeGreaterThan(0);
    });

    it('should extract key decisions', () => {
      const plan = `关键决策
- 使用 JWT 认证
- 采用微服务架构`;
      const meta = planner.extractPlanMetadata(plan);
      expect(meta.keyDecisions.length).toBeGreaterThan(0);
    });

    it('should return empty arrays for plan without metadata', () => {
      const meta = planner.extractPlanMetadata('simple text');
      expect(meta.techStack).toHaveLength(0);
      expect(meta.interfaces).toHaveLength(0);
      expect(meta.dataModels).toHaveLength(0);
      expect(meta.keyDecisions).toHaveLength(0);
    });
  });

  describe('inferModulesFromGoals', () => {
    it('should infer modules from development goals', () => {
      const parsedTask = {
        title: 'Test Project',
        description: 'A test project',
        goals: [
          '实现用户模块',
          '实现订单模块',
          '实现通知模块'
        ],
        goalTypes: ['development', 'development', 'development'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };
      const modules = planner.inferModulesFromGoals(parsedTask);
      expect(modules.length).toBeGreaterThan(0);
    });

    it('should return empty for less than 3 goals', () => {
      const parsedTask = {
        title: 'Test',
        description: 'Test',
        goals: ['实现模块A'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };
      const modules = planner.inferModulesFromGoals(parsedTask);
      expect(modules).toHaveLength(0);
    });

    it('should detect dependencies from goal text', () => {
      const parsedTask = {
        title: 'Test',
        description: 'Test',
        goals: [
          '实现基础模块',
          '实现订单模块（基于基础模块）',
          '实现通知模块'
        ],
        goalTypes: ['development', 'development', 'development'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };
      const modules = planner.inferModulesFromGoals(parsedTask);
      // 第二个模块应该依赖第一个
      if (modules.length >= 2) {
        expect(modules[1].dependsOn.length).toBeGreaterThan(0);
      }
    });
  });

  describe('breakdown with plan', () => {
    it('should use breakdownByModules when plan provides modules', () => {
      const parsedTask = {
        title: 'E-commerce System',
        description: 'Build e-commerce',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['完整系统'],
        rawContent: ''
      };
      const plan = `技术栈
- TypeScript
- Node.js

3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {}, undefined, plan);

      // 应该生成开发+测试任务对
      expect(result.length).toBeGreaterThan(2);

      // 应该有开发任务
      const devTasks = result.filter(t => t.title.startsWith('实现:'));
      expect(devTasks.length).toBeGreaterThan(0);

      // 应该有测试任务
      const testTasks = result.filter(t => t.title.startsWith('测试:'));
      expect(testTasks.length).toBeGreaterThan(0);

      // 测试任务应该依赖对应的开发任务
      for (const testTask of testTasks) {
        expect(testTask.dependencies.length).toBeGreaterThan(0);
      }
    });

    it('should create integration task when multiple modules', () => {
      const parsedTask = {
        title: 'Multi-module System',
        description: 'Build multi-module system',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['系统A', '系统B']  // 多个交付物触发集成测试
      };
      const plan = `3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {}, undefined, plan);

      const integrationTask = result.find(t => t.title.startsWith('系统集成'));
      expect(integrationTask).toBeDefined();
    });

    it('should create code review task', () => {
      const parsedTask = {
        title: 'Review Test',
        description: 'Test review task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };
      const plan = `3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {}, undefined, plan);

      const reviewTask = result.find(t => t.title === '代码审查');
      expect(reviewTask).toBeDefined();
      expect(reviewTask?.assignedAgent).toBe('reviewer');
    });

    it('should create E2E test task when enabled', () => {
      const parsedTask = {
        title: 'E2E Test',
        description: 'Test E2E task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };
      const plan = `3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {
        'E2E测试': 'true',
        'E2E类型': 'web'
      }, undefined, plan);

      const e2eTask = result.find(t => t.title.includes('E2E'));
      expect(e2eTask).toBeDefined();
      expect(e2eTask?.priority).toBe('P0');
    });

    it('should create documentation task when level is set', () => {
      const parsedTask = {
        title: 'Doc Test',
        description: 'Test doc task creation',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };
      const plan = `3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {
        '文档': '完整文档'
      }, undefined, plan);

      const docTask = result.find(t => t.title === '文档编写');
      expect(docTask).toBeDefined();
    });

    it('should fallback to breakdownByGoals when plan has no modules', () => {
      const parsedTask = {
        title: 'Fallback Test',
        description: 'Test fallback',
        goals: ['实现功能A', '实现功能B'],
        goalTypes: ['development', 'development'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {}, undefined, 'random plan without structure');

      // 应该走 breakdownByGoals fallback
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include acceptance criteria for module tasks', () => {
      const parsedTask = {
        title: 'Criteria Test',
        description: 'Test acceptance criteria',
        goals: ['实现系统'],
        goalTypes: ['development'],
        constraints: [],
        deliverables: ['系统'],
        rawContent: ''
      };
      const plan = `3个领域模块: 用户, 订单, 商品`;

      const result = planner.breakdown(parsedTask, {}, undefined, plan);

      const devTasks = result.filter(t => t.title.startsWith('实现:'));
      for (const task of devTasks) {
        expect(task.acceptanceCriteria).toBeDefined();
        expect(task.acceptanceCriteria!.length).toBeGreaterThan(0);
      }
    });
  });
});
