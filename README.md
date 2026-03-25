# OpenMatrix

> AI Agent 任务编排系统 - 集成 Claude Code Skills 实现最大化自动化

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://badge.fury.io/js/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 特性

- 🤖 **6种 Agent 类型**: Planner, Coder, Tester, Reviewer, Researcher, Executor
- 🔄 **自动状态流转**: 智能状态机管理任务生命周期
- ✅ **关键节点确认**: Plan/Merge/Deploy/Meeting 审批流程
- 🔁 **自动重试**: 指数退避重试机制
- 📊 **完整报告**: 任务执行统计和报告生成
- 💾 **状态持久化**: 文件系统存储，支持中断恢复

## 安装

### 从 GitHub 安装

```bash
# 安装
npm install -g github:bigfish1913/openmatrix

# 安装 Skills
mkdir -p ~/.claude/commands/om
cp $(npm root -g)/openmatrix/skills/*.md ~/.claude/commands/om/
```

### Mac 权限问题

```bash
# 如果遇到权限问题
sudo rm -rf /opt/homebrew/lib/node_modules/openmatrix
sudo mkdir -p ~/.claude/commands/om
sudo chown -R $(whoami) ~/.claude/commands/om
npm install -g github:bigfish1913/openmatrix
cp $(npm root -g)/openmatrix/skills/*.md ~/.claude/commands/om/
```

## 使用

### Claude Code Skills

| 命令 | 说明 |
|------|------|
| `/om:start` | 启动新任务 |
| `/om:status` | 查看任务状态 |
| `/om:approve` | 审批决策 (Plan/Merge/Deploy/Meeting) |
| `/om:resume` | 恢复中断任务 |
| `/om:retry` | 重试失败任务 |
| `/om:report` | 生成执行报告 |

### CLI 命令

```bash
openmatrix start <task.md>    # 启动任务
openmatrix status             # 查看状态
openmatrix approve [id]       # 审批
openmatrix resume [task-id]   # 恢复
openmatrix retry [task-id]    # 重试
openmatrix report             # 报告
```

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code 主会话                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Skills (交互层)                         │   │
│  │  /om:start  /om:status  /om:approve  /om:resume     │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              CLI (调度层)                            │   │
│  │  Scheduler • StateMachine • ApprovalManager         │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              Agents (执行层)                         │   │
│  │  Planner • Coder • Tester • Reviewer • Researcher   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   .openmatrix/        │
              │   • state.json        │
              │   • tasks/            │
              │   • approvals/        │
              └───────────────────────┘
```

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

| 审批类型 | 触发时机 | 命令 |
|---------|---------|------|
| `plan` | 任务计划完成后 | `/om:approve` |
| `merge` | 代码合并前 | `/om:approve` |
| `deploy` | 部署前 | `/om:approve` |
| `meeting` | 阻塞问题 | `/om:approve` |

### 6种 Agent

| Agent | 职责 | 输入 | 输出 |
|-------|------|------|------|
| **Planner** | 任务规划 | 任务描述 | 执行计划 |
| **Coder** | 代码编写 | 需求描述 | 代码文件 |
| **Tester** | 测试验证 | 代码文件 | 测试报告 |
| **Reviewer** | 代码审查 | 代码变更 | 审查报告 |
| **Researcher** | 调研分析 | 问题/关键词 | 调研报告 |
| **Executor** | 命令执行 | 命令列表 | 执行结果 |

## 目录结构

```
.openmatrix/
├── state.json           # 全局状态
├── config.json          # 配置文件
├── tasks/               # 任务目录
│   └── TASK-XXX/
│       ├── task.json    # 任务定义
│       ├── plan.md      # 执行计划
│       └── result.md    # 执行结果
├── approvals/           # 审批记录
│   └── APPR-XXX.json
└── logs/                # 执行日志
```

## 工作流程

```
1. /om:start task.md
   → 解析任务 → 生成澄清问题 → 用户回答
   → 拆解子任务 → 生成计划 → 等待审批

2. /om:approve
   → 展示审批内容 → 用户决策 → 继续/修改/拒绝

3. CLI 自动执行
   → 调度任务 → 分配 Agent → 执行 → 验证

4. 遇到阻塞
   → 创建 Meeting → 等待 /om:approve

5. /om:report
   → 生成执行报告 → 统计分析
```

## 配置

在项目根目录创建 `.openmatrixrc.json`：

```json
{
  "timeout": 120000,
  "maxRetries": 3,
  "approvalPoints": ["plan", "merge", "deploy"],
  "maxConcurrentAgents": 3,
  "model": "claude-sonnet-4-6"
}
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

## 实现状态

| 模块 | 状态 |
|------|------|
| 调度引擎 (Scheduler) | ✅ 完成 |
| 状态机 (StateMachine) | ✅ 完成 |
| 确认管理器 (ApprovalManager) | ✅ 完成 |
| 重试管理器 (RetryManager) | ✅ 完成 |
| AgentRunner | ✅ 完成 |
| 6种 Agent | ✅ 完成 |
| CLI 命令 | ✅ 完成 |
| Claude Code Skills | ✅ 完成 |

## License

MIT

## 相关链接

- [设计文档](docs/require.md)
- [Claude Code 文档](https://docs.anthropic.com/claude-code)
