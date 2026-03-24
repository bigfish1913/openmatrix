# OpenMatrix: AI Agent 任务编排系统设计文档

**版本**: 1.0
**日期**: 2024-03-23
**状态**: 设计评审中

---

## 1. 概述

### 1.1 项目目标

构建一个基于 Claude API 的多 Agent 协作任务编排系统，实现：
- 任务自动拆解与调度
- 多 Agent 并行协作
- 关键节点人工确认
- 异常处理与自动重试
- 全功能测试验证

### 1.2 核心设计原则

| 原则 | 说明 |
|------|------|
| 最大自动化 | AI 自主决策执行，仅在关键节点需人工确认 |
| 状态外置 | 所有状态存文件，支持断点续传 |
| 真正并行 | Agent 通过子进程并行执行，各自独立上下文 |
| 可扩展 | Agent 类型和确认点可配置 |

### 1.3 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 人工介入级别 | 关键节点确认 | 平衡自动化与控制 |
| 底层模型 | Claude API | 长上下文，强 Tool Use |
| 协作模式 | 中央调度 | 架构清晰，易管理 |
| 持久化 | 文件系统 | 简单，Git 友好 |
| 确认机制 | Claude Code Skills | 自然对话式交互 |

---

## 2. 系统架构

### 2.1 架构概览

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

### 2.2 组件职责

| 层级 | 组件 | 职责 |
|------|------|------|
| 用户层 | Claude Code Skills | 用户交互入口，展示状态，收集确认 |
| 调度层 | Orchestrator CLI | 任务调度、状态管理、Agent 编排 |
| 执行层 | Worker Agents | 执行具体任务，产出结果 |
| 存储层 | File System | 持久化状态，支持恢复 |

---

## 3. 数据模型

### 3.1 目录结构

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

### 3.2 核心数据结构

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

### 3.3 任务状态流转

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

---

## 4. Claude Code Skills 设计

### 4.1 Skills 列表

| Skill | 触发命令 | 用途 |
|-------|---------|------|
| `om:start` | `/om:start <doc>` | 启动新任务流程 |
| `om:status` | `/om:status` | 查看当前执行状态 |
| `om:approve` | `/om:approve [id]` | 处理待确认项 |
| `om:resume` | `/om:resume` | 从中断点恢复 |
| `om:retry` | `/om:retry [task-id]` | 重试失败任务 |
| `om:report` | `/om:report` | 生成执行报告 |

### 4.2 核心 Skill 流程

**`/om:start`**
```
1. 读取任务文档
2. 调用 Planner Agent 生成问题清单
3. 展示问题，用户选择答案
4. 调用 Planner Agent 拆解任务
5. 生成任务计划 → 等待用户确认
6. 用户确认后，启动 CLI 开始执行
```

**`/om:approve`**
```
1. 读取 pending/ 下的待确认项
2. 展示确认内容和选项
3. 用户选择 → 写入结果
4. 通知 CLI 继续执行
```

**`/om:resume`**
```
1. 读取 state.json 当前状态
2. 启动 CLI 恢复执行
3. 展示恢复进度
```

---

## 5. Orchestrator CLI 设计

### 5.1 CLI 命令

```bash
# 启动新任务
openmatrix start docs/feature.md --config config.json

# 查看状态
openmatrix status [--json]

# 处理确认（被 Skill 调用）
openmatrix approve <approval-id> --decision approve

# 恢复执行
openmatrix resume

# 重试失败任务
openmatrix retry [--task TASK-001]

# 生成报告
openmatrix report --output report.md
```

### 5.2 核心逻辑

```python
class Orchestrator:
    def run(self):
        while not self.all_tasks_completed():
            # 1. 获取可执行任务
            tasks = self.get_ready_tasks()

            # 2. 并行派发给 Agent
            for task in tasks:
                agent = self.select_agent(task)
                self.dispatch(agent, task)

            # 3. 等待 Agent 完成
            results = self.wait_for_agents()

            # 4. 处理结果
            for result in results:
                if result.needs_approval:
                    self.create_approval(result)
                    self.pause_for_approval()
                elif result.failed:
                    self.handle_failure(result)
                else:
                    self.update_task_status(result)

            # 5. 检查超时
            self.check_timeouts()

        # 6. 全功能测试
        self.run_full_test()
```

---

## 6. Agent 设计

### 6.1 Agent 基类

```
┌─────────────────────────────────────────────────────────┐
│                    BaseAgent (抽象基类)                  │
├─────────────────────────────────────────────────────────┤
│  属性:                                                  │
│  - id: string              # Agent 唯一标识             │
│  - type: AgentType         # Agent 类型                 │
│  - capabilities: string[]  # 能力列表                   │
│  - model: string           # 使用的模型                 │
├─────────────────────────────────────────────────────────┤
│  方法:                                                  │
│  + execute(task: Task): Result    # 执行任务            │
│  + validate(task: Task): bool     # 验证任务是否可执行   │
│  + report(): Report               # 生成执行报告        │
│  # build_prompt(task): string     # 构建提示词          │
│  # call_claude(prompt): Response  # 调用 Claude API     │
└─────────────────────────────────────────────────────────┘
```

### 6.2 六种 Worker Agent

