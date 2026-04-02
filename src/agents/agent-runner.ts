// src/agents/agent-runner.ts
import type { Task, AgentType, AgentResult, AgentStatus, SubagentTask, ClaudeCodeSubagentType } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from '../orchestrator/approval-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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
 * 用户上下文信息
 */
export interface UserContext {
  objective?: string;
  techStack?: string[];
  testCoverage?: string;
  documentationLevel?: string;
  additionalContext?: Record<string, string>;
}

/**
 * AgentRunner - 使用 Subagent 执行任务
 *
 * 通过 Claude Code 的 Agent 工具启动子 Agent 执行任务
 *
 * 增强版特性:
 * - 注入用户上下文到提示词
 * - 注入验收标准
 * - 注入代码上下文
 */
export class AgentRunner {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private config: AgentRunnerConfig;
  private runningAgents: Map<string, any> = new Map();
  private userContext: UserContext = {};

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager,
    config?: Partial<AgentRunnerConfig>
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.config = {
      maxConcurrent: 3,
      taskTimeout: 600000, // 10 分钟
      ...config
    };
  }

  /**
   * 设置用户上下文
   */
  setUserContext(context: UserContext): void {
    this.userContext = context;
  }

  /**
   * 获取用户上下文
   */
  getUserContext(): UserContext {
    return this.userContext;
  }

  /**
   * 准备 Subagent 任务配置
   *
   * 返回可用于 Agent 工具调用的完整配置
   */
  async prepareSubagentTask(task: Task): Promise<SubagentTask> {
    const subagentType = this.mapAgentType(task.assignedAgent);
    const prompt = await this.buildExecutionPrompt(task);
    const needsIsolation = this.needsIsolation(task);

    console.log(`🤖 Preparing ${task.assignedAgent} subagent for task ${task.id}`);

    return {
      subagent_type: subagentType,
      description: `${task.assignedAgent}: ${task.title.slice(0, 50)}`,
      prompt,
      isolation: needsIsolation ? 'worktree' : undefined,
      taskId: task.id,
      agentType: task.assignedAgent,
      timeout: task.timeout,
      needsApproval: false
    };
  }

  /**
   * 批量准备 Subagent 任务
   */
  async prepareSubagentTasks(tasks: Task[]): Promise<SubagentTask[]> {
    const results: SubagentTask[] = [];

    for (const task of tasks) {
      if (this.canStartNew()) {
        const subagentTask = await this.prepareSubagentTask(task);
        results.push(subagentTask);
        this.runningAgents.set(task.id, subagentTask);
      }
    }

    return results;
  }

  /**
   * 映射 OpenMatrix Agent 类型到 Claude Code Subagent 类型
   */
  mapAgentType(agentType: AgentType): ClaudeCodeSubagentType {
    const mapping: Record<AgentType, ClaudeCodeSubagentType> = {
      planner: 'Plan',
      coder: 'general-purpose',
      tester: 'general-purpose',
      reviewer: 'general-purpose',
      researcher: 'Explore',
      executor: 'general-purpose'
    };

    return mapping[agentType] || 'general-purpose';
  }

  /**
   * 判断任务是否需要隔离执行
   */
  private needsIsolation(task: Task): boolean {
    // Coder 和 Executor 任务可能修改文件，建议隔离
    const isolationTypes: AgentType[] = ['coder', 'executor'];
    return isolationTypes.includes(task.assignedAgent);
  }

  /**
   * 构建完整的执行提示词
   */
  async buildExecutionPrompt(task: Task): Promise<string> {
    const agentPrompt = this.buildAgentPrompt(task);
    const phaseContext = this.buildPhaseContext(task);
    const accumulatedContext = await this.buildAccumulatedContext(task);

    return `# 任务执行

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 优先级: ${task.priority}
- 超时: ${task.timeout / 1000} 秒

## 当前阶段
${phaseContext}

## 依赖任务
${task.dependencies.length > 0
  ? task.dependencies.map(d => `- ${d}`).join('\n')
  : '无依赖'}

${accumulatedContext}

---

${agentPrompt.context}

---

${agentPrompt.instructions}

## 完成要求

1. 将执行结果写入: \`.openmatrix/tasks/${task.id}/artifacts/result.md\`
   （任务状态由 openmatrix complete 命令管理，请勿直接修改 task.json）
2. 如需审批，创建审批请求: \`.openmatrix/approvals/\` 目录

注意: 任务完成后，由 Skill 调用 \`openmatrix complete\` 并传入 --summary 参数，
该摘要会自动追加到全局 \`.openmatrix/context.md\` 供后续 Agent 参考。
`;
  }

  /**
   * 构建累积上下文 - 从全局 context.md 读取前序 Agent 的决策和知识
   */
  private async buildAccumulatedContext(currentTask: Task): Promise<string> {
    const omPath = path.join(process.cwd(), '.openmatrix');
    const contextFile = path.join(omPath, 'context.md');

    try {
      const content = await fs.readFile(contextFile, 'utf-8');
      const trimmed = content.trim();
      if (!trimmed) return '';

      return `
## 前序 Agent 共享上下文 (Agent Memory)

以下是之前执行的 Agent 留下的上下文信息，包含它们的决策、发现和注意事项。
你应该基于这些信息来工作，避免重复犯错或与已有决策冲突。

${trimmed}
`;
    } catch {
      return '';
    }
  }

  /**
   * 构建阶段上下文
   */
  private buildPhaseContext(task: Task): string {
    const phases = task.phases;
    const currentPhase = this.getCurrentPhase(task);

    return `当前阶段: **${currentPhase}**
- 开发阶段: ${phases.develop.status}
- 验证阶段: ${phases.verify.status}
- 验收阶段: ${phases.accept.status}`;
  }

  /**
   * 获取当前阶段
   */
  private getCurrentPhase(task: Task): string {
    const phases = task.phases;

    if (phases.develop.status !== 'completed') return '开发 (Develop)';
    if (phases.verify.status !== 'completed') return '验证 (Verify)';
    if (phases.accept.status !== 'completed') return '验收 (Accept)';

    return '已完成';
  }

  /**
   * 执行任务 - 返回 Subagent 调用提示 (向后兼容)
   * @deprecated 使用 prepareSubagentTask() 代替
   */
  async runTask(task: Task): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 准备 Subagent 任务
      const subagentTask = await this.prepareSubagentTask(task);

      // 返回结果配置
      const result: AgentResult = {
        runId: await this.generateRunId(),
        taskId: task.id,
        agentType: task.assignedAgent,
        status: 'completed',
        output: `Subagent task prepared. Use Agent tool with:\n${JSON.stringify({
          subagent_type: subagentTask.subagent_type,
          description: subagentTask.description,
          prompt: subagentTask.prompt.substring(0, 200) + '...'
        }, null, 2)}`,
        artifacts: [],
        needsApproval: subagentTask.needsApproval,
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
   * 构建任务上下文 (增强版: 注入用户上下文)
   */
  private buildContext(task: Task): string {
    const parts: string[] = [];

    parts.push(`
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
`);

    // 注入用户上下文
    if (this.userContext.objective) {
      parts.push(`
## 整体目标

${this.userContext.objective}
`);
    }

    if (this.userContext.techStack && this.userContext.techStack.length > 0) {
      parts.push(`
## 技术栈要求

${this.userContext.techStack.map(t => `- ${t}`).join('\n')}
`);
    }

    if (this.userContext.testCoverage) {
      parts.push(`
## 测试要求

覆盖率要求: ${this.userContext.testCoverage}
`);
    }

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
## 验收标准

${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`);
    }

    return parts.join('\n');
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
   * Coder Agent 提示词 (增强版)
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

## 编码规范

### 代码质量
- 遵循 SOLID 原则
- 使用有意义的变量名和函数名
- 保持函数简短，单一职责
- 避免重复代码 (DRY)

### 错误处理
- 验证所有输入参数
- 使用 try-catch 处理异常
- 提供有意义的错误信息
- 记录错误日志

### 安全性
- 不硬编码敏感信息
- 验证用户输入
- 使用参数化查询
- 遵循最小权限原则

### 性能
- 避免不必要的循环
- 使用高效的数据结构
- 考虑内存使用
- 异步处理耗时操作

## 输出要求

- 代码文件路径清晰
- 遵循现有代码风格
- 添加必要的错误处理
- 考虑性能和安全性

## 注意事项

- 不要破坏现有功能
- 保持向后兼容
- 使用项目已有的工具函数
- 每个函数添加简短注释说明用途

## 完成检查清单

- [ ] 代码可编译
- [ ] 边界情况已处理
- [ ] 错误处理完善
- [ ] 无安全隐患
- [ ] 代码风格一致
`;
  }

  /**
   * Tester Agent 提示词 (增强版)
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

## 测试原则

### AAA 模式
每个测试用例遵循 Arrange-Act-Assert 模式:
\`\`\`typescript
describe('MyFunction', () => {
  it('should do something', () => {
    // Arrange - 准备测试数据
    const input = 'test';

    // Act - 执行被测试的函数
    const result = myFunction(input);

    // Assert - 验证结果
    expect(result).toBe('expected');
  });
});
\`\`\`

### 测试覆盖
- **正常流程**: 主要功能路径
- **边界情况**: 空值、极值、特殊字符
- **异常处理**: 错误输入、网络失败
- **并发场景**: 竞态条件 (如适用)

### 命名规范
- 测试文件: \`.test.ts\` 或 \`.spec.ts\`
- 描述清晰: \`it('should return user when id exists')\`
- 使用 describe 分组相关测试

## 必须测试的场景

1. **基本功能**: 每个公开方法至少一个测试
2. **输入验证**: 无效输入、空值、边界值
3. **错误处理**: 异常抛出、错误返回
4. **状态变化**: 修改操作的前后状态

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
- 行: W%

## 测试用例清单
| 用例 | 描述 | 状态 |
|-----|------|------|
| 1   | ...  | ✅   |

## 问题列表
1. [问题描述]
\`\`\`

## 完成检查清单

- [ ] 所有公开方法已测试
- [ ] 边界情况已覆盖
- [ ] 异常处理已验证
- [ ] 测试全部通过
- [ ] 覆盖率达标
`;
  }

  /**
   * Reviewer Agent 提示词 (增强版)
   */
  private getReviewerPrompt(task: Task): string {
    return `
你是一个 Reviewer Agent，负责代码审查。

## 审查流程

### 1. 代码质量审查
- **可读性**: 命名清晰、逻辑直观、注释适当
- **可维护性**: 模块化、低耦合、单一职责
- **复杂度**: 避免过深的嵌套、圈复杂度合理

### 2. 最佳实践审查
- **设计模式**: 是否正确使用设计模式
- **代码复用**: 是否存在重复代码
- **错误处理**: 异常处理是否完善
- **类型安全**: TypeScript 类型定义是否准确

### 3. 安全性审查
- **输入验证**: 所有外部输入是否验证
- **敏感数据**: 是否有敏感信息泄露风险
- **权限控制**: 访问控制是否正确
- **注入风险**: SQL/XSS/命令注入检查

### 4. 性能审查
- **算法效率**: 时间复杂度是否合理
- **资源使用**: 内存、文件句柄是否正确释放
- **潜在瓶颈**: 是否有性能问题
- **异步处理**: 异步操作是否正确

### 5. 测试审查
- **覆盖率**: 测试是否充分
- **边界情况**: 边界条件是否测试
- **Mock 使用**: 是否正确使用 Mock

## 严重程度定义

| 级别 | 说明 | 处理方式 |
|-----|------|---------|
| **Critical** | 安全漏洞、数据丢失风险 | 必须立即修复 |
| **High** | 功能缺陷、性能问题 | 本次必须修复 |
| **Medium** | 代码质量、可维护性 | 建议修复 |
| **Low** | 代码风格、优化建议 | 可选修复 |

## 输出格式

\`\`\`markdown
# 代码审查报告

## 总体评价
[通过/需要修改/拒绝]

## 统计
- 文件数: X
- 问题数: Critical(Y), High(Z), Medium(W), Low(V)

## 问题列表
| 严重程度 | 文件 | 行号 | 问题描述 | 建议 |
|---------|------|------|---------|------|
| High    | x.ts | 10   | ...     | ...  |

## 亮点
1. [值得肯定的实现]

## 建议
1. [改进建议]
\`\`\`

## 审查检查清单

- [ ] 代码可读性良好
- [ ] 无安全漏洞
- [ ] 错误处理完善
- [ ] 性能可接受
- [ ] 测试覆盖充分
- [ ] 无重复代码
- [ ] 符合项目规范
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
