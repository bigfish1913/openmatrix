// src/orchestrator/phase-executor.ts
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { AgentRunner, type SubagentTask, type UserContext } from '../agents/agent-runner.js';
import { GitCommitManager } from './git-commit-manager.js';
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
 *
 * 在 auto 模式下 (isAutoMode=true):
 * - 阶段间自动流转，无需确认
 * - 仅在失败/异常时暂停
 */
export class PhaseExecutor {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private agentRunner: AgentRunner;
  private gitCommitManager: GitCommitManager;
  private isAutoMode: boolean = false;
  private runId: string = '';
  private userContext: UserContext = {};
  private minTestCoverage: number = 60; // 默认最低覆盖率 60%

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.agentRunner = new AgentRunner(stateManager, approvalManager);
    this.gitCommitManager = new GitCommitManager();
  }

  /**
   * 设置自动模式
   */
  setAutoMode(auto: boolean): void {
    this.isAutoMode = auto;
  }

  /**
   * 获取自动模式状态
   */
  getAutoMode(): boolean {
    return this.isAutoMode;
  }

  /**
   * 设置 Run ID (用于提交信息)
   */
  setRunId(runId: string): void {
    this.runId = runId;
  }

  /**
   * 设置用户上下文
   */
  setUserContext(context: UserContext): void {
    this.userContext = context;
    this.agentRunner.setUserContext(context);

    // 从用户上下文解析覆盖率要求
    if (context.testCoverage) {
      const match = context.testCoverage.match(/(\d+)/);
      if (match) {
        this.minTestCoverage = parseInt(match[1], 10);
      }
    }
  }

  /**
   * 设置最低测试覆盖率
   */
  setMinTestCoverage(coverage: number): void {
    this.minTestCoverage = coverage;
  }

  /**
   * 获取最低测试覆盖率
   */
  getMinTestCoverage(): number {
    return this.minTestCoverage;
  }

  /**
   * 设置是否启用自动提交
   */
  setAutoCommit(enabled: boolean): void {
    this.gitCommitManager.setEnabled(enabled);
  }

  /**
   * 获取 GitCommitManager 实例
   */
  getGitCommitManager(): GitCommitManager {
    return this.gitCommitManager;
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
   * 构建开发阶段提示词 (增强版: 注入验收标准和用户上下文)
   */
  private buildDevelopPrompt(task: Task): string {
    const parts: string[] = [];

    parts.push(`# 开发阶段 (Develop Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 优先级: ${task.priority}`);

    // 注入用户上下文
    if (this.userContext.objective) {
      parts.push(`
## 整体目标
${this.userContext.objective}`);
    }

    if (this.userContext.techStack && this.userContext.techStack.length > 0) {
      parts.push(`
## 技术栈要求
${this.userContext.techStack.map(t => `- ${t}`).join('\n')}`);
    }

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
## 验收标准 (必须全部满足)
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
    }

    parts.push(`
## 开发要求
1. 根据任务描述编写代码
2. 遵循项目代码规范
3. 编写必要的注释
4. 处理边界情况和错误
5. 确保代码可编译

## 编码规范
- 遵循 SOLID 原则
- 使用有意义的变量名和函数名
- 保持函数简短，单一职责
- 避免重复代码 (DRY)
- 验证所有输入参数
- 处理所有异常情况

## 输出要求
完成后，在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`result.md\` - 实现说明
- \`changes.txt\` - 变更文件列表

## 完成检查清单
- [ ] 代码可编译
- [ ] 边界情况已处理
- [ ] 错误处理完善
- [ ] 无安全隐患
- [ ] 代码风格一致
- [ ] 验收标准全部满足
`);
    return parts.join('\n');
  }

  /**
   * 构建验证阶段提示词 (增强版: 严格测试和覆盖率要求)
   */
  private buildVerifyPrompt(task: Task): string {
    const parts: string[] = [];

    parts.push(`# 验证阶段 (Verify Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}

## 验证目标
1. **代码审查 (Code Review)** - 代码质量和最佳实践
2. **运行测试 (Run Tests)** - 单元测试和集成测试
3. **Build 测试 (Build Check)** - 编译和打包验证
4. **覆盖率检查 (Coverage Check)** - 确保测试覆盖率达标`);

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
## 验收标准验证
必须验证以下标准已满足:
${task.acceptanceCriteria.map((c, i) => `${i + 1}. [ ] ${c}`).join('\n')}`);
    }

    parts.push(`
## 代码审查要点
- 可读性和可维护性
- 设计模式使用
- 错误处理
- 安全性检查
- 性能考量

## 自动化验证命令

### 1. 编译检查 (必须通过)
\`\`\`bash
npm run build
\`\`\`
**预期**: 无编译错误

### 2. 静态分析
\`\`\`bash
npm run lint || echo "No lint script configured"
\`\`\`
**预期**: 无严重错误 (允许 warning)

### 3. 依赖验证
\`\`\`bash
npm ci --dry-run 2>/dev/null || npm install --dry-run 2>/dev/null || echo "Dependency check skipped"
\`\`\`
**预期**: 依赖可正常安装

### 4. 运行测试 (必须通过)
\`\`\`bash
npm test
\`\`\`
**预期**: 所有测试通过

### 5. 测试覆盖率检查
\`\`\`bash
npm test -- --coverage 2>/dev/null || npm run test:coverage 2>/dev/null || echo "Coverage check skipped"
\`\`\`
**最低覆盖率要求**: ${this.minTestCoverage}%

## 验证报告格式

在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:

### verify-report.md
\`\`\`markdown
# 验证报告

## 任务信息
- Task ID: ${task.id}
- 标题: ${task.title}
- 验证时间: [当前时间]

## 验证结果

### 1. 编译检查
- 状态: ✅ 通过 / ❌ 失败
- 详情: [编译输出摘要]

### 2. 静态分析
- 状态: ✅ 通过 / ⚠️ 警告 / ❌ 失败
- 问题数: [数量]
- 详情: [lint 输出摘要]

### 3. 依赖验证
- 状态: ✅ 通过 / ❌ 失败
- 详情: [依赖检查结果]

### 4. 测试结果
- 状态: ✅ 通过 / ❌ 失败
- 通过: [数量]
- 失败: [数量]
- 跳过: [数量]

### 5. 覆盖率
- 语句: X%
- 分支: Y%
- 函数: Z%
- 行: W%
- **是否达标**: ✅ (>= ${this.minTestCoverage}%) / ❌ (< ${this.minTestCoverage}%)

### 6. 验收标准检查
${task.acceptanceCriteria?.map((c, i) => `${i + 1}. [✅/❌] ${c}`).join('\n') || '无验收标准'}

## 总结
[✅ 所有检查通过 / ❌ 存在问题需要修复]

## 问题列表 (如有)
1. [问题描述]
2. [问题描述]
\`\`\`

## 最终输出

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

## 严格检查要求
- ⚠️ 编译失败 = 验证失败
- ⚠️ 测试失败 = 验证失败
- ⚠️ 覆盖率 < ${this.minTestCoverage}% = 验证失败 (警告，可继续)
- ⚠️ 验收标准未满足 = 验证失败

## 注意事项
- 确保所有修改的文件都已保存
- 测试失败时，记录失败原因
- 不要跳过任何验证步骤
- 如果项目没有配置某个脚本，标记为"跳过"而非"失败"
`);
    return parts.join('\n');
  }

  /**
   * 构建验收阶段提示词 (增强版: 验收标准检查)
   */
  private buildAcceptPrompt(task: Task): string {
    const parts: string[] = [];

    parts.push(`# 验收阶段 (Accept Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}`);

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
## 验收标准 (必须全部满足)
${task.acceptanceCriteria.map((c, i) => `${i + 1}. [ ] ${c}`).join('\n')}`);
    }

    parts.push(`
## 验收检查清单
- [ ] 功能演示/验证
- [ ] 测试报告 (verify-report.md 已生成)
- [ ] 代码审查通过
- [ ] 文档已更新 (如需要)
- [ ] 所有验收标准已满足

## 验收流程

### 1. 检查验证阶段结果
读取 \`.openmatrix/tasks/${task.id}/artifacts/verify-report.md\`
确认所有检查项已通过

### 2. 验证验收标准
逐项检查验收标准是否满足

### 3. 最终确认
- 确认代码可以合并
- 确认无遗留问题

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
2. [建议]
\`\`\`

如果验收失败，输出:
\`\`\`
ACCEPT_FAILED
失败原因:
1. [原因]
\`\`\`
`);
    return parts.join('\n');
  }

  /**
   * 处理阶段结果
   *
   * 在 auto 模式下:
   * - 自动进入下一阶段，needsApproval = false
   * - 仅在失败时暂停
   * - 自动提交代码 (如果启用)
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
      // auto 模式下不需要审批，仅在 accept 阶段且非 auto 模式时需要
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
        // 仅在非 auto 模式下需要审批
        needsApproval = !this.isAutoMode;
      } else if (phase === 'accept') {
        updates.status = 'completed';
      }

      await this.stateManager.updateTask(task.id, updates);

      // 自动提交代码
      if (this.runId) {
        try {
          const commitResult = await this.gitCommitManager.commit({
            taskId: task.id,
            taskTitle: task.title,
            runId: this.runId,
            phase,
            changes: [],
            impactScope: []
          });

          if (commitResult.success) {
            console.log(`✅ Git 提交成功: ${commitResult.commitHash}`);
          } else if (commitResult.message !== 'No changes to commit') {
            console.log(`⚠️ Git 提交跳过: ${commitResult.message || commitResult.error}`);
          }
        } catch (error) {
          console.error(`❌ Git 提交失败: ${error}`);
        }
      }

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
        // 失败时总是需要审批/确认
        needsApproval: true
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
