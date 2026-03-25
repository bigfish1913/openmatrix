// tests/orchestrator/executor.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrchestratorExecutor } from '../../src/orchestrator/executor.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import type { Task, GlobalState, Approval } from '../../src/types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// 测试目录
const TEST_DIR = path.join(process.cwd(), '.openmatrix-test-executor');

// 创建测试任务
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `TASK-${Date.now()}`,
    title: 'Test Task',
    description: 'A test task',
    status: 'pending',
    priority: 'P1',
    timeout: 120000,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'pending', duration: null },
      verify: { status: 'pending', duration: null },
      accept: { status: 'pending', duration: null }
    },
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('OrchestratorExecutor', () => {
  let executor: OrchestratorExecutor;
  let stateManager: StateManager;
  let approvalManager: ApprovalManager;

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

    approvalManager = new ApprovalManager(stateManager);

    executor = new OrchestratorExecutor(stateManager, approvalManager, {
      maxConcurrent: 2,
      taskTimeout: 60000
    });
  });

  describe('step', () => {
    it('should return completed when no tasks', async () => {
      const result = await executor.step();

      expect(result.status).toBe('completed');
      expect(result.message).toContain('完成');
      expect(result.subagentTasks).toHaveLength(0);
    });

    it('should return subagent tasks for pending tasks', async () => {
      // 创建任务
      await stateManager.createTask({
        title: 'Test Task 1',
        description: 'Description',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const result = await executor.step();

      expect(result.status).toBe('continue');
      expect(result.subagentTasks.length).toBeGreaterThan(0);
      expect(result.message).toContain('准备执行');
    });

    it('should respect maxConcurrent limit', async () => {
      // 创建多个任务
      for (let i = 0; i < 5; i++) {
        await stateManager.createTask({
          title: `Task ${i}`,
          description: `Description ${i}`,
          priority: 'P1',
          timeout: 60000,
          dependencies: [],
          assignedAgent: 'coder'
        });
      }

      const result = await executor.step();

      // maxConcurrent = 2
      expect(result.subagentTasks.length).toBeLessThanOrEqual(2);
    });

    it('should return waiting_approval when approvals pending', async () => {
      // 创建审批请求
      await approvalManager.createPlanApproval('approval-1', 'Test plan');

      const result = await executor.step();

      expect(result.status).toBe('waiting_approval');
      expect(result.message).toContain('审批');
    });

    it('should check dependencies before scheduling', async () => {
      // 创建依赖任务
      const depTask = await stateManager.createTask({
        title: 'Dependency Task',
        description: 'Must complete first',
        priority: 'P0',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // 创建依赖于此任务的任务
      await stateManager.createTask({
        title: 'Dependent Task',
        description: 'Waits for dependency',
        priority: 'P1',
        timeout: 60000,
        dependencies: [depTask.id],
        assignedAgent: 'coder'
      });

      const result = await executor.step();

      // 只有依赖任务应该被调度
      expect(result.subagentTasks).toHaveLength(1);
      expect(result.subagentTasks[0].taskId).toBe(depTask.id);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed when all phases done', async () => {
      const task = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // 先启动任务
      await executor.step();

      // 完成 develop 阶段
      await executor.completeTask(task.id, { success: true, output: 'Done' });

      const updatedTask = await stateManager.getTask(task.id);
      expect(updatedTask?.phases.develop.status).toBe('completed');
      expect(updatedTask?.status).toBe('verify');
    });

    it('should mark task as failed on error', async () => {
      const task = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await executor.step();

      await executor.completeTask(task.id, {
        success: false,
        error: 'Something went wrong'
      });

      const updatedTask = await stateManager.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
      expect(updatedTask?.error).toContain('Something went wrong');
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      const status = await executor.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('currentPhase');
      expect(status).toHaveProperty('pendingTasks');
      expect(status).toHaveProperty('runningTasks');
      expect(status).toHaveProperty('waitingApprovals');
    });

    it('should count pending tasks correctly', async () => {
      await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await stateManager.createTask({
        title: 'Task 2',
        description: 'Test',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const status = await executor.getStatus();

      expect(status.pendingTasks).toBe(2);
    });
  });

  describe('getAgentRunner', () => {
    it('should return agent runner instance', () => {
      const runner = executor.getAgentRunner();
      expect(runner).toBeDefined();
      expect(runner.mapAgentType).toBeDefined();
    });
  });

  describe('getScheduler', () => {
    it('should return scheduler instance', () => {
      const scheduler = executor.getScheduler();
      expect(scheduler).toBeDefined();
      expect(scheduler.getNextTask).toBeDefined();
    });
  });

  describe('phase transitions', () => {
    it('should transition develop -> verify -> accept', async () => {
      const task = await stateManager.createTask({
        title: 'Phase Test',
        description: 'Test phase transitions',
        priority: 'P1',
        timeout: 60000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // 启动任务
      await executor.step();

      // 完成 develop
      await executor.completeTask(task.id, { success: true });
      let updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('verify');

      // 完成 verify
      await executor.completeTask(task.id, { success: true });
      updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('accept');

      // 完成 accept
      await executor.completeTask(task.id, { success: true });
      updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('completed');
    });
  });
});
