# OpenMatrix

> **轻量级 AI Agent 任务编排系统** — 一句话描述任务，自动拆解、执行、验证

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://badge.fury.io/js/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
用户: /om:start 实现用户登录功能
OpenMatrix:
  ✓ 任务拆解: 5个子任务
  ✓ 开发执行: Coder Agent 编写代码
  ✓ 自动验证: Tester Agent 运行测试
  ✓ 代码审查: Reviewer Agent 检查质量
  ✓ 完成提交: 自动 Git commit

⏱️ 耗时: 8分钟 | 状态: ✅ 完成
```

---

## 为什么选择 OpenMatrix？

### 与 superpowers / gsd 对比

| 特性 | OpenMatrix | superpowers | gsd |
|------|------------|-------------|-----|
| **上手难度** | ⚡ 极简 - 一句话开始 | 中等 - 需要理解技能体系 | 较高 - 需要创建 PROJECT.md/ROADMAP.md |
| **定位** | 任务执行引擎 | 技能/工作流集合 | 项目生命周期管理 |
| **自动化程度** | 🔥 **全自动** - auto 模式无需确认 | 半自动 - 关键点需确认 | 半自动 - 阶段间需确认 |
| **阻塞处理** | 🎯 **Meeting 机制** - 记录并跳过，最后统一处理 | 停止等待用户 | 停止等待用户 |
| **Agent 数量** | **6种专用 Agent** (Planner/Coder/Tester/Reviewer/Researcher/Executor) | 通用 Agent | 专用子 Agent |
| **验证流程** | ✅ **三阶段验证** (develop → verify → accept) | 依赖外部技能 | verify-work 命令 |
| **状态管理** | 📁 **文件存储** - Git 友好 | 内存/会话 | 文件 + .planning 目录 |
| **安装大小** | 轻量 (~80KB) | 中等 | 较重 |

### OpenMatrix 独特优势

| 优势 | 说明 |
|------|------|
| 🚀 **即开即用** | 无需 PROJECT.md、ROADMAP.md，直接 `/om:start "任务描述"` |
| 🔄 **True Auto Mode** | 自动批准 plan/merge/deploy，真正无人值守 |
| 🎯 **Meeting 机制** | 遇到阻塞不停止，记录后继续执行，最后统一处理 |
| 🤖 **6种专用 Agent** | 每种任务由最合适的 Agent 执行 |
| ✅ **三阶段验证** | 每个任务都经过 develop → verify → accept |
| 💾 **Git 原生** | 状态存文件，支持断点恢复，Git 友好 |

---

## 快速开始

### 安装

```bash
# 方式 1: 从源码安装 (推荐)
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# 复制 Skills
mkdir -p ~/.claude/commands/om
cp skills/*.md ~/.claude/commands/om/

# 方式 2: 从插件市场安装 (即将支持)
/plugin marketplace add bigfish1913/openmatrix
/plugin install openmatrix
```

### 5分钟上手

```bash
# 1. 启动任务 (交互式问答)
/om:start 实现用户登录功能

# 2. 回答问题后，OpenMatrix 自动:
#    - 拆解任务为子任务
#    - 分配给合适的 Agent
#    - 执行开发、测试、审查
#    - 自动 Git 提交

# 3. 查看状态
/om:status

# 4. 如果有阻塞问题 (Meeting)
/om:meeting
```

---

## 核心功能

### 7个 Skills 命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `/om:start` | 启动新任务 | `/om:start "实现用户登录"` |
| `/om:status` | 查看执行状态 | `/om:status` |
| `/om:approve` | 审批决策 | `/om:approve APPR-001` |
| `/om:meeting` | 处理阻塞/决策 | `/om:meeting` |
| `/om:resume` | 恢复中断任务 | `/om:resume TASK-001` |
| `/om:retry` | 重试失败任务 | `/om:retry TASK-001` |
| `/om:report` | 生成执行报告 | `/om:report` |

### 6种专用 Agent

| Agent | 职责 | 典型任务 |
|-------|------|---------|
| **Planner** | 任务拆解、计划制定 | 分析需求、设计方案 |
| **Coder** | 代码编写、重构 | 实现功能、修复 Bug |
| **Tester** | 测试用例、执行测试 | 单元测试、覆盖率 |
| **Reviewer** | 代码审查、质量检查 | 安全审查、性能评估 |
| **Researcher** | 搜索资料、知识检索 | 技术调研、方案对比 |
| **Executor** | 执行命令、文件操作 | 构建、部署、清理 |

### 三阶段验证

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Develop   │────▶│   Verify    │────▶│   Accept    │
│   开发阶段   │     │   验证阶段   │     │   验收阶段   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      ▼                   ▼                   ▼
  Coder 编写代码     Tester 运行测试     Reviewer 最终确认
  遵循验收标准       检查覆盖率          验收标准检查
  处理边界情况       Build 测试          生成验收报告
```

### Meeting 机制 (独特)

**问题**: 传统任务系统遇到阻塞就停止，等待用户处理

**OpenMatrix 解决方案**: Meeting 机制

```
执行任务中...
├── TASK-001: 完成 ✓
├── TASK-002: 阻塞 → 创建 Meeting → 跳过，继续 ↷
├── TASK-003: 完成 ✓
└── TASK-004: 阻塞 → 创建 Meeting → 跳过，继续 ↷

执行完成! 📋 有 2 个待处理 Meeting

/om:meeting
  [1] APPR-001: 数据库连接失败 (TASK-002)
  [2] APPR-002: API 设计决策 (TASK-004)

选择处理方式:
  - 💡 提供信息 (解决阻塞)
  - ⏭️ 跳过任务 (标记可选)
  - 🔄 重试 (使用新信息)
  - ✏️ 修改方案 (调整任务)
```

### 三种执行模式

| 模式 | 确认点 | 适用场景 |
|------|--------|---------|
| `confirm-all` | 每阶段后确认 | 重要任务，精细控制 |
| `confirm-key` | plan/merge/deploy | 常规任务 (默认) |
| `auto` | **无确认** | 简单任务，最大化自动化 |

---

## 使用案例

### 案例 1: 快速功能开发

```
/om:start --mode auto 实现一个命令行 TODO 应用

OpenMatrix:
  📋 任务拆解 (5个子任务)
  ├── TASK-001: 数据模型设计 (Planner)
  ├── TASK-002: CLI 命令解析 (Coder)
  ├── TASK-003: 文件存储 (Coder)
  ├── TASK-004: 单元测试 (Tester)
  └── TASK-005: 代码审查 (Reviewer)

  ⏱️ 耗时: 12分钟
  ✅ 状态: 完成
  📁 产出: src/todo.ts, tests/todo.test.ts
```

### 案例 2: Bug 修复

```
/om:start 修复用户登录时的 JWT 过期问题

OpenMatrix:
  📋 任务拆解 (3个子任务)
  ├── TASK-001: 定位问题 (Researcher)
  ├── TASK-002: 修复代码 (Coder)
  └── TASK-003: 回归测试 (Tester)

  ⏱️ 耗时: 5分钟
  ✅ 状态: 完成
```

### 案例 3: 代码重构

```
/om:start --mode confirm-key 重构认证模块，提高可测试性

OpenMatrix:
  📋 任务拆解 (4个子任务)
  ├── TASK-001: 分析现有代码 (Reviewer)
  ├── TASK-002: 设计新架构 (Planner)
  ├── TASK-003: 实现重构 (Coder)
  └── TASK-004: 验证功能 (Tester)

  ⏸️ 暂停: Plan 阶段等待确认
  /om:approve → 继续

  ⏱️ 耗时: 18分钟
  ✅ 状态: 完成
```

---

## 架构

```
┌────────────────────────────────────────────────────────────────┐
│                        用户层 (Claude Code)                      │
│  Skills: /om:start  /om:status  /om:approve  /om:meeting      │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│                      调度层 (Orchestrator)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Parser  │ │ Planner  │ │ Scheduler│ │ ApprovalManager  │   │
│  │ 任务解析  │ │ 任务拆解  │ │ 调度引擎  │ │   审批/Meeting   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│                        执行层 (Agents)                           │
│  ┌────────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌────────────┐   │
│  │Planner │ │ Coder │ │ Tester │ │ Reviewer │ │ Researcher │   │
│  └───┬────┘ └───┬───┘ └───┬────┘ └────┬─────┘ └─────┬──────┘   │
│      └──────────┴─────────┴──────────┴──────────────┘          │
│                         Claude Subagent                         │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│                      存储层 (.openmatrix/)                       │
│  state.json │ tasks/ │ approvals/ │ logs/                       │
└────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
.openmatrix/
├── state.json              # 全局状态
├── config.json             # 配置
├── tasks/
│   ├── index.json          # 任务索引
│   └── TASK-XXX/
│       ├── task.json       # 任务定义
│       ├── plan.md         # 执行计划
│       ├── phases/         # 三阶段记录
│       └── artifacts/      # 产出物
├── approvals/
│   ├── pending/            # 待确认项
│   └── history/            # 已确认历史
└── logs/
    └── orchestrator.log    # 执行日志
```

---

## 配置

`.openmatrixrc.json`:

```json
{
  "timeout": { "default": 120, "max": 600 },
  "retry": { "maxRetries": 3, "backoff": "exponential" },
  "approvalPoints": ["plan", "merge"],
  "agents": {
    "maxConcurrent": 3,
    "model": "claude-sonnet-4-6"
  }
}
```

---

## 开发

```bash
# 克隆 & 安装
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install

# 开发
npm run dev          # 开发模式
npm run build        # 构建
npm test             # 测试
```

---

## 适合谁用？

| 用户类型 | 是否适合 | 原因 |
|---------|---------|------|
| **独立开发者** | ✅ 非常适合 | 快速完成功能，无需复杂配置 |
| **小团队** | ✅ 适合 | 轻量级协作，Git 友好 |
| **需要严格流程的团队** | ⚠️ 考虑 gsd | gsd 提供更完整的项目管理 |
| **追求代码质量的开发者** | ⚠️ 考虑 superpowers | superpowers 有更严格的工作流 |
| **想要最大自动化的用户** | ✅ 非常适合 | auto 模式 + Meeting 机制 |

---

## License

MIT

---

## 相关链接

- [Claude Code 文档](https://docs.anthropic.com/claude-code)
- [superpowers](https://github.com/your-favorite/superpowers)
- [gsd (Get Shit Done)](https://github.com/your-favorite/gsd)
