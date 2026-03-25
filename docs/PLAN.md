# OpenMatrix 实现计划 v2

> 基于差距分析生成的增量实现计划

## 用户选择

| 选项 | 选择 | 说明 |
|------|------|------|
| 优先级 | D - 全部按优先级依次 | 从核心到体验依次处理 |
| Agent 执行 | B - Claude Code Agent 工具 | 使用 Subagent 执行任务 |
| 架构调整 | A - 增量添加 | 保持现有结构 |
| 状态同步 | Skills 主动读取 | 无需主动同步机制 |
| 测试覆盖 | A - >80% | 严格测试要求 |

---

## 差距摘要

| 优先级 | 差距 | 当前状态 | 目标状态 |
|--------|------|----------|----------|
| 🔴 P0 | Agent 真正执行 | 返回空模板 | 调用 Subagent |
| 🔴 P0 | 执行循环缺失 | 单次操作 | 持续调度执行 |
| 🟡 P1 | 三阶段验证 | 状态定义 | 实际执行逻辑 |
| 🟡 P1 | Build 测试 | 缺失 | 完整实现 |
| 🟡 P1 | 全功能测试 | 缺失 | 完整流程 |
| 🟢 P2 | Winston 日志 | 未使用 | 集成使用 |
| 🟢 P2 | 阻塞 Meeting | 手动 | 自动创建 |
| 🟢 P2 | 体验优化 | 基础 | 增强交互 |

---

## Phase 1: Agent 执行层 (核心)

**目标**: 让 Agent 真正通过 Subagent 执行任务

### 1.1 AgentRunner 重构

**文件**: `src/agents/agent-runner.ts`

**修改内容**:
```typescript
// 当前: 返回空模板
// 目标: 返回 Subagent 调用所需的完整信息

interface SubagentTask {
  subagent_type: 'general-purpose' | 'Explore' | 'Plan';
  description: string;
  prompt: string;
  isolation?: 'worktree';
}

async prepareSubagentTask(task: Task): Promise<SubagentTask> {
  return {
    subagent_type: this.mapAgentType(task.assignedAgent),
    description: `${task.assignedAgent}: ${task.title}`,
    prompt: this.buildExecutionPrompt(task),
    isolation: task.requiresIsolation ? 'worktree' : undefined
  };
}
```

**任务列表**:
- [ ] 重构 `runTask()` 返回 SubagentTask 数据
- [ ] 实现 `mapAgentType()` 映射到 Claude Code Agent 类型
- [ ] 增强 `buildExecutionPrompt()` 包含完整上下文
- [ ] 添加任务隔离配置 (worktree)
- [ ] 编写单元测试 (覆盖率 >80%)

### 1.2 Agent 类型映射

| OpenMatrix Agent | Claude Code Subagent | 说明 |
|------------------|---------------------|------|
| planner | Plan | 任务规划 |
| coder | general-purpose | 代码编写 |
| tester | general-purpose | 测试执行 |
| reviewer | general-purpose | 代码审查 |
| researcher | Explore | 知识检索 |
| executor | general-purpose | 命令执行 |

### 1.3 验收标准

- [ ] `AgentRunner.prepareSubagentTask()` 返回完整 Subagent 配置
- [ ] 所有 6 种 Agent 类型正确映射
- [ ] 提示词包含任务上下文、约束、预期输出
- [ ] 单元测试覆盖率 >80%

---

## Phase 2: 执行循环 (核心)

**目标**: 实现持续调度和执行的 main loop

### 2.1 Orchestrator 主循环

**新文件**: `src/orchestrator/executor.ts`

```typescript
export class OrchestratorExecutor {
  private scheduler: Scheduler;
  private agentRunner: AgentRunner;
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;

  async run(): Promise<void> {
    while (await this.hasPendingWork()) {
      // 1. 检查审批点
      if (await this.needsApproval()) {
        await this.pauseForApproval();
        continue;
      }

      // 2. 获取可执行任务
      const tasks = await this.scheduler.getParallelTasks();

      // 3. 返回 Subagent 任务列表 (由 Skills 执行)
      if (tasks.length > 0) {
        return this.emitSubagentTasks(tasks);
      }

      // 4. 等待或结束
      await this.waitForNextTick();
    }
  }
}
```

