# OpenMatrix: AI Agent 任务编排系统规范

本文档定义了基于 Claude API 的多 Agent 协作任务编排系统的完整规范，实现任务从接收、拆解、执行到完成的全自动化流程。

---

## 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 人工介入级别 | 关键节点确认 | AI 自主决策执行，仅在关键决策点需人工确认 |
| 底层模型 | Claude API | 长上下文，强 Tool Use 能力 |
| 协作模式 | 中央调度 | 一个 Orchestrator Agent 负责分配任务，任务边界清晰 |
| 持久化 | 文件系统 | JSON/Markdown 存储，简单、可读、Git 友好 |
| 确认机制 | Claude Code Skills | 通过对话式交互收集确认 |
| 架构 | Skills + CLI | Skills 作为用户交互层，CLI 作为调度核心 |

---

## 1. 系统架构

### 1.1 架构概览

```
┌────────────────────────────────────────────────────────────────────┐
│                          用户层                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Claude Code 主会话                         │  │
│  │  Skills: /om:start  /om:status  /om:approve  /om:resume     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                        调度层 (Orchestrator)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   openmatrix CLI                              │  │
│  │  - 任务解析器 (Parser)                                        │  │
│  │  - 任务拆解器 (Planner)                                       │  │
│  │  - 调度引擎 (Scheduler)                                       │  │
│  │  - 状态机 (StateMachine)                                      │  │
│  │  - 确认管理器 (ApprovalManager)                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                        执行层 (Agents)                              │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │ Planner│ │ Coder  │ │ Tester │ │Reviewer│ │Research│ │Executor││
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘│
│      │          │          │          │          │          │      │
│      └──────────┴──────────┴──────────┴──────────┴──────────┘      │
│                              │                                      │
│                    Claude API 子进程调用                            │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│                        存储层 (Storage)                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  .openmatrix/                                                 │  │
│  │  ├─ state.json           # 全局状态                           │  │
│  │  ├─ tasks/               # 任务目录                           │  │
│  │  ├─ agents/              # Agent 执行记录                     │  │
│  │  ├─ approvals/           # 人工确认记录                       │  │
│  │  └─ logs/                # 执行日志                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 组件职责

| 层级 | 组件 | 职责 |
|------|------|------|
| 用户层 | Claude Code Skills | 用户交互入口，展示状态，收集确认 |
| 调度层 | Orchestrator CLI | 任务调度、状态管理、Agent 编排 |
| 执行层 | Worker Agents | 执行具体任务，产出结果 |
| 存储层 | File System | 持久化状态，支持恢复 |

---

## 2. 六种 Worker Agent

| Agent | 职责 | 输入 | 输出 | Tools |
|-------|------|------|------|-------|
| **Planner** | 任务拆解、计划制定 | 任务文档、用户答案 | 任务列表、依赖图 | Read, Write |
| **Coder** | 代码编写、重构 | 任务描述、现有代码 | 代码文件、变更说明 | Read, Write, Edit, Bash |
| **Tester** | 测试用例、执行测试 | 代码文件、测试要求 | 测试报告、覆盖率 | Read, Write, Bash |
| **Reviewer** | 代码审查、质量检查 | 代码文件、规范文档 | 审查报告、问题列表 | Read, Grep, Glob |
| **Researcher** | 搜索资料、知识检索 | 问题、关键词 | 研究报告、参考资料 | WebSearch, WebFetch, Read |
| **Executor** | 执行命令、文件操作 | 命令列表、操作说明 | 执行结果、日志 | Bash, Read, Write |

### 2.1 Agent 并行执行

```
┌─────────────┐
│ Orchestrator│ (独立进程，不受上下文限制)
└──────┬──────┘
       │
  ┌────┼────┬────────┐
  ▼    ▼    ▼        ▼
