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
