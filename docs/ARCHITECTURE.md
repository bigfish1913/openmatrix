# OpenMatrix 系统架构详解

## 整体架构

```mermaid
graph TB
    subgraph User["用户层"]
        U1["CLI 命令"]
        U2["Skills (Claude Code)"]
    end

    subgraph SkillLayer["Skill 层 (AI 决策)"]
        S1["/om:start"]
        S2["/om:auto"]
        S3["/om:brainstorm"]
        S4["/om:debug"]
        S5["/om:feature"]
        S6["其他 Skills"]
    end

    subgraph CLILayer["CLI 层 (程序执行)"]
        C1["openmatrix start"]
        C2["openmatrix step"]
        C3["openmatrix complete"]
        C4["openmatrix status"]
        C5["其他 CLI 命令"]
    end

    subgraph Core["核心层 (Orchestrator)"]
        O1["Executor"]
        O2["Scheduler"]
        O3["Phase Executor"]
        O4["State Machine"]
        O5["Task Planner"]
        O6["Meeting Manager"]
    end

    subgraph Agent["Agent 层"]
        A1["Agent Runner"]
        A2["Planner Agent"]
        A3["Coder Agent"]
        A4["Tester Agent"]
        A5["Reviewer Agent"]
        A6["Researcher Agent"]
    end

    subgraph Storage["存储层"]
        ST1["State Manager"]
        ST2["File Store"]
        ST3[".openmatrix/"]
    end

    U2 --> S1 --> C1 --> O1
    S1 --> O5
    O1 --> O2 --> O3 --> O4
    O3 --> A1 --> A2
    A1 --> A3
    A1 --> A4
    A1 --> A5
    A1 --> A6
    O4 --> ST1 --> ST2 --> ST3
    O6 --> ST3
```

---

## 核心组件

### 1. Orchestrator (编排层)

`src/orchestrator/` 目录下的核心组件：

| 文件 | 职责 | 说明 |
|------|------|------|
| `executor.ts` | 主执行循环 | 协调任务分发、状态流转、Agent 调用 |
| `scheduler.ts` | 任务调度 | 依赖解析、优先级排序、并发控制 |
| `phase-executor.ts` | 阶段执行 | develop/verify/accept 三阶段执行 |
| `state-machine.ts` | 状态流转 | Task 状态转换逻辑 |
| `task-planner.ts` | 任务规划 | 从用户输入生成任务分解 |
| `meeting-manager.ts` | Meeting 管理 | 阻塞任务记录和处理 |
| `approval-manager.ts` | 审批管理 | 用户确认点管理 |
| `debug-manager.ts` | 调试管理 | 调试会话生命周期 |
| `interactive-question-generator.ts` | 问题生成 | 交互式问答生成 |
| `environment-detector.ts` | 环境检测 | 项目技术栈自动识别 |

### 2. Agents (Agent 层)

`src/agents/` 目录下的 Agent 实现：

| 文件 | 职责 | 说明 |
|------|------|------|
| `agent-runner.ts` | Agent 运行器 | 准备 SubagentTask，调用 Claude Code Agent 工具 |
| `impl/planner.ts` | Planner Agent | 任务分解、计划生成 |
| `impl/coder.ts` | Coder Agent | 代码编写、功能实现 |
| `impl/tester.ts` | Tester Agent | 测试编写、TDD 流程 |
| `impl/reviewer.ts` | Reviewer Agent | AI 验收、质量确认 |
| `impl/researcher.ts` | Researcher Agent | 领域调研、知识收集 |
| `impl/executor.ts` | Executor Agent | 通用执行 |

### 3. Storage (存储层)

`src/storage/` 目录下的存储组件：

| 文件 | 职责 | 说明 |
|------|------|------|
| `state-manager.ts` | 全局状态管理 | runId、status、config、statistics |
| `file-store.ts` | 文件存储 | JSON 文件读写、原子操作 |

### 4. CLI Commands (命令层)

`src/cli/commands/` 目录下的 CLI 命令：

