# OpenMatrix

> AI Agent 任务编排系统 - 集成 Claude Code Skills 实现最大化自动化

## 概述

OpenMatrix 是一个多 Agent 协作的任务编排框架，通过 Claude Code Skills 提供交互界面，CLI 作为编排核心。支持关键节点人工确认、自动重试、状态持久化等特性。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Skills                    │
│  /om:status  /om:start  /om:approve  /om:resume  ...    │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                      CLI Layer                           │
│              openmatrix status/start/...                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Orchestrator                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │ TaskParser   │ │ TaskPlanner  │ │ RetryManager │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                     Agents                               │
│  ┌────────┐ ┌───────┐ ┌────────┐ ┌─────────┐            │
│  │Planner │ │ Coder │ │ Tester │ │Reviewer │ ...        │
│  └────────┘ └───────┘ └────────┘ └─────────┘            │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Storage Layer                          │
│            .openmatrix/state.json + tasks/               │
└─────────────────────────────────────────────────────────┘
```

## 核心概念

### 任务状态流转

```
pending → scheduled → in_progress → verify → accept → completed
                           │
                           ▼
                         failed → retry_queue → pending
```

### Agent 类型

| Agent | 职责 |
|-------|------|
| Planner | 任务分解、计划制定 |
| Coder | 代码实现 |
| Tester | 测试验证 |
| Reviewer | 代码审查 |
| Researcher | 信息调研 |
| Executor | 命令执行 |

### 三阶段执行

1. **Develop** - 开发实现
2. **Verify** - 自动验证
3. **Accept** - 人工确认（关键节点）

## 安装

```bash
# 从 GitHub 安装
npm install -g github:bigfish1913/openmatrix

# 安装 Claude Code Skills
mkdir -p ~/.claude/commands/om
cp $(npm root -g)/openmatrix/skills/*.md ~/.claude/commands/om/
```

## 使用

### Claude Code Skills

| 命令 | 说明 |
|------|------|
| `/om:status` | 查看当前任务执行状态 |
| `/om:start` | 启动新的任务执行周期 |
| `/om:approve` | 审批关键节点的执行结果 |
| `/om:resume` | 恢复暂停或中断的任务 |
| `/om:retry` | 重试失败的任务 |
| `/om:report` | 生成任务执行报告 |

### CLI 命令

```bash
openmatrix status           # 查看状态
openmatrix start <task>     # 启动任务
openmatrix --help           # 帮助信息
```

## 目录结构

```
.openmatrix/
├── state.json          # 全局状态
├── tasks/              # 任务目录
│   └── TASK-001/
│       ├── task.json   # 任务详情
│       ├── plan.md     # 执行计划
│       └── result.md   # 执行结果
└── approvals/          # 审批记录
    └── approval-001.json
```

## 配置

在项目根目录创建 `.openmatrixrc.json`：

```json
{
  "timeout": 300000,
  "maxRetries": 3,
  "approvalPoints": ["plan", "merge", "deploy"],
  "maxConcurrentAgents": 3,
  "model": "claude-sonnet-4-6"
}
```

## 关键节点确认

在以下节点需要人工确认：

- **plan** - 计划审批
- **merge** - 合并审批
- **deploy** - 部署审批

使用 `/om:approve` 进行审批：

```
用户: /om:approve
系统: 📋 等待审批: TASK-003 API 接口开发
      执行结果: [展示执行内容]
      选项:
      [A] 确认通过
      [B] 需要修改
      [C] 拒绝重试
用户: A
系统: ✅ 已批准，继续执行
```

## 重试机制

采用指数退避策略：

```
重试 1: 等待 10s
重试 2: 等待 20s
重试 3: 等待 40s
...
最大等待: 5min
```

## API

```typescript
import { StateManager, TaskParser, TaskPlanner } from 'openmatrix';

// 解析任务
const parser = new TaskParser();
const task = parser.parse(taskMarkdown);

// 规划任务
const planner = new TaskPlanner();
const subTasks = planner.decompose(task);

// 状态管理
const state = new StateManager('.openmatrix');
await state.saveTask(subTasks[0]);
```

## 开发

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

## License

MIT