Agent1 Agent2 Agent3 Agent4  (同时运行，各自独立上下文)
```

---

## 3. 任务准备阶段

### 3.1 读取任务目标
- 解析任务来源文档，提取核心目标
- 识别任务边界和约束条件
- 确认交付物清单

### 3.2 生成问题及答案选项
- 基于任务文档生成关键澄清问题
- 为每个问题提供预设答案选项
- 支持自定义答案输入
- 记录问题选择结果，作为后续决策依据

### 3.3 问题示例

| 问题 | 选项 |
|------|------|
| 使用哪种 AI 模型？ | A. Claude (Anthropic) / B. GPT-4 (OpenAI) / C. 本地模型 |
| Agent 协作模式？ | A. 中央调度 / B. 链式协作 / C. 对等协作 / D. 混合模式 |
| 人工确认级别？ | A. 每步确认 / B. 关键节点确认 / C. 仅失败时确认 / D. 完全自动化 |
| 状态持久化方式？ | A. 文件系统 / B. SQLite / C. PostgreSQL / D. 文件 + 数据库混合 |

---

## 4. 任务拆解阶段

### 4.1 任务结构定义

每个子任务必须包含以下要素：

| 字段 | 说明 | 必填 |
|------|------|------|
| `id` | 任务唯一标识 | ✅ |
| `title` | 任务标题，简洁明确 | ✅ |
| `description` | 任务描述，说明目标 | ✅ |
| `details` | 详细说明文档/链接 | ✅ |
| `timeout` | 超时时间（分钟） | ✅ |
| `dependencies` | 依赖的前置任务 | ❌ |
| `priority` | 优先级（P0-P3） | ❌ |
| `assignedAgent` | 分配的 Agent 类型 | ✅ |

### 4.2 三阶段验收流程

每个任务**必须**包含以下三个过程：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   开发阶段   │ -> │   验证阶段   │ -> │   验收阶段   │
│  (Develop)  │    │ (Verify)    │    │ (Accept)    │
└─────────────┘    └─────────────┘    └─────────────┘
```

#### 开发阶段 (Develop)
- 编写功能代码
- 单元测试编写
- 代码自审
- 本地调试通过

#### 验证阶段 (Verify)
- 代码审查 (Code Review)
- 集成测试
- 构建测试 (Build Test)
- 覆盖率检查

#### 验收阶段 (Accept)
- 功能演示/验证
- 文档更新
- 验收签字确认
- 合并到主分支

### 4.3 Build 测试要求

每个任务必须包含构建测试：
- **编译检查**：确保代码可编译
- **静态分析**：代码质量检查
- **依赖验证**：依赖包完整性
- **打包测试**：产出物构建验证

---

## 5. 任务执行阶段

### 5.1 执行流程

```
开始任务 -> 更新状态为[进行中] -> 执行开发 -> 执行验证 -> 执行验收 -> 更新状态为[已完成]
```

### 5.2 状态流转

```
pending → scheduled → in_progress → verify → accept → completed
              │            │           │        │
              │            ▼           ▼        ▼
              │        blocked      failed   failed
              │            │           │        │
              │            ▼           └────────┘
              │        waiting              │
              │            │                ▼
              └────────────┴──────────► retry_queue
```

| 状态 | 说明 | 后续动作 |
|------|------|----------|
| `pending` | 等待执行 | 等待调度 |
| `scheduled` | 已调度 | 等待 Agent 分配 |
| `in_progress` | 执行中 | 正常执行 |
| `blocked` | 被阻塞 | 等待依赖解除 |
| `waiting` | 等待外部 | 等待外部资源 |
| `verify` | 验证中 | 执行验证阶段 |
| `accept` | 验收中 | 执行验收阶段 |
| `completed` | 已完成 | 进入下一任务 |
| `failed` | 失败 | 记录到重试队列 |
| `retry_queue` | 重试队列 | 等待重试 |

---

## 6. 关键节点确认机制

### 6.1 确认点配置

```json
{
  "approvalPoints": ["plan", "merge", "deploy"]
}
```

| 确认点 | 触发时机 | 确认内容 |
|--------|---------|---------|
| `plan` | 任务拆解完成后 | 任务计划、依赖关系 |
| `merge` | 代码合并前 | 代码变更、测试结果 |
| `deploy` | 部署前 | 部署环境、配置 |

### 6.2 确认流程

```
1. Agent 到达确认点
2. 创建 Approval 记录
3. 暂停执行，等待人工确认
4. 用户通过 /om:approve 处理确认
5. 根据决策继续执行或回滚
```

### 6.3 确认选项

| 选项 | 说明 |
|------|------|
| `approve` | 批准，继续执行 |
| `modify` | 需要修改，返回修改 |
| `reject` | 拒绝，终止任务 |

---

## 7. 异常处理与重试

