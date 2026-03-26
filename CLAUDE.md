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

## Release Process

When the user requests "提交 更新readme 发布 推送", follow these steps:

### 1. Commit Changes
```bash
# Check git status
git status

# Stage relevant files (exclude .claude/settings.local.json and .gitignore)
git add CLAUDE.md README.md skills/ src/ package.json

# Commit with version bump message
git commit -m "0.1.16

feat: add E2E test support for Web/Mobile/GUI applications

- Add e2eTests field to QualityConfig
- E2E tests optional in strict/balanced modes (time-consuming)
- Support Playwright/Cypress/Appium/Detox frameworks
- Generate E2E test task in task breakdown when enabled
- Update quality gates to 7 (was 6)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
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