// src/orchestrator/phase-executor.ts
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { AgentRunner, type SubagentTask } from '../agents/agent-runner.js';
import type { Task, AgentType } from '../types/index.js';

export type Phase = 'develop' | 'verify' | 'accept';

export interface PhaseResult {
  phase: Phase;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  artifacts: string[];
  nextPhase?: Phase;
  needsApproval: boolean;
}

export interface BuildTestResult {
  compile: boolean;
  staticAnalysis: boolean;
  dependencies: boolean;
  package: boolean;
  errors: string[];
}

/**
 * PhaseExecutor - 三阶段验证执行器
 *
 * 每个任务经历三个阶段:
 * 1. Develop - 开发实现
 * 2. Verify - 代码审查 + 测试 + Build 测试
 * 3. Accept - 最终验收
 */
export class PhaseExecutor {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private agentRunner: AgentRunner;

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.agentRunner = new AgentRunner(stateManager, approvalManager);
  }

  /**
   * 获取任务当前阶段
   */
  getCurrentPhase(task: Task): Phase {
    if (task.phases.develop.status !== 'completed') return 'develop';
    if (task.phases.verify.status !== 'completed') return 'verify';
    return 'accept';
  }

  /**
   * 准备阶段执行的 Subagent 任务
   */
  async preparePhaseExecution(task: Task): Promise<SubagentTask | null> {
    const currentPhase = this.getCurrentPhase(task);

    switch (currentPhase) {
      case 'develop':
        return this.prepareDevelopPhase(task);
      case 'verify':
        return this.prepareVerifyPhase(task);
      case 'accept':
        return this.prepareAcceptPhase(task);
      default:
        return null;
    }
  }

  /**
   * 准备开发阶段
   */
  private async prepareDevelopPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildDevelopPrompt(task);

    return {
      subagent_type: this.agentRunner.mapAgentType(task.assignedAgent),
      description: `develop: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: 'worktree',
      taskId: task.id,
      agentType: task.assignedAgent,
      timeout: task.timeout,
      needsApproval: false
    };
  }

  /**
   * 准备验证阶段
   */
  private async prepareVerifyPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildVerifyPrompt(task);

    return {
      subagent_type: 'general-purpose',
      description: `verify: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: undefined, // 验证不需要隔离
      taskId: task.id,
      agentType: 'reviewer',
      timeout: task.timeout / 2, // 验证阶段时间较短
      needsApproval: false
    };
  }

  /**
   * 准备验收阶段
   */
  private async prepareAcceptPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildAcceptPrompt(task);

    return {
      subagent_type: 'general-purpose',
      description: `accept: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: undefined,
      taskId: task.id,
      agentType: 'reviewer',
      timeout: 60000, // 验收阶段固定 1 分钟
      needsApproval: true // 验收需要确认
    };
  }

  /**
   * 构建开发阶段提示词
   */
  private buildDevelopPrompt(task: Task): string {
    return `# 开发阶段 (Develop Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 优先级: ${task.priority}

## 目标
完成功能实现，确保代码可编译。

## 要求
1. 根据任务描述编写代码
2. 遵循项目代码规范
3. 编写必要的注释
4. 处理边界情况和错误

## 输出要求
完成后，在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`result.md\` - 实现说明
- \`changes.txt\` - 变更文件列表

## 注意事项
- 不要破坏现有功能
- 保持向后兼容
- 使用项目已有的工具函数
- 代码必须可编译
`;
  }

  /**
   * 构建验证阶段提示词
   */
  private buildVerifyPrompt(task: Task): string {
    return `# 验证阶段 (Verify Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}

## 验证目标
1. 代码审查 (Code Review)
2. 运行测试 (Run Tests)
3. Build 测试 (Build Check)

## 代码审查要点
- 可读性和可维护性
- 设计模式使用
- 错误处理
- 安全性检查

## Build 测试要求
执行以下命令并记录结果:
\`\`\`bash
# 1. 编译检查
npm run build

# 2. 静态分析 (如果有)
npm run lint || echo "No lint script"

# 3. 依赖验证
npm ci --dry-run || npm install --dry-run

# 4. 测试
npm test
\`\`\`

## 输出要求
在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`verify-report.md\` - 验证报告
- \`build-result.txt\` - Build 测试结果

## 结果格式
如果所有检查通过，输出:
\`\`\`
VERIFY_PASSED
\`\`\`

如果有问题，输出:
\`\`\`
VERIFY_FAILED
问题列表:
1. [问题描述]
2. [问题描述]
\`\`\`
`;
  }

  /**
   * 构建验收阶段提示词
   */
  private buildAcceptPrompt(task: Task): string {
    return `# 验收阶段 (Accept Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}

## 验收标准
1. 功能是否按需求实现
2. 测试是否通过
3. 文档是否更新
4. 是否可以合并

## 检查清单
- [ ] 功能演示/验证
- [ ] 测试报告
- [ ] 代码审查通过
- [ ] 文档已更新

## 输出要求
在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`accept-report.md\` - 验收报告

## 结果格式
如果验收通过，输出:
\`\`\`
ACCEPT_PASSED
\`\`\`

如果需要修改，输出:
\`\`\`
ACCEPT_NEEDS_MODIFICATION
修改建议:
1. [建议]
\`\`\`
`;
  }

  /**
   * 处理阶段结果
   */
  async processPhaseResult(
    task: Task,
    phase: Phase,
    result: { success: boolean; output: string; error?: string }
  ): Promise<PhaseResult> {
    const now = new Date().toISOString();

    if (result.success) {
      // 更新阶段状态
      const updates: Partial<Task> = {
        phases: {
          ...task.phases,
          [phase]: {
            status: 'completed',
            duration: 0,
            completedAt: now
          }
        }
      };

      // 设置下一阶段
      let nextPhase: Phase | undefined;
      let needsApproval = false;

      if (phase === 'develop') {
        nextPhase = 'verify';
        updates.phases!.verify = {
          status: 'pending',
          duration: null,
          startedAt: now
        };
        updates.status = 'verify';
      } else if (phase === 'verify') {
        nextPhase = 'accept';
        updates.phases!.accept = {
          status: 'pending',
          duration: null,
          startedAt: now
        };
        updates.status = 'accept';
        needsApproval = true;
      } else if (phase === 'accept') {
        updates.status = 'completed';
      }

      await this.stateManager.updateTask(task.id, updates);

      return {
        phase,
        success: true,
        output: result.output,
        duration: 0,
        artifacts: [],
        nextPhase,
        needsApproval
      };
    } else {
      // 阶段失败
      await this.stateManager.updateTask(task.id, {
        status: 'failed',
        error: result.error || `${phase} phase failed`
      });

      return {
        phase,
        success: false,
        error: result.error,
        duration: 0,
        artifacts: [],
        needsApproval: false
      };
    }
  }

  /**
   * 检查 Build 测试结果
   */
  parseBuildTestResult(output: string): BuildTestResult {
    const result: BuildTestResult = {
      compile: false,
      staticAnalysis: false,
      dependencies: false,
      package: false,
      errors: []
    };

    // 解析编译结果
    if (output.includes('npm run build') && !output.includes('error')) {
      result.compile = true;
    }

    // 解析 lint 结果
    if (output.includes('npm run lint')) {
      result.staticAnalysis = !output.includes('error') && !output.includes('warning');
    } else {
      result.staticAnalysis = true; // 没有 lint 脚本视为通过
    }

    // 解析依赖检查
    if (output.includes('npm ci') || output.includes('npm install')) {
      result.dependencies = !output.includes('ERR!');
    }

    // 解析测试结果
    if (output.includes('npm test')) {
      result.package = output.includes('passed') || output.includes('PASS');
    }

    // 收集错误
    const errorLines = output.split('\n').filter(line =>
      line.toLowerCase().includes('error') ||
      line.toLowerCase().includes('failed') ||
      line.toLowerCase().includes('fail')
    );
    result.errors = errorLines;

    return result;
  }

  /**
   * 获取 AgentRunner 实例
   */
  getAgentRunner(): AgentRunner {
    return this.agentRunner;
  }
}
