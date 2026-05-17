# OpenMatrix 项目概览文档 (MATRIX.md)

## 项目简介

**OpenMatrix** 是一个基于 Node.js/TypeScript 的 AI Agent 任务编排系统，专注于与 Claude Code Skills 集成。项目的核心价值主张是"你的代码没测试？OpenMatrix 自动帮你补，覆盖率 >80%"，实现自动化测试生成和高质量代码交付。

- **版本**: 0.2.27
- **许可证**: MIT
- **Node.js 要求**: >=18.0.0
- **核心定位**: AI Agent 任务编排 + 自动化测试生成

---

## 架构概览

### 整体架构

OpenMatrix 采用分层架构设计，从底层存储到顶层 CLI 命令形成完整的任务编排系统：

```
┌─────────────────────────────────────────────────────────┐
│                    CLI Commands Layer                     │
│  (approve, auto, brainstorm, check, debug, deploy...)   │
├─────────────────────────────────────────────────────────┤
│                    Orchestrator Layer                    │
│  (executor, approval-manager, debug-manager, ai-reviewer)│
├─────────────────────────────────────────────────────────┤
│                      Agents Layer                        │
│     (coder, planner, reviewer, tester, executor...)    │
├─────────────────────────────────────────────────────────┤
│                     Storage Layer                        │
│           (state-manager, file-store)                   │
├─────────────────────────────────────────────────────────┤
│              Claude Code Skills Integration              │
│                    (skills/*.md)                         │
└─────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 位置 | 职责 |
|------|------|------|
| **Agents** | `src/agents/` | 定义各类 Agent（规划者、编码者、测试者、审核者等） |
| **Orchestrator** | `src/orchestrator/` | 任务编排核心，管理执行流程、审批、调试、Git 提交等 |
| **CLI** | `src/cli/` | 命令行接口，提供用户交互入口 |
| **Storage** | `src/storage/` | 状态持久化和文件存储管理 |
| **Skills** | `skills/` | Claude Code Skills 定义文件 |

---

## 关键目录说明

### 源代码目录

| 目录 | 作用 |
|------|------|
| `src/agents/impl/` | Agent 具体实现：coder-agent（编码）、planner-agent（规划）、reviewer-agent（审核）、tester-agent（测试）、executor-agent（执行）、researcher-agent（研究） |
| `src/agents/agent-runner.ts` | Agent 运行器，负责启动和管理 Agent 执行 |
| `src/cli/commands/` | CLI 命令实现：approve（审批）、auto（自动化）、brainstorm（头脑风暴）、check（检查）、debug（调试）、deploy（部署）、meeting（会议）等 |
| `src/orchestrator/` | 核心编排器：executor（执行器）、approval-manager（审批管理）、debug-manager（调试管理）、ai-reviewer（AI 审核）、git-commit-manager（Git 提交管理）、full-test-runner（完整测试运行）等 |
| `src/storage/` | 存储层：state-manager（状态管理）、file-store（文件存储） |
| `src/types/` | TypeScript 类型定义 |
| `src/utils/` | 工具函数：logger（日志）、error-handler（错误处理）、progress-reporter（进度报告） |
| `src/test/` | 测试相关：context-analyzer（上下文分析）、generator（生成器） |

### 运行时目录

| 目录 | 作用 |
|------|------|
| `.openmatrix/` | 主运行目录，存储运行状态、任务数据、日志 |
| `.openmatrix/run-{timestamp}-{id}/` | 每次运行的独立目录，包含 state.json、tasks/、context.md |
| `.openmatrix/tasks/TASK-XXX/` | 任务存储目录，每个任务包含 task.json 和 artifacts/ |
| `.openmatrix/approvals/` | 审批记录存储 |
| `.openmatrix/debug/` | 调试信息存储（DEBUG-*.json） |
| `.openmatrix/logs/` | 运行日志（combined.log、error.log） |

### 配置与文档目录

| 目录 | 作用 |
|------|------|
| `skills/` | Claude Code Skills 定义（*.md 文件），如 approve.md、auto.md、feature.md 等 |
| `docs/` | 项目文档：架构设计、流程说明、术语定义、路线图 |
| `scripts/` | 构建脚本：build-check.js、install-skills.js |
| `tests/` | 测试文件：单元测试、集成测试、E2E 测试 |

---

## 常用开发命令

### 构建与开发

```bash
# 编译 TypeScript
npm run build

# 开发模式运行（使用 tsx 直接执行）
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

### 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage  # (可能需要额外配置)
```

### 运行时命令（CLI）

OpenMatrix 作为 CLI 工具提供多种命令：

```bash
# 主要命令
openmatrix om         # 核心任务编排命令
openmatrix auto       # 自动化执行
openmatrix feature    # 功能开发流程
openmatrix debug      # 调试模式
openmatrix test       # 测试相关
openmatrix approve    # 审批管理
openmatrix check      # 检查和验证
openmatrix deploy     # 部署相关
openmatrix brainstorm # 头脑风暴
openmatrix meeting    # 会议管理
openmatrix complete   # 完成任务
```

### 安装与初始化

```bash
# 安装依赖
npm install

# 安装后自动执行 skills 安装脚本
# 见 scripts/install-skills.js
```

---

## 核心业务流程

### 任务编排流程

基于目录结构和模块分析，OpenMatrix 的核心业务流程如下：

```
1. 任务初始化
   └── CLI 命令触发
       └── 创建 run-{timestamp}-{id}/ 目录
           └── 初始化 state.json
           └── 创建 context.md

2. 任务规划
   └── PlannerAgent 分析需求
       └── 生成任务列表 (TASK-001, TASK-002...)
           └── 每个 TASK 包含 task.json + artifacts/

