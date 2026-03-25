// src/agents/agent-runner.ts
import type { Task, AgentType, AgentResult, AgentStatus } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from '../orchestrator/approval-manager.js';

export interface AgentRunnerConfig {
  maxConcurrent: number;
  taskTimeout: number;
}

export interface SubagentPrompt {
  task: Task;
  context: string;
  instructions: string;
}

/**
 * AgentRunner - 使用 Subagent 执行任务
 *
 * 通过 Claude Code 的 Agent 工具启动子 Agent 执行任务
 */
export class AgentRunner {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private config: AgentRunnerConfig;
  private runningAgents: Map<string, any> = new Map();

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager,
    config?: Partial<AgentRunnerConfig>
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.config = {
      maxConcurrent: 3,
      taskTimeout: 120000,
      ...config
    };
  }

  /**
   * 执行任务 - 返回 Subagent 调用提示
   */
  async runTask(task: Task): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 获取 Agent 类型对应的提示词
      const prompt = this.buildAgentPrompt(task);

      // 记录开始执行
      console.log(`🤖 Starting ${task.assignedAgent} agent for task ${task.id}`);

      // 返回结果（实际执行由 Subagent 完成）
      // 这里返回的是一个模板，实际使用时需要调用 Agent 工具
      const result: AgentResult = {
        runId: await this.generateRunId(),
        taskId: task.id,
        agentType: task.assignedAgent,
        status: 'completed',
        output: '',
        artifacts: [],
        needsApproval: false,
        duration: 0,
        completedAt: new Date().toISOString()
      };

      return result;

    } catch (error) {
      return {
        runId: await this.generateRunId(),
        taskId: task.id,
        agentType: task.assignedAgent,
        status: 'failed',
        output: '',
        artifacts: [],
        needsApproval: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 构建 Agent 提示词
   */
  private buildAgentPrompt(task: Task): SubagentPrompt {
    const agentPrompts: Record<AgentType, string> = {
      planner: this.getPlannerPrompt(task),
      coder: this.getCoderPrompt(task),
      tester: this.getTesterPrompt(task),
      reviewer: this.getReviewerPrompt(task),
      researcher: this.getResearcherPrompt(task),
      executor: this.getExecutorPrompt(task)
    };

    return {
      task,
      context: this.buildContext(task),
      instructions: agentPrompts[task.assignedAgent]
    };
  }

  /**
   * 构建任务上下文
   */
  private buildContext(task: Task): string {
    return `
## 任务信息

- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 优先级: ${task.priority}
- 超时: ${task.timeout}ms

## 依赖

${task.dependencies.length > 0
  ? task.dependencies.map(d => `- ${d}`).join('\n')
  : '无依赖'}

## 约束

- 最大执行时间: ${task.timeout / 1000} 秒
- 失败重试次数: 3
`;
  }

  /**
   * Planner Agent 提示词
   */
  private getPlannerPrompt(task: Task): string {
    return `
你是一个 Planner Agent，负责分析和规划任务。

## 职责

1. 分析任务需求
2. 拆解为子任务
3. 识别依赖关系
4. 制定执行计划
5. 评估风险和资源

## 输出格式

\`\`\`markdown
# 执行计划

## 概述
[任务概述]

## 子任务
1. [子任务1]
2. [子任务2]
...

## 依赖图
[依赖关系描述]

## 风险评估
- 风险1: [描述] -> [缓解措施]
...

## 预计时间
- 总计: X 小时
\`\`\`

## 注意事项

- 每个子任务应该独立可测试
- 标注明确的依赖关系
- 考虑边界情况
`;
  }

  /**
   * Coder Agent 提示词
   */
  private getCoderPrompt(task: Task): string {
    return `
你是一个 Coder Agent，负责编写代码。

## 职责

1. 根据任务描述编写代码
2. 遵循项目代码规范
3. 编写必要的注释
4. 确保代码可编译
5. 处理边界情况

## 输出要求

- 代码文件路径清晰
- 遵循现有代码风格
- 添加必要的错误处理
- 考虑性能和安全性

## 注意事项

- 不要破坏现有功能
- 保持向后兼容
- 使用项目已有的工具函数
`;
  }

  /**
   * Tester Agent 提示词
   */
  private getTesterPrompt(task: Task): string {
    return `
你是一个 Tester Agent，负责测试代码。

## 职责

1. 编写单元测试
2. 编写集成测试
3. 执行测试用例
4. 生成测试报告
5. 验证修复效果

## 测试覆盖

- 正常流程
- 边界情况
- 异常处理
- 性能测试（如需要）

## 输出格式

\`\`\`markdown
# 测试报告

## 测试结果
- 通过: X
- 失败: Y
- 跳过: Z

## 覆盖率
- 语句: X%
- 分支: Y%
- 函数: Z%

## 问题列表
1. [问题描述]
\`\`\`
`;
  }

  /**
   * Reviewer Agent 提示词
   */
  private getReviewerPrompt(task: Task): string {
    return `
你是一个 Reviewer Agent，负责代码审查。

## 审查要点

1. 代码质量
   - 可读性
   - 可维护性
   - 复杂度

2. 最佳实践
   - 设计模式
   - 代码复用
   - 错误处理

3. 安全性
   - 输入验证
   - 敏感数据处理
   - 权限控制

4. 性能
   - 算法效率
   - 资源使用
   - 潜在瓶颈

## 输出格式

\`\`\`markdown
# 代码审查报告

## 总体评价
[通过/需要修改/拒绝]

## 问题列表
| 严重程度 | 文件 | 行号 | 问题描述 |
|---------|------|------|---------|
| High    | x.ts | 10   | ...     |

## 建议
1. [建议1]
\`\`\`
`;
  }

  /**
   * Researcher Agent 提示词
   */
  private getResearcherPrompt(task: Task): string {
    return `
你是一个 Researcher Agent，负责调研和分析。

## 职责

1. 搜索相关资料
2. 分析技术方案
3. 总结最佳实践
4. 提供决策建议

## 输出格式

\`\`\`markdown
# 调研报告

## 问题
[调研问题]

## 发现
1. [发现1]
2. [发现2]
...

## 方案对比
| 方案 | 优点 | 缺点 |
|-----|------|------|
| A   | ...  | ...  |

## 建议
[推荐方案及理由]
\`\`\`
`;
  }

  /**
   * Executor Agent 提示词
   */
  private getExecutorPrompt(task: Task): string {
    return `
你是一个 Executor Agent，负责执行命令和操作。

## 职责

1. 执行构建命令
2. 运行测试
3. 部署应用
4. 清理环境

## 安全约束

- 不执行危险命令 (rm -rf /, 等)
- 不暴露敏感信息
- 验证命令参数
- 记录执行日志

## 输出格式

\`\`\`markdown
# 执行结果

## 命令
\`\`\`bash
[执行的命令]
\`\`\`

## 输出
\`\`\`
[命令输出]
\`\`\`

## 状态
[成功/失败]

## 错误 (如有)
[错误信息]
\`\`\`
`;
  }

  /**
   * 生成运行 ID
   */
  private async generateRunId(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `agent-run-${timestamp}${rand}`;
  }

  /**
   * 获取运行中的 Agent 数量
   */
  getRunningCount(): number {
    return this.runningAgents.size;
  }

  /**
   * 检查是否可以启动新 Agent
   */
  canStartNew(): boolean {
    return this.runningAgents.size < this.config.maxConcurrent;
  }
}
