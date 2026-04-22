# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

```bash
# Build the TypeScript project
npm run build

# Run tests
npm test

# Run a single test file
npx vitest run tests/orchestrator/executor.test.ts

# Run tests in watch mode
npm test -- --watch

# Development CLI (run without building)
npm run dev -- <command>
```

## Core Philosophy

**OpenMatrix 的核心思想：让 AI 做 AI 擅长的事，让 CLI 做 CLI 擅长的事。**

### 分层职责原则

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

### 反模式（禁止）

```typescript
// ❌ 错误：CLI 用硬编码规则模拟 AI 推荐
function generateRecommendations(envInfo) {
  if (hasDockerfile && !hasCIConfig) {
    return { recommended: 'local', reason: '检测到 Dockerfile' };
  }
  // ...更多 if/else
}

// ✅ 正确：CLI 只输出原始数据，AI 自己分析
function buildRawOutput(envInfo) {
  return { projectType, buildTools, deployOptions, ciConfig, summary };
}
```

```markdown
// ❌ 错误：Skill 依赖 CLI 的推荐字段
const rec = cliOutput.recommendations.deployMethod.recommended;

// ✅ 正确：Skill 读取原始数据，AI 自己判断
// Bash: ls Dockerfile docker-compose.yml Makefile
// Bash: docker --version && make --version
// → AI 看到这些结果，自己决定推荐什么
```

### 设计决策记录

**om:deploy 的演进：**
- v1：CLI 硬编码推荐逻辑（if/else 规则树）→ 脆弱，无法处理边界情况
- v2：CLI 输出原始数据 + Skill AI 分析 → 正确分层，AI 做 AI 的事

**核心洞察：** 推荐逻辑本质上是"理解上下文后的判断"，这正是 LLM 的强项。
用代码模拟这个过程，不仅代码复杂，还不如 AI 直接看数据判断准确。

---

## Project Overview

OpenMatrix is an AI Agent task orchestration system that integrates with Claude Code Skills. It provides automated task execution with quality gates (TDD, coverage, lint, security), multiple execution modes (strict/balanced/fast), and a Meeting mechanism for handling blocked tasks without interrupting execution.

## Architecture

### Core Components

```
src/
├── orchestrator/     # Core orchestration logic
│   ├── executor.ts       # Main execution loop, coordinates task dispatch
│   ├── scheduler.ts      # Task scheduling and dependency resolution
│   ├── state-machine.ts  # Task status transitions (pending→scheduled→in_progress→verify→accept→completed)
│   ├── phase-executor.ts # Phase-level execution (develop/verify/accept)
│   ├── task-planner.ts   # Task decomposition from user input
│   └── meeting-manager.ts # Handles blocked task records
├── agents/           # Agent implementations
│   ├── base-agent.ts     # Base agent class
│   ├── agent-runner.ts   # Prepares SubagentTask for Claude Code Agent tool
│   └── impl/             # Specific agents: planner, coder, tester, reviewer, researcher, executor
├── storage/          # State persistence
│   ├── state-manager.ts  # Global state management
│   └── file-store.ts     # File-based storage
├── types/            # TypeScript type definitions
│   └── index.ts          # Task, AgentType, QualityConfig, etc.
└── cli/              # CLI commands
    └── commands/         # start, auto, status, approve, meeting, resume, retry, report
```

### Task Lifecycle

```
pending → scheduled → in_progress → verify → accept → completed
                │            │           │        │
                │            ▼           ▼        ▼
                │        blocked      failed   failed
                │            │
                │            ▼
                └───────► waiting (Meeting)
```

### Quality Levels

| Level | TDD | Coverage | Lint | Security | E2E Tests | Use Case |
|-------|-----|----------|------|----------|-----------|----------|
| strict | ✅ | >80% | strict | ✅ | ❓ optional | Production code |
| balanced | ❌ | >60% | ✅ | ✅ | ❓ optional | Daily development |
| fast | ❌ | >20% | ❌ | ❌ | ❌ | Quick prototypes |

> E2E tests are time-consuming, so they are optional even in strict mode.

### Skills and CLI Integration

The project provides Claude Code Skills in `skills/` directory. Skills drive the orchestration by:
1. Using CLI (`openmatrix start`, `openmatrix complete`) to manage state
2. Reading SubagentTask from state files
3. Calling Agent tool to execute subagents
4. Handling approvals and meetings via AskUserQuestion

Key skills:
- `/om:start` - Start new task execution with interactive questions
- `/om:auto` - Fully automatic execution (bypasses all approvals except meetings)
- `/om:status` - Check current execution state
- `/om:meeting` - Handle blocked tasks

## Key Types (src/types/index.ts)

- `Task` - Task entity with status, phases, dependencies, acceptance criteria
- `AgentType` - 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor'
- `SubagentTask` - Configuration for Agent tool invocation
- `QualityConfig` - Quality gate settings (tdd, minCoverage, strictLint, securityScan, e2eTests)
- `GlobalState` - Overall run state with config and statistics

## State Storage

State is persisted in `.openmatrix/` directory:
- `state.json` - Global state (runId, status, currentPhase, config, statistics)
- `tasks/` - Individual task files
- `approvals/` - Approval records including meetings

## Development Notes

- TypeScript with ES2022 target, NodeNext modules
- Uses ES modules (.js extensions in imports required)
- CLI entry point: `dist/cli/index.js` (after build)
- Tests use Vitest framework

## Documentation Sync

**IMPORTANT**: `README.md` (Chinese) and `README_EN.md` (English) must always be synchronized.

When updating README:
1. Update `README.md` first
2. Then update `README_EN.md` with equivalent English content
3. Both files must have identical structure and information

Key sections to sync:
- Badges (npm version, downloads, GitHub stars)
- Quality levels table
- Quality gates
- Quality report JSON
- Configuration example
- Roadmap
- Star history chart

## Release Process

When the user requests "提交 更新readme 发布 推送", follow these steps:

### 1. Commit Changes
```bash
# Check git status
git status

# Stage relevant files (exclude .claude/settings.local.json and .gitignore)
git add CLAUDE.md README.md README_EN.md skills/ src/ package.json

# Commit with version bump message
git commit -m "0.1.16

feat: add E2E test support for Web/Mobile/GUI applications

- Add e2eTests field to QualityConfig
- E2E tests optional in strict/balanced modes (time-consuming)
- Support Playwright/Cypress/Appium/Detox frameworks
- Generate E2E test task in task breakdown when enabled
- Update quality gates to 7 (was 6)

Co-Authored-By:  openmatrix"
```

### 2. Build and Verify
```bash
npm run build && npm test -- --run
```

### 3. Publish to NPM
```bash
npm publish
```

### 4. Push to GitHub
```bash
git push origin main
```

### Version Bump Guide

| Change Type | Version Example |
|-------------|-----------------|
| Major feature/breaking | 0.2.0 |
| Minor feature | 0.1.16 |
| Bug fix | 0.1.15 → 0.1.16 |

Update version in:
1. `package.json` - version field
2. Commit message - include version number