### 2.2 Skills 集成

**修改文件**: `skills/start.md`, `skills/resume.md`

**流程**:
```
/om:start → CLI 生成任务列表 → Skills 读取 → 展示计划 → 确认
     ↓
Skills 逐个调用 Agent 工具执行 Subagent
     ↓
每个 Subagent 完成后更新状态文件
     ↓
Skills 读取状态，决定下一步
```

### 2.3 任务列表

- [ ] 创建 `OrchestratorExecutor` 类
- [ ] 实现 `run()` 主循环
- [ ] 实现 `getSubagentTasks()` 获取待执行任务
- [ ] 修改 `/om:start` 读取并执行 Subagent
- [ ] 修改 `/om:resume` 恢复执行流程
- [ ] 添加执行状态持久化
- [ ] 编写集成测试

### 2.4 验收标准

- [ ] `/om:start` 后能持续执行直到完成或需要审批
- [ ] `/om:resume` 能从断点恢复
- [ ] 并行任务正确调度
- [ ] 审批点正确触发暂停

---

## Phase 3: 三阶段验证 (重要)

**目标**: 实现 develop → verify → accept 完整流程

### 3.1 阶段执行器

**新文件**: `src/orchestrator/phase-executor.ts`

```typescript
export class PhaseExecutor {
  async executePhase(task: Task, phase: 'develop' | 'verify' | 'accept'): Promise<PhaseResult> {
    switch (phase) {
      case 'develop':
        return this.executeDevelop(task);
      case 'verify':
        return this.executeVerify(task);
      case 'accept':
        return this.executeAccept(task);
    }
  }

  private async executeVerify(task: Task): Promise<PhaseResult> {
    // 1. 代码审查 (Reviewer Agent)
    // 2. 运行测试 (Tester Agent)
    // 3. 构建检查 (Executor Agent)
    return { passed: true, report: '...' };
  }
}
```

### 3.2 Build 测试

**要求** (来自 require.md 4.3):
- 编译检查: `npm run build`
- 静态分析: ESLint
- 依赖验证: `npm ci`
- 打包测试: `npm pack`

### 3.3 任务列表

- [ ] 创建 `PhaseExecutor` 类
- [ ] 实现 `executeDevelop()` - 调用 Coder Agent
- [ ] 实现 `executeVerify()` - 调用 Reviewer + Tester
- [ ] 实现 `executeAccept()` - 最终验收
- [ ] 添加 Build 测试逻辑
- [ ] 生成阶段报告
- [ ] 编写测试

### 3.4 验收标准

- [ ] 每个任务经历完整三阶段
- [ ] 阶段失败时正确回退
- [ ] Build 测试自动执行
- [ ] 阶段报告清晰

---

## Phase 4: 全功能测试 (重要)

**目标**: 实现 require.md 第 8 节的完整测试流程

### 4.1 测试流程

```
环境检查 → 单元测试聚合 → 集成测试 → E2E测试 → 回归测试 → 报告
```

### 4.2 新文件

**`src/orchestrator/full-test-runner.ts`**

```typescript
export class FullTestRunner {
  async runFullTest(): Promise<FullTestReport> {
    const results = {
      environment: await this.checkEnvironment(),
      unitTests: await this.aggregateUnitTests(),
      integration: await this.runIntegrationTests(),
      e2e: await this.runE2ETests(),
      regression: await this.runRegressionTests()
    };

    return this.generateReport(results);
  }
}
```

### 4.3 完成标志检查

```typescript
interface CompletionCriteria {
  allTasksCompleted: boolean;
  fullTestPassed: boolean;
  noPendingApprovals: boolean;
  docsUpdated: boolean;
  artifactsVerified: boolean;
}
```

### 4.4 任务列表

- [ ] 创建 `FullTestRunner` 类
- [ ] 实现环境检查
- [ ] 实现单元测试聚合
- [ ] 实现集成测试
- [ ] 实现回归测试
- [ ] 实现完成标志检查
- [ ] 生成测试报告
- [ ] 添加 `/om:verify` Skill 支持

### 4.5 验收标准

- [ ] 全功能测试自动执行
- [ ] 测试报告清晰完整
- [ ] 完成标志正确判断

---

