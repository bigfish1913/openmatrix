# OpenMatrix

> AI Agent 任务编排系统 - 集成 Claude Code Skills 实现最大化自动化

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://badge.fury.io/js/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 概述

### 项目目标

构建一个基于 Claude API 的多 Agent 协作任务编排系统，实现：
- 任务自动拆解与调度
- 多 Agent 并行协作
- 关键节点人工确认
- 异常处理与自动重试
- 全功能测试验证

### 核心设计原则

| 原则 | 说明 |
|------|------|
| 最大自动化 | AI 自主决策执行，仅在关键节点需人工确认 |
| 状态外置 | 所有状态存文件，支持断点续传 |
| 真正并行 | Agent 通过子进程并行执行，各自独立上下文 |
| 可扩展 | Agent 类型和确认点可配置 |

### 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 人工介入级别 | 关键节点确认 | 平衡自动化与控制 |
| 底层模型 | Claude API | 长上下文，强 Tool Use |
| 协作模式 | 中央调度 | 架构清晰，易管理 |
| 持久化 | 文件系统 | 简单，Git 友好 |
| 确认机制 | Claude Code Skills | 自然对话式交互 |

---

## 特性

- 🤖 **6种 Agent 类型**: Planner, Coder, Tester, Reviewer, Researcher, Executor
- 🔄 **自动状态流转**: 智能状态机管理任务生命周期
- ✅ **关键节点确认**: Plan/Merge/Deploy 审批流程
- 🔴 **Meeting 机制**: 阻塞问题和决策点交互式处理
- 🔁 **自动重试**: 指数退避重试机制
- 📊 **完整报告**: 任务执行统计和报告生成
- 💾 **状态持久化**: 文件系统存储，支持中断恢复
- ⚡ **三种执行模式**: confirm-all / confirm-key / auto

---

## 安装

### 方式 1: 从源码安装 (推荐)

```bash
# 1. 克隆并构建
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix
npm install
npm run build
npm link

# 2. 复制 Skills
mkdir -p ~/.claude/commands/om
cp skills/*.md ~/.claude/commands/om/
```

### 方式 2: 从 GitHub 安装

> ⚠️ **Windows 用户注意**: 由于 npm 在 Windows 上的 symlink 问题，GitHub 直接安装可能失败。建议使用方式 1。

```bash
# 1. 安装 CLI
npm install -g github:bigfish1913/openmatrix

# 2. 下载 Skills (从 GitHub)
mkdir -p ~/.claude/commands/om
cd ~/.claude/commands/om
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/status.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/start.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/approve.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/meeting.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/resume.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/retry.md
curl -LO https://raw.githubusercontent.com/bigfish1913/openmatrix/main/skills/report.md
```

### 常见问题

**Mac ENOTDIR 错误:**
```bash
sudo rm -rf /opt/homebrew/lib/node_modules/openmatrix
sudo rm -rf /opt/homebrew/lib/node_modules/.openmatrix-*
npm cache clean --force
npm install -g github:bigfish1913/openmatrix
```

**Windows 安装失败:**
```bash
# 使用源码安装 (方式 1)
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix
npm install && npm run build && npm link
```

---

## 系统架构

### 架构概览

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

### 组件职责

| 层级 | 组件 | 职责 |
|------|------|------|
| 用户层 | Claude Code Skills | 用户交互入口，展示状态，收集确认 |
| 调度层 | Orchestrator CLI | 任务调度、状态管理、Agent 编排 |
| 执行层 | Worker Agents | 执行具体任务，产出结果 |
| 存储层 | File System | 持久化状态，支持恢复 |

---

## 使用

### Claude Code Skills

| 命令 | 说明 |
|------|------|
| `/om:start` | 启动新任务，交互式问答后执行 |
| `/om:status` | 查看任务状态 |
| `/om:approve` | 审批决策 (Plan/Merge/Deploy) |
| `/om:meeting` | 查看和处理 Meeting（阻塞问题/决策） |
| `/om:resume` | 恢复中断任务 |
| `/om:retry` | 重试失败任务 |
| `/om:report` | 生成执行报告 |

### CLI 命令

```bash
openmatrix start <task.md>    # 启动任务
openmatrix status             # 查看状态
openmatrix approve [id]       # 审批 (plan/merge/deploy)
openmatrix meeting [id]       # 处理 Meeting (阻塞/决策)
openmatrix resume [task-id]   # 恢复
openmatrix retry [task-id]    # 重试
openmatrix report             # 报告
```

### Skills 流程

**`/om:start`**
```
1. 读取任务文档
2. 生成 3-7 个澄清问题（逐个提问）
3. 用户回答后，拆解任务
4. 生成执行计划 → 等待用户确认
5. 用户确认后，启动 CLI 开始执行
```

**`/om:approve`**
```
1. 读取 pending/ 下的待确认项
2. 展示确认内容和选项
3. 用户选择 → 写入结果
4. 通知 CLI 继续执行
```

**`/om:meeting`** (新增)
```
1. 列出所有待处理 Meeting
2. 展示 Meeting 详情（阻塞原因/决策问题）
3. 用户选择处理方式：
   - 💡 提供信息（解决阻塞）
   - ⏭️ 跳过任务（标记可选）
   - 🔄 重试（使用新信息）
   - ✏️ 修改方案（调整任务）
   - ✅ 做出决策（技术选型）
4. 更新任务状态，恢复执行
```

**执行流程（含 Meeting）**
```
/om:start 启动任务
    ↓
执行任务中...
├── 任务A 完成 ✓
├── 任务B 阻塞 → 创建 Meeting → 跳过，继续 ↷
├── 任务C 完成 ✓
└── 任务D 阻塞 → 创建 Meeting → 跳过，继续 ↷
    ↓
执行完成!
📋 有待处理的 Meeting (2个)
    ↓
/om:meeting 交互式处理
├── 选择 Meeting
├── 选择操作（提供信息/跳过/重试等）
└── 解决问题，任务恢复
```

