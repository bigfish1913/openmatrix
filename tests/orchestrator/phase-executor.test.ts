// tests/orchestrator/phase-executor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PhaseExecutor, type Phase } from '../../src/orchestrator/phase-executor.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import type { Task } from '../../src/types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = path.join(process.cwd(), '.openmatrix-test-phase');

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-TEST001',
    title: 'Test Task',
    description: 'A test task for phase executor',
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

describe('PhaseExecutor', () => {
  let phaseExecutor: PhaseExecutor;
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
    phaseExecutor = new PhaseExecutor(stateManager, approvalManager);
  });

  describe('getCurrentPhase', () => {
    it('should return develop for new task', () => {
      const task = createTestTask();
      expect(phaseExecutor.getCurrentPhase(task)).toBe('develop');
    });

    it('should return verify when develop completed', () => {
      const task = createTestTask({
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'pending', duration: null },
          accept: { status: 'pending', duration: null }
        }
      });
      expect(phaseExecutor.getCurrentPhase(task)).toBe('verify');
    });

    it('should return accept when verify completed', () => {
      const task = createTestTask({
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'completed', duration: 15, completedAt: new Date().toISOString() },
          accept: { status: 'pending', duration: null }
        }
      });
      expect(phaseExecutor.getCurrentPhase(task)).toBe('accept');
    });
  });

  describe('preparePhaseExecution', () => {
    it('should prepare develop phase for new task', async () => {
      const task = createTestTask();
      const result = await phaseExecutor.preparePhaseExecution(task);

      expect(result).not.toBeNull();
      expect(result!.phase).toBeUndefined(); // SubagentTask 没有 phase 字段
      expect(result!.agentType).toBe('coder');
      expect(result!.prompt).toContain('开发阶段');
      expect(result!.isolation).toBe('worktree');
    });

    it('should prepare verify phase after develop', async () => {
      const task = createTestTask({
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'pending', duration: null },
          accept: { status: 'pending', duration: null }
        }
      });
      const result = await phaseExecutor.preparePhaseExecution(task);

      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('reviewer');
      expect(result!.prompt).toContain('验证阶段');
      expect(result!.prompt).toContain('Build 测试');
      expect(result!.isolation).toBeUndefined();
    });

    it('should prepare accept phase after verify', async () => {
      const task = createTestTask({
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'completed', duration: 15, completedAt: new Date().toISOString() },
          accept: { status: 'pending', duration: null }
        }
      });
      const result = await phaseExecutor.preparePhaseExecution(task);

      expect(result).not.toBeNull();
      expect(result!.agentType).toBe('reviewer');
      expect(result!.prompt).toContain('验收阶段');
      expect(result!.needsApproval).toBe(true);
    });
  });

  describe('processPhaseResult', () => {
    it('should transition develop -> verify on success', async () => {
      const task = createTestTask();
      await stateManager.createTask({
        title: task.title,
        description: task.description,
        priority: task.priority,
        timeout: task.timeout,
        dependencies: task.dependencies,
        assignedAgent: task.assignedAgent
      });

      const result = await phaseExecutor.processPhaseResult(
        { ...task, id: (await stateManager.listTasks())[0].id },
        'develop',
        { success: true, output: 'Development completed' }
      );

      expect(result.success).toBe(true);
      expect(result.phase).toBe('develop');
      expect(result.nextPhase).toBe('verify');

      const updatedTask = await stateManager.getTask((await stateManager.listTasks())[0].id);
      expect(updatedTask?.phases.develop.status).toBe('completed');
      expect(updatedTask?.status).toBe('verify');
    });

    it('should transition verify -> accept on success', async () => {
      const createdTask = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P1',
        timeout: 120000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // 手动设置 develop 已完成
      await stateManager.updateTask(createdTask.id, {
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'in_progress', duration: null, startedAt: new Date().toISOString() },
          accept: { status: 'pending', duration: null }
        },
        status: 'verify'
      });

      const result = await phaseExecutor.processPhaseResult(
        await stateManager.getTask(createdTask.id) as Task,
        'verify',
        { success: true, output: 'VERIFY_PASSED' }
      );

      expect(result.success).toBe(true);
      expect(result.nextPhase).toBe('accept');
      expect(result.needsApproval).toBe(true);
    });

    it('should complete task after accept success', async () => {
      const createdTask = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P1',
        timeout: 120000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // 设置所有前置阶段已完成
      await stateManager.updateTask(createdTask.id, {
        phases: {
          develop: { status: 'completed', duration: 30, completedAt: new Date().toISOString() },
          verify: { status: 'completed', duration: 15, completedAt: new Date().toISOString() },
          accept: { status: 'in_progress', duration: null, startedAt: new Date().toISOString() }
        },
        status: 'accept'
      });

      const result = await phaseExecutor.processPhaseResult(
        await stateManager.getTask(createdTask.id) as Task,
        'accept',
        { success: true, output: 'ACCEPT_PASSED' }
      );

      expect(result.success).toBe(true);
      expect(result.nextPhase).toBeUndefined();

      const updatedTask = await stateManager.getTask(createdTask.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should mark task failed on phase failure', async () => {
      const createdTask = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P1',
        timeout: 120000,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const result = await phaseExecutor.processPhaseResult(
        await stateManager.getTask(createdTask.id) as Task,
        'develop',
        { success: false, output: '', error: 'Build failed' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Build failed');

      const updatedTask = await stateManager.getTask(createdTask.id);
      expect(updatedTask?.status).toBe('failed');
      expect(updatedTask?.error).toContain('Build failed');
    });
  });

  describe('parseBuildTestResult', () => {
    it('should parse successful build output', () => {
      const output = `
npm run build
> tsc
Build successful

npm run lint
> eslint
No problems found

npm test
> vitest
✓ 10 tests passed
`;

      const result = phaseExecutor.parseBuildTestResult(output);

      expect(result.compile).toBe(true);
      expect(result.staticAnalysis).toBe(true);
      expect(result.package).toBe(true);
    });

    it('should detect build errors', () => {
      const output = `
npm run build
> tsc
src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
`;

      const result = phaseExecutor.parseBuildTestResult(output);

      expect(result.compile).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing lint script', () => {
      const output = `
npm run build
> tsc
Build successful

npm run lint || echo "No lint script"
No lint script
`;

      const result = phaseExecutor.parseBuildTestResult(output);

      expect(result.compile).toBe(true);
      expect(result.staticAnalysis).toBe(true); // 没有 lint 视为通过
    });
  });

  describe('getAgentRunner', () => {
    it('should return agent runner instance', () => {
      const runner = phaseExecutor.getAgentRunner();
      expect(runner).toBeDefined();
      expect(runner.mapAgentType).toBeDefined();
    });
  });
});