## Phase 5: 体验优化 (增强)

**目标**: 提升用户交互体验

### 5.1 进度可视化

**位置**: Skills 输出

```
📋 执行进度
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 60%

┌─────────────┐
│ TASK-001 ✅ │ ──┐
└─────────────┘   │
┌─────────────┐   ▼
│ TASK-002 🔄 │ ──┬──▶ TASK-004 (等待)
└─────────────┘   │
┌─────────────┐   │
│ TASK-003 ✅ │ ──┘
└─────────────┘
```

### 5.2 智能重试建议

```markdown
❌ TASK-002 执行失败

原因: Agent 超时 (120s)

建议:
[1] 增加超时到 180s
[2] 拆分为更小的子任务
[3] 跳过此任务
```

### 5.3 增强报告

```markdown
# 执行报告

## 📊 统计
- 总耗时: 2h 15m
- Agent 调用: 12 次
- 重试次数: 2 次
- 成功率: 87.5%

## 🏆 效率分析
- 并行度: 2.3 (目标: 3)
- 建议: 增加并发数可提升 30% 效率
```

### 5.4 任务列表

- [ ] 添加进度条渲染函数
- [ ] 添加依赖图 ASCII 渲染
- [ ] 实现智能重试建议
- [ ] 增强报告模板
- [ ] 添加效率分析

---

## Phase 6: 日志和监控 (完善)

**目标**: 集成 Winston 日志系统

### 6.1 日志配置

**新文件**: `src/utils/logger.ts`

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '.openmatrix/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: '.openmatrix/logs/combined.log' })
  ]
});
```

### 6.2 任务列表

- [ ] 创建 Logger 工具类
- [ ] 集成到 Orchestrator
- [ ] 集成到 AgentRunner
- [ ] 集成到 StateManager
- [ ] 添加日志级别配置

---

## Phase 7: 阻塞问题处理 (完善)

**目标**: 自动创建 Meeting 任务处理阻塞

### 7.1 Meeting 任务自动创建

```typescript
async handleBlockedTask(task: Task, reason: string): Promise<Meeting> {
  // 1. 创建 Meeting 任务
  const meeting = await this.stateManager.createMeeting({
    taskId: task.id,
    reason,
    participants: ['user'],
    status: 'pending'
  });

  // 2. 更新任务状态
  await this.scheduler.markTaskWaiting(task.id);

  // 3. 创建审批请求
  await this.approvalManager.createMeetingApproval(meeting);

  return meeting;
}
```

### 7.2 任务列表

- [ ] 实现 `handleBlockedTask()`
- [ ] 添加 Meeting 数据模型
- [ ] 修改 StateMachine 触发 Meeting 创建
- [ ] 添加 `/om:approve meeting` 支持

---

## 测试计划

### 单元测试 (目标: >80%)

| 模块 | 测试文件 | 覆盖目标 |
|------|----------|----------|
| AgentRunner | `tests/agents/agent-runner.test.ts` | 85% |
| OrchestratorExecutor | `tests/orchestrator/executor.test.ts` | 85% |
| PhaseExecutor | `tests/orchestrator/phase-executor.test.ts` | 85% |
| FullTestRunner | `tests/orchestrator/full-test-runner.test.ts` | 80% |

### 集成测试

- [ ] 完整任务执行流程
- [ ] 审批点触发和恢复
- [ ] 重试机制
- [ ] 三阶段验证

---

## 执行统计

```yaml
总任务数: 45
预计周期: 4-5 周
审批点: plan, merge

Phase 1: Agent 执行层 - 7 个任务
Phase 2: 执行循环 - 7 个任务
Phase 3: 三阶段验证 - 7 个任务
Phase 4: 全功能测试 - 8 个任务
Phase 5: 体验优化 - 5 个任务
Phase 6: 日志监控 - 5 个任务
Phase 7: 阻塞处理 - 4 个任务
```

---

## 下一步

确认此计划后，执行顺序:

1. **Phase 1**: AgentRunner 重构 → 让 Subagent 能真正执行
2. **Phase 2**: 执行循环 → Skills 能驱动持续执行
3. **Phase 3-4**: 验证和测试 → 完整质量保证
4. **Phase 5-7**: 体验和完善 → 提升可用性

是否开始执行?
