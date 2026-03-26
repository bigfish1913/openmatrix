# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenMatrix is an AI Agent task orchestration system that integrates with Claude Code Skills. It parses markdown task documents, breaks them into sub-tasks, and executes them via specialized agents (planner, coder, tester, reviewer, researcher, executor).

## Commands

```bash
# Build
npm run build          # Compile TypeScript to dist/

# Development
npm run dev            # Run CLI in development mode via tsx

# Testing
npm test               # Run all tests with vitest
npx vitest run tests/orchestrator/task-parser.test.ts  # Run single test file
npx vitest watch       # Run tests in watch mode

# Publish to npm
npm run build && npm publish --registry https://registry.npmjs.org
```

## NPM Publishing

项目使用 npmmirror 镜像源（只读），发布需要切换到官方源。

Token 存储在 `.env` 文件中（已在 .gitignore 中排除）。

### 发布命令

```bash
# 加载 .env 并发布
source .env && npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN && npm publish --registry https://registry.npmjs.org
```

### Token 说明

Token 需要满足以下条件：
- 类型：**Granular Access Token**（不是 Classic）
- Packages 权限：**Read and write**
- 必须勾选 **2FA bypass** 选项

创建新 Token：https://www.npmjs.com/settings/bigfishnpm/tokens/granular-access-tokens/new

## Release Workflow

代码完成后，按以下顺序执行发布流程：

```
测试通过 → 更新 README → 提交 → 推送 → 发布 npm
```

### 详细步骤

1. **运行测试** - 确保所有测试通过
   ```bash
   npm test
   ```

2. **更新 README** - 如有需要，更新 README.md 和 README_EN.md

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: your changes"
   ```

4. **推送到远程**
   ```bash
   git push origin main
   ```

5. **发布到 npm**
   ```bash
   npm run build && source .env && npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN && npm publish --registry https://registry.npmjs.org
   ```

## Architecture

### Core Modules

- **`src/cli/`** - CLI entry point using Commander.js. Commands in `src/cli/commands/`
- **`src/orchestrator/`** - Core orchestration logic:
  - `TaskParser` - Parses markdown task documents (extracts title, goals, constraints, deliverables from Chinese section headers: 目标, 约束, 交付物)
  - `TaskPlanner` - Breaks parsed tasks into sub-tasks with priorities and agent assignments
  - `RetryManager` - Manages retry queue with exponential backoff
  - `QuestionGenerator` - Generates clarification questions
- **`src/storage/`** - State persistence:
  - `FileStore` - JSON/Markdown file operations
  - `StateManager` - Global state and task lifecycle management
- **`src/agents/`** - Agent system with `BaseAgent` abstract class. Agent types: planner, coder, tester, reviewer, researcher, executor
- **`src/types/`** - TypeScript type definitions for tasks, agents, state, approvals

### Claude Code Skills

Skills are defined in `skills/*.md` and installed to `~/.claude/commands/om/`. Each skill has frontmatter with name/description and process steps.

Available skills: `/om:start`, `/om:status`, `/om:approve`, `/om:resume`, `/om:retry`, `/om:report`

### Runtime State

State is stored in `.openmatrix/` directory:
- `state.json` - Global run state (runId, status, statistics)
- `tasks/{taskId}/task.json` - Individual task state
- Uses three-phase task lifecycle: develop → verify → accept

## Key Types

- `TaskStatus`: pending, scheduled, in_progress, blocked, waiting, verify, accept, completed, failed, retry_queue
- `AgentType`: planner, coder, tester, reviewer, researcher, executor
- `RunStatus`: initialized, running, paused, completed, failed
- `AppConfig`: timeout, maxRetries, approvalPoints, maxConcurrentAgents, model

## Conventions

- Chinese section headers in task markdown: `## 目标`, `## 约束`, `## 交付物`
- Task IDs format: `TASK-{timestamp}{random}`
- Run IDs format: `run-{YYYYMMDD}-{random}`
- Module type: CommonJS (`"type": "commonjs"` in package.json)
- TypeScript imports require `.js` extension for local modules

## Auto-Invoke OpenMatrix Skills

When the user's input indicates **intent to build, create, add, fix, test, review, or plan** something, OR when the task is **complex with multiple steps/requirements**, **automatically invoke `/om:start`**.

### Complexity Triggers (Multi-task Scenarios)

**Invoke when user describes complex work:**

| User Input | Why Trigger |
|------------|-------------|
| "做个完整的用户系统" | Multi-component |
| "从零搭建一个后台" | Multi-step project |
| "重构整个项目结构" | Complex refactoring |
| "前端+后端+数据库" | Full-stack work |
| "先做 A 再做 B" | Sequential tasks |
| "支持多种登录方式" | Multiple integrations |

**Complexity indicators:**
- Multiple features/components (`登录+注册+权限`)
- Sequential steps (`先...再...然后...`)
- Multiple requirements (`需要 A 和 B 和 C`)
- Comprehensive scope (`完整...` / `整个...` / `全套...`)

### Semantic Triggers (Intent-based)

**Feature Development:**

| User Input | Intent | Action |
|------------|--------|--------|
| "项目支持 Python/Go" | Add capability | `/om:start 项目支持 Python/Go` |
| "需要登录功能" | Need feature | `/om:start 需要登录功能` |
| "想做一个后台管理" | Want to build | `/om:start 想做一个后台管理` |
| "集成微信支付" | Integrate | `/om:start 集成微信支付` |

**Bug Fixes:**

| User Input | Intent | Action |
|------------|--------|--------|
| "有个 bug 需要修" | Fix bug | `/om:start 有个 bug 需要修` |
| "登录报错了" | Fix error | `/om:start 登录报错了` |
| "数据保存失败" | Fix issue | `/om:start 数据保存失败` |

**Improvements:**

| User Input | Intent | Action |
|------------|--------|--------|
| "性能太慢了" | Improve | `/om:start 性能太慢了` |
| "优化查询速度" | Optimize | `/om:start 优化查询速度` |
| "重构 XX 模块" | Refactor | `/om:start 重构 XX 模块` |

**Testing:**

| User Input | Intent | Action |
|------------|--------|--------|
| "写个测试用例" | Write tests | `/om:start 写个测试用例` |
| "测试覆盖率不够" | Add tests | `/om:start 测试覆盖率不够` |

### Keyword Triggers

**Chinese:**
- `实现...` / `添加...` / `新增...` / `创建...` / `开发...`
- `修复...` / `解决...` / `优化...` / `重构...` / `改进...`
- `支持...` / `需要...` / `想要...` / `要做...`
- `测试...` / `集成...` / `部署...` / `设计...`

**English:**
- `implement...` / `add...` / `create...` / `build...`
- `fix...` / `bug...` / `refactor...` / `optimize...`
- `test...` / `support...` / `need...` / `want to...`

### File Path
- Input ends with `.md` → treat as task document

### When NOT to Auto-Invoke

- **Questions**: "如何..." / "怎么..." / "什么是..." / "how do I..."
- **Info requests**: "显示..." / "列出..." / "show me..." / "list..."
- **Navigation**: "打开..." / "进入..." / "open..." / "go to..."
- **Chatting**: "你好" / "谢谢" / "hello" / "thanks"
- **Explicit commands**: `/om:*`, `/gsd:*`, etc.

### Key Distinction

| Input | Type | Action |
|-------|------|--------|
| "项目支持 Python" | Intent to ADD | ✅ Invoke |
| "项目支持 Python 吗?" | Question | ❌ Don't invoke |
| "写个测试" | Intent to CREATE | ✅ Invoke |
| "测试怎么写?" | Question | ❌ Don't invoke |