### 7.1 异常分类

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| `AgentTimeout` | Agent 执行超时 | 记录日志，加入重试队列 |
| `AgentError` | Agent 执行出错 | 记录错误详情，加入重试队列 |
| `TaskBlocked` | 依赖任务未完成 | 标记 blocked，等待依赖完成 |
| `ApprovalRequired` | 到达确认点 | 暂停执行，创建确认请求 |
| `ExternalDependency` | 等待外部资源 | 标记 waiting，定期检查 |
| `CriticalError` | 严重错误 | 停止执行，通知人工介入 |

### 7.2 重试机制

```python
class RetryManager:
    max_retries: int = 3
    backoff: str = "exponential"  # 指数退避

    def get_delay(retry_count: int) -> int:
        return min(2 ** retry_count * 10, 300)  # 最大 5 分钟
```

### 7.3 阻塞问题处理

当遇到阻塞问题时：
1. 创建 `meeting` 类型任务
2. 记录阻塞原因和影响范围
3. 通知相关人员
4. 会议结束后更新状态

### 7.4 非阻塞等待处理

当遇到需要等待但不阻塞的情况：
1. 插入通知消息
2. 记录等待事项
3. 继续执行其他任务
4. 定期检查等待条件

---

## 8. 全功能测试

### 8.1 测试流程

```
┌─────────────────────────────────────────────────────────────┐
│                    全功能测试流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 环境检查                                                 │
│     ├─ 验证所有依赖已安装                                    │
│     ├─ 验证配置文件完整                                      │
│     └─ 验证环境变量正确                                      │
│                                                             │
│  2. 单元测试聚合                                             │
│     ├─ 收集所有任务的测试结果                                │
│     ├─ 统计测试覆盖率                                        │
│     └─ 生成聚合报告                                          │
│                                                             │
│  3. 集成测试                                                 │
│     ├─ 任务间依赖验证                                        │
│     ├─ 数据流完整性检查                                      │
│     └─ 状态转换正确性验证                                    │
│                                                             │
│  4. 端到端测试                                               │
│     ├─ 模拟完整用户场景                                      │
│     ├─ 验证 Skills 调用链路                                  │
│     └─ 验证 Agent 协作流程                                   │
│                                                             │
│  5. 回归测试                                                 │
│     ├─ 检查是否有遗漏的失败任务                              │
│     └─ 验证重试后任务状态                                    │
│                                                             │
│  6. 产出报告                                                 │
│     ├─ 测试结果汇总                                          │
│     ├─ 问题清单（如有）                                      │
│     └─ 建议后续操作                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 完成标志

当以下条件**全部满足**时，标志整个任务结束：

```yaml
completion_criteria:
  all_tasks_completed: true      # 所有任务状态为 completed
  full_test_passed: true         # 全功能测试通过
  no_pending_approvals: true     # 无待确认项
  docs_updated: true             # 文档已更新
  artifacts_verified: true       # 产出物已验证
```

---

## 9. Claude Code Skills

### 9.1 Skills 列表

| Skill | 触发命令 | 用途 |
|-------|---------|------|
| `om:start` | `/om:start <doc>` | 启动新任务流程 |
| `om:status` | `/om:status` | 查看当前执行状态 |
| `om:approve` | `/om:approve [id]` | 处理待确认项 |
| `om:resume` | `/om:resume` | 从中断点恢复 |
| `om:retry` | `/om:retry [task-id]` | 重试失败任务 |
| `om:report` | `/om:report` | 生成执行报告 |

### 9.2 `/om:start` 流程

```
1. 读取任务文档
2. 调用 Planner Agent 生成问题清单
3. 展示问题，用户选择答案
4. 调用 Planner Agent 拆解任务
5. 生成任务计划 → 等待用户确认
6. 用户确认后，启动 CLI 开始执行
```

### 9.3 `/om:approve` 流程

```
1. 读取 pending/ 下的待确认项
2. 展示确认内容和选项
3. 用户选择 → 写入结果
4. 通知 CLI 继续执行
```

---

## 10. 数据模型

### 10.1 目录结构

```
.openmatrix/
├── state.json                    # 全局运行状态
├── config.json                   # 配置文件
├── tasks/
│   ├── index.json               # 任务索引
│   ├── TASK-001/
│   │   ├── task.json            # 任务定义
│   │   ├── plan.md              # 执行计划
│   │   ├── phases/              # 三阶段记录
│   │   │   ├── develop.json
│   │   │   ├── verify.json
│   │   │   └── accept.json
│   │   └── artifacts/           # 产出物
│   └── TASK-002/
├── agents/
│   ├── runs/                    # Agent 执行记录
│   └── pool.json                # Agent 池状态
├── approvals/
│   ├── pending/                 # 待确认项
│   └── history/                 # 已确认历史
└── logs/
    ├── orchestrator.log
    └── agents/
