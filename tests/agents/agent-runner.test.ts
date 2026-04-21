// tests/agents/agent-runner.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRunner } from '../../src/agents/agent-runner.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import type { Task, AgentType } from '../../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';

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
      const sourcePath = path.resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/console\.log/);
    });

    it('should not import logger in agent-runner.ts', () => {
      const sourcePath = path.resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/from ['"].*logger['"]/);
    });

    it('should use logger for output rather than direct console methods', () => {
      const sourcePath = path.resolve(__dirname, '../../src/agents/agent-runner.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Ensure no console.warn, console.error, console.debug either
      expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    });
  });

  // ============ Ambiguity Detection Instruction Tests ============
  describe('buildAmbiguityDetectionInstruction', () => {
    // 通过 buildExecutionPrompt 的输出间接验证私有方法

    it('should include ambiguity detection instruction in prompt', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证歧义检测指令标题存在
      expect(prompt).toContain('歧义检测指令');
      expect(prompt).toContain('必须在执行前完成');
    });

    it('should include all 5 ambiguity types in detection checklist', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证5种歧义类型都存在
      expect(prompt).toContain('需求歧义');
      expect(prompt).toContain('requirement');
      expect(prompt).toContain('技术歧义');
      expect(prompt).toContain('technical');
      expect(prompt).toContain('依赖歧义');
      expect(prompt).toContain('dependency');
      expect(prompt).toContain('验收歧义');
      expect(prompt).toContain('acceptance');
      expect(prompt).toContain('测试结果歧义');
      expect(prompt).toContain('test_result');
    });

    it('should include severity level definitions', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证严重程度级别定义存在
      expect(prompt).toContain('严重程度定义');
      expect(prompt).toContain('Critical');
      expect(prompt).toContain('无法继续执行');
      expect(prompt).toContain('High');
      expect(prompt).toContain('可能导致错误结果');
      expect(prompt).toContain('Medium');
      expect(prompt).toContain('影响执行效率');
      expect(prompt).toContain('Low');
      expect(prompt).toContain('轻微不确定性');
    });

    it('should include JSON output format for detected ambiguity', async () => {
      const task = createTestTask({ id: 'TASK-AMB001' });
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证 JSON 输出格式存在
      expect(prompt).toContain('"ambiguityDetected": true');
      expect(prompt).toContain('"report"');
      expect(prompt).toContain('"taskId": "TASK-AMB001"');
      expect(prompt).toContain('"phase": "pre_execution"');
      expect(prompt).toContain('"ambiguities"');
      expect(prompt).toContain('"type"');
      expect(prompt).toContain('"severity"');
      expect(prompt).toContain('"description"');
      expect(prompt).toContain('"suggestedResolution"');
      expect(prompt).toContain('"overallSeverity"');
      expect(prompt).toContain('"recommendedAction"');
      expect(prompt).toContain('ask_user');
      expect(prompt).toContain('proceed_with_assumption');
      expect(prompt).toContain('block_and_report');
    });

    it('should include JSON output format for no ambiguity', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证无歧义时的输出格式
      expect(prompt).toContain('"ambiguityDetected": false');
    });

    it('should include handling strategy based on severity', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证处理策略说明
      expect(prompt).toContain('处理策略');
      expect(prompt).toContain('Critical/High');
      expect(prompt).toContain('输出报告后暂停');
      expect(prompt).toContain('等待用户决策');
      expect(prompt).toContain('Medium');
      expect(prompt).toContain('输出报告后继续执行');
      expect(prompt).toContain('采用合理假设');
      expect(prompt).toContain('Low');
      expect(prompt).toContain('记录并继续执行');
    });

    it('should include fallback instruction when parsing fails', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证解析失败时的兜底指令
      expect(prompt).toContain('无法解析歧义检测结果');
      expect(prompt).toContain('视为无歧义继续执行');
    });

    it('should include correct task ID in JSON template', async () => {
      const task = createTestTask({ id: 'TASK-CUSTOM-123' });
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证 JSON 模板中的 taskId 是动态注入的
      expect(prompt).toContain('"taskId": "TASK-CUSTOM-123"');
    });

    it('should inject ambiguity instruction at the beginning of prompt', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证歧义检测指令在提示词开头位置
      const taskInfoIndex = prompt.indexOf('# 任务执行');
      const ambiguityIndex = prompt.indexOf('歧义检测指令');

      // 歧义检测指令应该在任务执行标题之后立即出现
      expect(ambiguityIndex).toBeGreaterThan(taskInfoIndex);
    });

    it('should include detection checklist details for each type', async () => {
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 验证每种歧义类型的检测清单详情
      // 需求歧义检测项
      expect(prompt).toContain('任务描述是否清晰可理解');
      expect(prompt).toContain('是否有缺少的关键信息');
      expect(prompt).toContain('验收标准是否明确');

      // 技术歧义检测项
      expect(prompt).toContain('技术选型是否明确');
      expect(prompt).toContain('实现方案是否有多种选择');
      expect(prompt).toContain('是否需要特定的技术决策');

      // 依赖歧义检测项
      expect(prompt).toContain('依赖任务是否已完成');
      expect(prompt).toContain('依赖代码是否可找到');
      expect(prompt).toContain('是否有缺失的依赖项');

      // 验收歧义检测项
      expect(prompt).toContain('验收标准是否明确');
      expect(prompt).toContain('成功定义是否清晰');
      expect(prompt).toContain('是否有模糊的边界条件');

      // 测试结果歧义检测项
      expect(prompt).toContain('测试失败原因是否明确');
      expect(prompt).toContain('测试通过是否可信');
      expect(prompt).toContain('是否需要额外的验证');
    });
  });

  // ============ User Context Injection Tests ============
  describe('userContext injection', () => {
    it('should allow setting user context', () => {
      const context = {
        objective: 'Build a REST API',
        techStack: ['Node.js', 'Express', 'PostgreSQL']
      };
      agentRunner.setUserContext(context);

      const retrievedContext = agentRunner.getUserContext();
      expect(retrievedContext.objective).toBe('Build a REST API');
      expect(retrievedContext.techStack).toEqual(['Node.js', 'Express', 'PostgreSQL']);
    });

    it('should include objective in prompt when set', async () => {
      agentRunner.setUserContext({ objective: '实现用户认证功能' });
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('实现用户认证功能');
    });

    it('should include tech stack in prompt when set', async () => {
      agentRunner.setUserContext({ techStack: ['React', 'TypeScript', 'Vitest'] });
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('React');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Vitest');
    });

    it('should include test coverage requirement when set', async () => {
      agentRunner.setUserContext({ testCoverage: '>= 80%' });
      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('>= 80%');
    });

    it('should include acceptance criteria when task has them', async () => {
      const task = createTestTask({
        acceptanceCriteria: [
          '功能正常运行',
          '测试覆盖率 >= 80%',
          '无安全隐患'
        ]
      });
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('验收标准');
      expect(prompt).toContain('功能正常运行');
      expect(prompt).toContain('测试覆盖率 >= 80%');
      expect(prompt).toContain('无安全隐患');
    });
  });

  // ============ Accumulated Context Tests ============
  describe('buildAccumulatedContext', () => {
    it('should include accumulated context from context.md file', async () => {
      // 创建临时 .openmatrix 目录和 context.md 文件
      const tempDir = path.join(process.cwd(), '.openmatrix');
      const contextFile = path.join(tempDir, 'context.md');

      // 确保目录存在
      await fsPromises.mkdir(tempDir, { recursive: true });
      await fsPromises.writeFile(contextFile, '前序 Agent 决策: 使用 Express 作为框架');

      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).toContain('前序 Agent 共享上下文');
      expect(prompt).toContain('使用 Express 作为框架');

      // 清理测试文件
      await fsPromises.unlink(contextFile);
    });

    it('should not include accumulated context section when context.md is empty', async () => {
      const tempDir = path.join(process.cwd(), '.openmatrix');
      const contextFile = path.join(tempDir, 'context.md');

      await fsPromises.mkdir(tempDir, { recursive: true });
      await fsPromises.writeFile(contextFile, '');

      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      expect(prompt).not.toContain('前序 Agent 共享上下文');

      // 清理测试文件
      await fsPromises.unlink(contextFile);
    });

    it('should handle missing context.md gracefully', async () => {
      // 删除 context.md（如果存在）
      const tempDir = path.join(process.cwd(), '.openmatrix');
      const contextFile = path.join(tempDir, 'context.md');

      try {
        await fsPromises.unlink(contextFile);
      } catch {
        // 文件不存在，忽略
      }

      const task = createTestTask();
      const prompt = await agentRunner.buildExecutionPrompt(task);

      // 应该正常执行，不抛出异常
      expect(prompt).toContain('任务信息');
      expect(prompt).not.toContain('前序 Agent 共享上下文');
    });
  });
});