| Agent | 职责 | 输入 | 输出 | Tools |
|-------|------|------|------|-------|
| **Planner** | 任务拆解、计划制定 | 任务文档、用户答案 | 任务列表、依赖图 | Read, Write |
| **Coder** | 代码编写、重构 | 任务描述、现有代码 | 代码文件、变更说明 | Read, Write, Edit, Bash |
| **Tester** | 测试用例、执行测试 | 代码文件、测试要求 | 测试报告、覆盖率 | Read, Write, Bash |
| **Reviewer** | 代码审查、质量检查 | 代码文件、规范文档 | 审查报告、问题列表 | Read, Grep, Glob |
| **Researcher** | 搜索资料、知识检索 | 问题、关键词 | 研究报告、参考资料 | WebSearch, WebFetch, Read |
| **Executor** | 执行命令、文件操作 | 命令列表、操作说明 | 执行结果、日志 | Bash, Read, Write |

### 6.3 Agent 执行流程

```
1. 接收任务 (Orchestrator 通过 IPC 派发)
2. 构建上下文 (读取任务定义、加载相关文件)
3. 生成 Prompt (系统提示词 + 任务提示词 + 上下文)
4. 调用 Claude API (流式响应、Tool Use 循环、超时控制)
5. 产出结果 (success/failed/needs_approval)
6. 上报结果 (写入状态文件)
```

### 6.4 Agent 并行调度

```python
class AgentPool:
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.active_agents: Dict[str, AgentProcess] = {}

    def dispatch(self, task: Task) -> str:
        agent = self.create_agent(task.assigned_agent)
        process = agent.run_async(task)
        self.active_agents[process.id] = process
        return process.id

    def wait_any(self) -> List[AgentResult]:
        completed = []
        for run_id, process in self.active_agents.items():
            if process.is_done():
                result = process.get_result()
                completed.append(result)
                del self.active_agents[run_id]
        return completed
```

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
    def __init__(self, max_retries: int = 3, backoff: str = "exponential"):
        self.max_retries = max_retries
        self.backoff = backoff
        self.retry_queue: List[RetryItem] = []

    def should_retry(self, task: Task, error: Exception) -> bool:
        if task.retry_count >= self.max_retries:
            return False
        if isinstance(error, CriticalError):
            return False
        return True

    def get_delay(self, retry_count: int) -> int:
        if self.backoff == "exponential":
            return min(2 ** retry_count * 10, 300)
        elif self.backoff == "linear":
            return retry_count * 30
        else:
            return 30
```

### 7.3 最终重试阶段

在全功能测试前，收集所有失败任务并重试：
1. 按优先级排序失败任务
2. 逐个重试执行
3. 统计恢复数量和仍失败数量

---

## 8. 全功能测试

### 8.1 测试流程

```
1. 环境检查 (依赖、配置、环境变量)
2. 单元测试聚合 (收集结果、统计覆盖率)
3. 集成测试 (依赖验证、数据流、状态转换)
4. 端到端测试 (用户场景、Skills 调用、Agent 协作)
5. 回归测试 (遗漏检查、重试验证)
6. 产出报告
```

### 8.2 完成标志

```yaml
completion_criteria:
  all_tasks_completed: true
  full_test_passed: true
  no_pending_approvals: true
  docs_updated: true
  artifacts_verified: true
```

---

## 9. 实现计划

### 9.1 技术栈

| 组件 | 技术 |
|------|------|
| CLI 框架 | TypeScript + Commander |
| Agent 运行时 | Node.js 子进程 |
| Claude SDK | @anthropic-ai/sdk |
| 文件监听 | Chokidar |
| 日志 | Winston |
| 测试 | Vitest |

### 9.2 目录结构

```
openmatrix/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   ├── orchestrator/
│   ├── agents/
│   ├── skills/
│   ├── storage/
│   └── types/
├── tests/
└── .openmatrix/
```

### 9.3 分阶段实现

```
Phase 1: 核心框架 (Week 1)
├── 项目初始化
├── CLI 基础结构
├── 存储层实现
└── 基础类型定义

Phase 2: 调度器 (Week 2)
├── 任务解析器
├── 任务拆解器
├── 状态机
└── 调度引擎

Phase 3: Agent 系统 (Week 3)
├── Agent 基类
├── Planner Agent
├── Coder Agent
└── Executor Agent

Phase 4: 完整 Agent (Week 4)
├── Tester Agent
├── Reviewer Agent
├── Researcher Agent
└── Agent 并行调度

Phase 5: Skills 集成 (Week 5)
├── /om:start
├── /om:status
├── /om:approve
└── /om:resume

Phase 6: 异常处理与测试 (Week 6)
├── 重试机制
├── 全功能测试
├── 报告生成
└── 端到端测试
```

### 9.4 MVP 范围

| 功能 | MVP 包含 |
|------|---------|
| 任务启动与解析 | ✅ |
| 任务拆解 | ✅ |
| 3种核心 Agent | ✅ |
| 基础调度 | ✅ |
| 文件存储 | ✅ |
| 关键节点确认 | ✅ |
| 异常处理与重试 | ✅ |
| 全功能测试 | ✅ |
| Claude Code Skills | ✅ |
| 其他3种 Agent | ❌ 后续版本 |

---

## 10. 附录

### 10.1 配置示例

**config.json**
```json
{
  "timeout": {
    "default": 120,
    "max": 600
  },
  "retry": {
    "maxRetries": 3,
    "backoff": "exponential"
  },
  "approvalPoints": ["plan", "merge", "deploy"],
  "agents": {
    "maxConcurrent": 3,
    "model": "claude-sonnet-4-6"
  }
}
```

### 10.2 相关文档

- [任务流程规范](../require.md)
- [Claude API 文档](https://docs.anthropic.com)
- [Claude Code Skills 开发指南](https://docs.anthropic.com/claude-code/skills)