| 文件 | 命令 | 说明 |
|------|------|------|
| `start.ts` | `openmatrix start` | 启动新任务 |
| `step.ts` | `openmatrix step` | 获取下一个任务 |
| `complete.ts` | `openmatrix complete` | 标记任务完成 |
| `status.ts` | `openmatrix status` | 查看状态 |
| `approve.ts` | `openmatrix approve` | 审批决策 |
| `meeting.ts` | `openmatrix meeting` | 处理阻塞 |
| `resume.ts` | `openmatrix resume` | 恢复中断 |
| `retry.ts` | `openmatrix retry` | 重试失败 |
| `report.ts` | `openmatrix report` | 生成报告 |
| `auto.ts` | `openmatrix auto` | 全自动执行 |
| `brainstorm.ts` | `openmatrix brainstorm` | 头脑风暴 |
| `debug.ts` | `openmatrix debug` | 系统化调试 |
| `research.ts` | `openmatrix research` | 领域调研 |
| `test.ts` | `openmatrix test` | 测试生成 |

---

## 目录结构

```
openmatrix/
├── src/                      # TypeScript 源码
│   ├── orchestrator/         # 核心编排逻辑
│   │   ├── executor.ts       # 主执行循环
│   │   ├── scheduler.ts      # 任务调度
│   │   ├── phase-executor.ts # 阶段执行
│   │   ├── state-machine.ts  # 状态机
│   │   ├── task-planner.ts   # 任务规划
│   │   └── meeting-manager.ts # Meeting 管理
│   ├── agents/               # Agent 实现
│   │   ├── agent-runner.ts   # Agent 运行器
│   │   └── impl/             # 具体 Agent
│   ├── storage/              # 状态持久化
│   │   ├── state-manager.ts  # 全局状态
│   │   └── file-store.ts     # 文件存储
│   ├── types/                # TypeScript 类型
│   │   └── index.ts          # 类型定义
│   ├── cli/                  # CLI 命令
│   │   └── commands/         # 具体命令
│   └── utils/                # 工具函数
├── skills/                   # Claude Code Skills
│   ├── start.md              # /om:start
│   ├── auto.md               # /om:auto
│   ├── brainstorm.md         # /om:brainstorm
│   ├── debug.md              # /om:debug
│   ├── feature.md            # /om:feature
│   ├── research.md           # /om:research
│   ├── status.md             # /om:status
│   ├── approve.md            # /om:approve
│   ├── meeting.md            # /om:meeting
│   ├── resume.md             # /om:resume
│   ├── retry.md              # /om:retry
│   ├── report.md             # /om:report
│   ├── check.md              # /check
│   └── om.md                 # /om (默认入口)
├── docs/                     # 文档
│   ├── FLOW.md               # 执行流程图
│   ├── ROADMAP.md            # 开发路线图
│   ├── ARCHITECTURE.md       # 系统架构
│   └── TERMINOLOGY.md        # 术语对照表
├── tests/                    # 测试文件
├── dist/                     # 编译输出
├── .openmatrix/              # 运行时状态 (执行时生成)
└── package.json              # npm 配置
```

---

## Agent 类型说明

| AgentType | 职责 | 使用场景 |
|-----------|------|----------|
| `planner` | 任务规划 | 分解用户需求、生成执行计划 |
| `coder` | 代码编写 | 功能实现、Bug 修复 |
| `tester` | 测试编写 | TDD 流程、测试生成 |
| `reviewer` | AI 验收 | 验收阶段确认、质量报告生成 |
| `researcher` | 领域调研 | `/om:research` 领域知识收集 |
| `executor` | 通用执行 | 通用任务执行 |

### SubagentTask 结构

Agent Runner 生成的 SubagentTask 配置：

```typescript
interface SubagentTask {
  subagent_type: 'general-purpose' | 'Explore' | 'Plan';
  description: string;      // 简短描述 (3-5 词)
  prompt: string;           // 完整任务提示词
  isolation?: 'worktree';   // 是否使用隔离 worktree
  taskId: string;           // 任务 ID
  agentType: AgentType;     // 原始 Agent 类型
  timeout: number;          // 超时时间 (ms)
  needsApproval: boolean;   // 是否需要审批
}
```

---

## 状态存储机制

### 状态文件结构

```
.openmatrix/
├── state.json              # 全局状态
├── plan.md                 # AI 生成的执行计划
├── tasks-input.json        # 任务输入 (goals, constraints, deliverables)
├── tasks/
│   └── TASK-001/
│       ├── task.json       # 任务定义 + 状态 + 阶段信息
│       ├── context.md      # Agent 上下文 (供后续 Agent 读取)
│       ├── develop.json    # 开发阶段结果
│       ├── verify.json     # 验证阶段结果 (质量门禁)
│       ├── accept.json     # 验收阶段结果
│       └── artifacts/      # 产出文件
├── approvals/              # 审批记录
└── meetings/               # Meeting 记录
```