---

## 数据模型

### 目录结构

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
│   └── runs/                    # Agent 执行记录
├── approvals/
│   ├── pending/                 # 待确认项
│   └── history/                 # 已确认历史
└── logs/
    ├── orchestrator.log
    └── agents/
```

### 核心数据结构

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

### 任务状态流转

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

## 核心模块

### 调度引擎 (Scheduler)

- 任务优先级排序
- 依赖关系解析
- 并发控制
- 资源分配

### 状态机 (StateMachine)

```
pending → scheduled → in_progress → verify → accept → completed
              │            │           │        │
              │            ▼           ▼        ▼
              │        blocked      failed   failed
              │            │
              └────────────┴──► waiting ──► /om:approve
```

### 确认管理 (ApprovalManager)

**常规审批** (通过 `/om:approve` 处理)

| 审批类型 | 触发时机 | 命令 | 说明 |
|---------|---------|------|------|
| `plan` | 任务计划完成后 | `/om:approve` | 确认任务拆解方案 |
| `merge` | 代码合并前 | `/om:approve` | 确认合并请求 |
| `deploy` | 部署前 | `/om:approve` | 确认部署操作 |

**Meeting** (通过 `/om:meeting` 处理)

| 类型 | 触发时机 | 命令 | 处理方式 |
|------|---------|------|---------|
| `meeting` (阻塞) | 任务执行遇到阻塞 | `/om:meeting` | 提供信息/跳过/重试/修改 |
| `meeting` (决策) | 需要技术方案决策 | `/om:meeting` | 选择方案/自定义决策 |

**Meeting 操作流程**
```
执行任务中遇到阻塞/决策点
    ↓
创建 Meeting 记录（不暂停执行）
    ↓
跳过该任务，继续执行其他任务
    ↓
执行完成，提示有待处理 Meeting
    ↓
用户执行 /om:meeting
    ↓
交互式选择并解决问题
    ↓
恢复任务或标记完成
```

### 6种 Agent

| Agent | 职责 | 输入 | 输出 | Tools |
|-------|------|------|------|-------|
| **Planner** | 任务拆解、计划制定 | 任务文档、用户答案 | 任务列表、依赖图 | Read, Write |
| **Coder** | 代码编写、重构 | 任务描述、现有代码 | 代码文件、变更说明 | Read, Write, Edit, Bash |
| **Tester** | 测试用例、执行测试 | 代码文件、测试要求 | 测试报告、覆盖率 | Read, Write, Bash |
| **Reviewer** | 代码审查、质量检查 | 代码文件、规范文档 | 审查报告、问题列表 | Read, Grep, Glob |
| **Researcher** | 搜索资料、知识检索 | 问题、关键词 | 研究报告、参考资料 | WebSearch, WebFetch, Read |
| **Executor** | 执行命令、文件操作 | 命令列表、操作说明 | 执行结果、日志 | Bash, Read, Write |

### Agent 执行流程 (Subagent 模式)

```
1. Orchestrator 准备 SubagentTask
2. Skill 调用 Agent 工具执行 Subagent
3. Subagent 在隔离环境中执行任务
4. 产出结果 (success/failed/needs_approval)
5. 上报结果 (写入状态文件)
6. Skill 读取状态，决定下一步
```

**执行模式**

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `confirm-all` | 每阶段后暂停确认 | 重要任务，需精细控制 |
| `confirm-key` | 仅在 plan/merge/deploy 暂停 | 常规任务，平衡自动与控制 |
| `auto` | 全自动，无暂停 | 简单任务，最大化自动化 |

---

## 异常处理与重试

### 异常分类

| 异常类型 | 触发条件 | 处理策略 |
|---------|---------|---------|
| `AgentTimeout` | Agent 执行超时 | 记录日志，加入重试队列 |
| `AgentError` | Agent 执行出错 | 记录错误详情，加入重试队列 |
| `TaskBlocked` | 依赖任务未完成 | 标记 blocked，等待依赖完成 |
| `ApprovalRequired` | 到达确认点 | 暂停执行，创建确认请求 |
| `ExternalDependency` | 等待外部资源 | 标记 waiting，定期检查 |
| `CriticalError` | 严重错误 | 停止执行，通知人工介入 |

### 重试机制

- 最大重试次数: 3 次
- 退避策略: 指数退避 (2^n * 10 秒，最大 300 秒)
- 最终重试: 全功能测试前，收集所有失败任务并重试

---

## 配置

在项目根目录创建 `.openmatrixrc.json`：

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

---

## 开发

### 技术栈

| 组件 | 技术 |
|------|------|
| CLI 框架 | TypeScript + Commander |
| Agent 运行时 | Node.js 子进程 |
| 文件监听 | Chokidar |
| 日志 | Winston |
| 测试 | Vitest |

### 目录结构

```
openmatrix/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/                # CLI 命令
│   ├── orchestrator/       # 调度层
│   ├── agents/             # Agent 实现
│   ├── storage/            # 存储层
│   └── types/              # 类型定义
├── skills/                 # Claude Code Skills
├── tests/                  # 测试
└── docs/                   # 文档
```

### 开发命令

```bash
# 克隆项目
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix

# 安装依赖
npm install

# 构建
npm run build

# 测试
npm test
```

---

## License

MIT

---

## 相关链接

- [Claude Code 文档](https://docs.anthropic.com/claude-code)
- [Claude API 文档](https://docs.anthropic.com)
