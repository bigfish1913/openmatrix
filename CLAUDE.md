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

When the user's input matches any of these patterns, **automatically invoke `/om:start`** without asking for clarification:

### Trigger Patterns

**Chinese patterns:**
- `实现...功能` / `实现...`
- `添加...` / `新增...`
- `修复...` / `修复...bug`
- `优化...` / `重构...`
- `创建...` / `编写...`
- `开发...` / `构建...`
- `更新...功能` / `改进...`
- Any sentence starting with a verb + noun describing a development task

**English patterns:**
- `implement...` / `add...` / `create...`
- `fix...` / `bug...` / `issue...`
- `build...` / `develop...`
- `refactor...` / `optimize...`
- `update...` / `improve...`

### How It Works

```
User input: "实现用户登录功能"
     │
     ▼ (Auto-detect)
     │
     ▼
Invoke: /om:start 实现用户登录功能
```

### Examples

| User Input | Auto Action |
|------------|-------------|
| `实现用户登录功能` | `/om:start 实现用户登录功能` |
| `fix the login bug` | `/om:start fix the login bug` |
| `添加 API 接口` | `/om:start 添加 API 接口` |
| `优化首页性能` | `/om:start 优化首页性能` |
| `docs/task.md` | `/om:start docs/task.md` |

### When NOT to Auto-Invoke

- User explicitly types `/om:*` commands
- User is asking questions (e.g., "how do I...", "what is...")
- User is requesting information (e.g., "show me...", "list...")
- User is navigating files (e.g., "read file X", "open folder")