### GlobalState 结构

```typescript
interface GlobalState {
  version: string;
  runId: string;
  status: RunStatus;
  currentPhase: 'planning' | 'execution' | 'verification' | 'acceptance' | 'completed';
  startedAt: string;
  config: AppConfig;
  statistics: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    failed: number;
    pending: number;
    scheduled: number;
    blocked: number;
    waiting: number;
    verify: number;
    accept: number;
    retry_queue: number;
  };
}
```

---

## 数据流图

### 任务执行数据流

```mermaid
sequenceDiagram
    participant Skill
    participant CLI
    participant Executor
    participant Scheduler
    participant PhaseExecutor
    participant AgentRunner
    participant Storage

    Skill->>CLI: openmatrix start
    CLI->>Storage: 初始化 state.json
    CLI->>Executor: 启动执行循环
    Executor->>Scheduler: 获取下一个任务
    Scheduler->>Storage: 读取任务状态
    Scheduler->>Executor: 返回 TASK-001
    Executor->>PhaseExecutor: 执行 develop 阶段
    PhaseExecutor->>AgentRunner: 准备 SubagentTask
    AgentRunner->>Skill: 返回 Agent 配置
    Skill->>AgentRunner: 调用 Agent 工具
    AgentRunner->>PhaseExecutor: 返回执行结果
    PhaseExecutor->>Storage: 写入 develop.json
    Executor->>PhaseExecutor: 执行 verify 阶段
    PhaseExecutor->>Storage: 写入 verify.json
    Executor->>PhaseExecutor: 执行 accept 阶段
    PhaseExecutor->>Storage: 写入 accept.json
    Executor->>Storage: 更新 task.json 状态
    Executor->>Scheduler: 继续下一个任务
```

### step/complete 持久化循环

```mermaid
flowchart LR
    subgraph Skill["Skill 层"]
        S1["读取 state.json"]
        S2["调用 openmatrix step"]
        S3["拿到 SubagentTask"]
        S4["调用 Agent 工具"]
        S5["调用 openmatrix complete"]
    end

    subgraph CLI["CLI 层"]
        C1["返回下一个任务"]
        C2["标记任务完成"]
        C3["写入磁盘"]
    end

    S1 --> S2 --> C1 --> S3 --> S4 --> S5 --> C2 --> C3
    C3 -.->|"磁盘持久化"| S1
```

**核心原理**: 执行循环不依赖对话记忆。每次 step 都从磁盘读取状态，complete 后写入磁盘。上下文压缩、崩溃、重启都不影响执行。

---

## 任务生命周期

```mermaid
stateDiagram-v2
    [*] --> pending: 任务创建
    pending --> scheduled: Scheduler 调度
    scheduled --> in_progress: Executor 执行
    in_progress --> verify: 开发完成
    verify --> accept: 质量门禁通过
    accept --> completed: AI 验收通过
    
    in_progress --> blocked: 遇到阻塞
    blocked --> waiting: 创建 Meeting
    waiting --> scheduled: Meeting 解决后重新调度
    
    verify --> failed: 质量门禁失败
    accept --> failed: 验收失败
    failed --> retry_queue: 进入重试队列
    retry_queue --> scheduled: 重试
    
    completed --> [*]
```

---

## 分层职责原则

OpenMatrix 的核心思想：**让 AI 做 AI 擅长的事，让 CLI 做 CLI 擅长的事。**

```
Skill 层（AI）          CLI 层（程序）
─────────────────       ─────────────────
理解上下文              收集原始数据
分析权衡                状态持久化
给出推荐理由            执行命令
交互问答                管理任务生命周期
生成配置文件            输出结构化 JSON
```

**CLI 只做两件事：**
1. 收集原始事实（文件存在与否、命令输出、状态数据）
2. 执行明确的操作（运行命令、写入状态、读取文件）

**Skill 层 AI 负责：**
1. 读取原始数据，自行分析和推断
2. 基于上下文给出带理由的推荐
3. 通过 AskUserQuestion 与用户交互
4. 生成配置文件、脚本等产出物

---

## 相关链接

- [返回 README](../README.md)
- [执行流程](FLOW.md)
- [术语对照表](TERMINOLOGY.md)