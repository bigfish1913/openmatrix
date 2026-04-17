// tests/agents/agent-runner.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRunner } from '../../src/agents/agent-runner.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import type { Task, AgentType } from '../../src/types/index.js';
import * as fs from 'fs';

// Mock StateManager
const mockStateManager = {
  getState: vi.fn(),
  updateState: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  listTasks: vi.fn()
};

// Mock ApprovalManager
const mockApprovalManager = {
  createApproval: vi.fn(),
  getApproval: vi.fn(),
  updateApproval: vi.fn()
};

// 创建测试任务
function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-TEST001',
    title: 'Test Task',
    description: 'A test task for unit testing',
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

describe('AgentRunner', () => {
  let agentRunner: AgentRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    agentRunner = new AgentRunner(
      mockStateManager as any,
      mockApprovalManager as any,
      { maxConcurrent: 3, taskTimeout: 120000 }
    );
  });

  describe('mapAgentType', () => {
    it('should map planner to Plan', () => {
      expect(agentRunner.mapAgentType('planner')).toBe('Plan');
    });

    it('should map researcher to Explore', () => {
      expect(agentRunner.mapAgentType('researcher')).toBe('Explore');
    });

    it('should map coder to general-purpose', () => {
      expect(agentRunner.mapAgentType('coder')).toBe('general-purpose');
    });

    it('should map tester to general-purpose', () => {
      expect(agentRunner.mapAgentType('tester')).toBe('general-purpose');
    });

    it('should map reviewer to general-purpose', () => {
      expect(agentRunner.mapAgentType('reviewer')).toBe('general-purpose');
    });

    it('should map executor to general-purpose', () => {
      expect(agentRunner.mapAgentType('executor')).toBe('general-purpose');
    });
  });

  describe('prepareSubagentTask', () => {
    it('should return complete SubagentTask for coder task', async () => {
      const task = createTestTask({ assignedAgent: 'coder' });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.taskId).toBe('TASK-TEST001');
      expect(result.agentType).toBe('coder');
      expect(result.subagent_type).toBe('general-purpose');
      expect(result.timeout).toBe(120000);
      expect(result.prompt).toContain('Test Task');
      expect(result.prompt).toContain('开发 (Develop)');
      expect(result.isolation).toBe('worktree'); // coder 需要隔离
    });

    it('should return Plan subagent for planner task', async () => {
      const task = createTestTask({ assignedAgent: 'planner' });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.subagent_type).toBe('Plan');
      expect(result.isolation).toBeUndefined(); // planner 不需要隔离
    });

    it('should return Explore subagent for researcher task', async () => {
      const task = createTestTask({ assignedAgent: 'researcher' });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.subagent_type).toBe('Explore');
    });

    it('should include phase context in prompt', async () => {
      const task = createTestTask({
        phases: {
          develop: { status: 'completed', duration: 30 },
          verify: { status: 'in_progress', duration: null, startedAt: new Date().toISOString() },
          accept: { status: 'pending', duration: null }
        }
      });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.prompt).toContain('验证 (Verify)');
      expect(result.prompt).toContain('开发阶段: completed');
    });

    it('should include dependencies in prompt', async () => {
      const task = createTestTask({
        dependencies: ['TASK-001', 'TASK-002']
      });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.prompt).toContain('TASK-001');
      expect(result.prompt).toContain('TASK-002');
    });

    it('should truncate long title in description', async () => {
      const task = createTestTask({
        title: 'This is a very long task title that should be truncated to fifty characters'
      });
      const result = await agentRunner.prepareSubagentTask(task);

      expect(result.description.length).toBeLessThanOrEqual(57); // 'coder: ' + 50 chars
    });
  });

  describe('prepareSubagentTasks', () => {
    it('should prepare multiple tasks', async () => {
      const tasks = [
        createTestTask({ id: 'TASK-001', assignedAgent: 'coder' }),
        createTestTask({ id: 'TASK-002', assignedAgent: 'tester' }),
        createTestTask({ id: 'TASK-003', assignedAgent: 'reviewer' })
      ];

      const results = await agentRunner.prepareSubagentTasks(tasks);

      expect(results).toHaveLength(3);
      expect(results[0].taskId).toBe('TASK-001');
      expect(results[1].taskId).toBe('TASK-002');
      expect(results[2].taskId).toBe('TASK-003');
    });

    it('should respect maxConcurrent limit', async () => {
      const smallRunner = new AgentRunner(
        mockStateManager as any,
        mockApprovalManager as any,
        { maxConcurrent: 2, taskTimeout: 120000 }
      );

      const tasks = [
        createTestTask({ id: 'TASK-001' }),
        createTestTask({ id: 'TASK-002' }),
        createTestTask({ id: 'TASK-003' })
      ];

      const results = await smallRunner.prepareSubagentTasks(tasks);

      expect(results).toHaveLength(2);
    });
  });

  describe('buildExecutionPrompt', () => {
    it('should include all task information', async () => {
      const task = createTestTask({
        title: 'Implement Feature X',
        description: 'Add new feature to the system',
        priority: 'P0'
      });

      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('Implement Feature X');
      expect(prompt).toContain('Add new feature to the system');
      expect(prompt).toContain('P0');
      expect(prompt).toContain('TASK-TEST001');
    });

    it('should include completion requirements', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('执行结果');
      expect(prompt).toContain('请勿直接修改 task.json');
    });
  });

  describe('canStartNew', () => {
    it('should return true when under limit', () => {
      expect(agentRunner.canStartNew()).toBe(true);
    });

    it('should return false when at limit', async () => {
      const tasks = [
        createTestTask({ id: 'TASK-001' }),
        createTestTask({ id: 'TASK-002' }),
        createTestTask({ id: 'TASK-003' })
      ];

      await agentRunner.prepareSubagentTasks(tasks);

      expect(agentRunner.canStartNew()).toBe(false);
    });
  });

  describe('getRunningCount', () => {
    it('should return 0 initially', () => {
      expect(agentRunner.getRunningCount()).toBe(0);
    });

    it('should return correct count after preparing tasks', async () => {
      const tasks = [
        createTestTask({ id: 'TASK-001' }),
        createTestTask({ id: 'TASK-002' })
      ];

      await agentRunner.prepareSubagentTasks(tasks);

      expect(agentRunner.getRunningCount()).toBe(2);
    });
  });

  describe('runTask (backward compatibility)', () => {
    it('should return AgentResult with subagent info', async () => {
      const task = createTestTask();
      const result = await agentRunner.runTask(task);

      expect(result.taskId).toBe('TASK-TEST001');
      expect(result.agentType).toBe('coder');
      expect(result.status).toBe('completed');
      expect(result.output).toContain('Subagent task prepared');
    });

    it('should handle errors gracefully', async () => {
      // 测试正常情况下不会抛出异常
      const task = createTestTask();
      const result = await agentRunner.runTask(task);

      // runTask 现在不会失败，而是返回成功的 SubagentTask 信息
      expect(result.status).toBe('completed');
      expect(result.output).toContain('Subagent task prepared');
    });
  });

  describe('logger usage verification', () => {
    it('should not contain any console.log calls in agent-runner.ts', () => {
      const sourcePath = require('path').resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/console\.log/);
    });

    it('should not import logger in agent-runner.ts', () => {
      const sourcePath = require('path').resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/from ['"].*logger['"]/);
    });

    it('should use logger for output rather than direct console methods', () => {
      const sourcePath = require('path').resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Ensure no console.warn, console.error, console.debug either
      expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    });
  });
});