3. 任务执行
   └── ExecutorAgent 执行任务
       └── CoderAgent 编写代码
       └── TesterAgent 生成测试
       └── ReviewerAgent 审核代码

4. 审批流程
   └── ApprovalManager 管理审批
       └── 等待用户审批
       └── 记录到 approvals/

5. 调试与修复
   └── DebugManager 处理异常
       └── 生成调试报告
       └── 记录到 debug/

6. 质量检查
   └── FullTestRunner 运行完整测试
       └── AIReviewer 进行 AI 审核
       └── 确保覆盖率 >80%

7. 完成与提交
   └── GitCommitManager 管理 Git 提交
       └── 更新最终状态
```

### 状态管理

- **state.json**: 记录运行状态，包含当前阶段、任务进度、环境信息
- **context.md**: 维护运行上下文，供 Agent 参考
- **feature-context.md / feature-progress.md**: 功能开发专用上下文和进度跟踪

### Agent 协作模式

项目采用多 Agent 协作模式：

| Agent | 职责 | 触发场景 |
|-------|------|----------|
| **PlannerAgent** | 任务分解与规划 | 任务初始化 |
| **ResearcherAgent** | 信息收集与研究 | 需要背景信息时 |
| **CoderAgent** | 代码编写 | 开发阶段 |
| **TesterAgent** | 测试生成 | 测试阶段 |
| **ReviewerAgent** | 代码审核 | 审核阶段 |
| **ExecutorAgent** | 执行具体操作 | 执行阶段 |

---

## 关键模式与约定

### 1. 命名约定

- **运行目录**: `run-{YYYYMMDD}-{randomId}/` (如 `run-20260516-te1g/`)
- **任务目录**: `TASK-{number}/` (如 `TASK-001/`, `TASK-002/`)
- **调试文件**: `DEBUG-{randomId}.json`
- **审批文件**: `APPR-{randomId}.json`
- **会议文件**: `meeting-{randomId}.json`

### 2. 存储模式

每个运行实例独立存储：
```
.openmatrix/
├── run-xxx-xxx/          # 运行实例
│   ├── state.json        # 状态快照
│   ├── context.md        # 上下文文档
│   └── tasks/            # 任务集合
│       └── TASK-001/
│           ├── task.json     # 任务定义
│           └── artifacts/    # 产出物
```

### 3. Skills 集成模式

Skills 目录下的 `.md` 文件定义了 Claude Code 可执行的能力：
- 每个 skill 对应一个 CLI 命令
- 通过 `scripts/install-skills.js` 安装到 Claude Code 环境
- 支持: approve, auto, brainstorm, check, debug, deploy, feature, meeting, om 等

### 4. 编译与模块系统

- **TypeScript 配置**: ES2022 target, NodeNext module
- **输出**: CommonJS (`"type": "commonjs"`)
- **入口**: `dist/cli/index.js` (CLI), `dist/index.js` (Library)

---

## 开发注意事项

### 环境要求

- Node.js >= 18.0.0
- TypeScript 5.3.3+
- 依赖: chalk (输出着色), chokidar (文件监控), commander (CLI), winston (日志)

### 开发流程建议

1. **修改代码前**: 运行 `npm run typecheck` 确保类型正确
2. **添加新功能**: 
   - 在 `src/cli/commands/` 添加命令
   - 在 `skills/` 添加对应的 skill 定义
   - 更新 `src/orchestrator/` 相关模块
3. **测试驱动**: 
   - 单元测试放在 `tests/` 对应目录
   - E2E 测试放在 `tests/e2e/`
   - 使用 vitest 框架

### 测试策略

```
tests/
├── agents/           # Agent 测试
├── cli/commands/     # CLI 命令测试
├── e2e/              # 端到端测试
│   ├── baselines/    # 基线数据
│   ├── fixtures/     # 测试固件
│   └── helpers/      # 测试辅助函数
├── integration/      # 集成测试
├── orchestrator/     # 编排器测试
├── skills/           # Skills 测试
├── storage/          # 存储层测试
└── utils/            # 工具函数测试
```

### 关键开发点

1. **状态管理**: 所有状态变更通过 StateManager，确保持久化一致性
2. **错误处理**: 使用 `src/utils/error-handler.ts` 统一处理异常
3. **日志记录**: 使用 winston logger，日志输出到 `.openmatrix/logs/`
4. **Git 忽略**: 运行 `check-gitignore` 命令验证 .gitignore 配置
5. **审批机制**: 涉及重要操作需要审批确认

### 注意事项

- **运行目录隔离**: 每次运行创建独立目录，避免状态污染
- **调试信息**: 所有调试信息保存在 `.openmatrix/debug/`
- **测试覆盖率**: 项目目标 >80%，使用 full-test-runner 确保质量
- **多实例支持**: 支持 `.openmatrix-test-executor/` 等多个测试实例目录

---

## 扩展与集成

### Claude Code 集成

项目通过 `.claude-plugin/marketplace.json` 定义插件配置，Skills 通过 Markdown 文件定义可执行能力。

### 可扩展点

1. **新增 Agent**: 继承基础 Agent 类，在 `src/agents/impl/` 添加实现
2. **新增命令**: 在 `src/cli/commands/` 添加命令处理
3. **新增 Skill**: 在 `skills/` 添加 Markdown 定义文件

---

## 参考文档

- `docs/ARCHITECTURE.md` - 架构详细说明
- `docs/FLOW.md` - 流程说明
- `docs/TERMINOLOGY.md` - 术语定义
- `docs/ROADMAP.md` - 发展路线图
- `docs/CORE_VALUE.md` - 核心价值说明