```

### 10.2 核心数据结构

**state.json** - 全局状态
```json
{
  "version": "1.0",
  "runId": "run-20240323-001",
  "status": "running",
  "currentPhase": "execution",
  "startedAt": "2024-03-23T10:00:00Z",
  "config": {
    "timeout": 120,
    "maxRetries": 3,
    "approvalPoints": ["plan", "merge", "deploy"]
  },
  "statistics": {
    "totalTasks": 10,
    "completed": 3,
    "inProgress": 2,
    "failed": 1,
    "pending": 4
  }
}
```

**task.json** - 单个任务
```json
{
  "id": "TASK-001",
  "title": "用户登录功能开发",
  "description": "实现基于JWT的用户登录认证功能",
  "status": "in_progress",
  "priority": "P0",
  "timeout": 120,
  "dependencies": [],
  "assignedAgent": "coder",
  "phases": {
    "develop": { "status": "completed", "duration": 45 },
    "verify": { "status": "in_progress", "duration": null },
    "accept": { "status": "pending", "duration": null }
  },
  "retryCount": 0,
  "error": null,
  "createdAt": "2024-03-23T10:00:00Z",
  "updatedAt": "2024-03-23T10:45:00Z"
}
```

**approval.json** - 确认请求
```json
{
  "id": "APPR-001",
  "type": "plan",
  "taskId": "TASK-001",
  "title": "任务计划确认",
  "description": "请确认以下任务拆解方案",
  "content": "## 计划内容\n...",
  "options": [
    { "key": "approve", "label": "批准执行" },
    { "key": "modify", "label": "需要修改" },
    { "key": "reject", "label": "拒绝" }
  ],
  "status": "pending",
  "createdAt": "2024-03-23T10:05:00Z"
}
```

---

## 11. 实现计划

详见: [实现计划](./superpowers/plans/PLAN.md)

### 11.1 技术栈

| 组件 | 技术 |
|------|------|
| CLI 框架 | TypeScript + Commander |
| Agent 运行时 | Node.js 子进程 |
| Claude SDK | @anthropic-ai/sdk |
| 文件监听 | Chokidar |
| 日志 | Winston |
| 测试 | Vitest |

### 11.2 里程碑

| 里程碑 | 周期 | 主要交付 |
|--------|------|---------|
| Phase 1 | Week 1 | 基础 CLI 运行 |
| Phase 2 | Week 2 | 任务计划生成 |
| Phase 3 | Week 3 | Agent 执行任务 |
| Phase 4 | Week 4 | 完整闭环测试 |
| MVP | Week 5 | 内部发布 |

---

## 附录

### A. 任务示例

```json
{
  "id": "TASK-001",
  "title": "用户登录功能开发",
  "description": "实现基于JWT的用户登录认证功能",
  "details": "docs/tasks/login-feature.md",
  "timeout": 120,
  "priority": "P0",
  "assignedAgent": "coder",
  "phases": {
    "develop": {
      "status": "completed",
      "duration": 45
    },
    "verify": {
      "status": "completed",
      "duration": 20
    },
    "accept": {
      "status": "completed",
      "duration": 15
    }
  },
  "build_test": {
    "compile": true,
    "static_analysis": true,
    "unit_test": true,
    "coverage": "85%"
  }
}
```

### B. 状态转换图

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐│
│ pending │ -> │in_progress│ -> │ blocked  │ ── │  failed  │─┘
└─────────┘    └──────────┘    └──────────┘    └──────────┘
                    │               │                │
                    │               ▼                │
                    │         ┌──────────┐          │
                    │         │ meeting  │          │
                    │         └──────────┘          │
                    │               │               │
                    ▼               ▼               ▼
               ┌──────────┐   ┌──────────┐   ┌──────────┐
               │completed │   │ waiting  │   │ timeout  │
               └──────────┘   └──────────┘   └──────────┘
```

### C. 相关文档

- [设计文档](./superpowers/specs/2024-03-23-openmatrix-design.md)
- [实现计划](./superpowers/plans/PLAN.md)
- [Claude API 文档](https://docs.anthropic.com)
- [Claude Code Skills 开发指南](https://docs.anthropic.com/claude-code/skills)
