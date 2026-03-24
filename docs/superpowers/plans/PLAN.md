# OpenMatrix 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基于 Claude API 的多 Agent 协作任务编排系统

**Architecture:** Skills + CLI 混合架构。Claude Code Skills 作为用户交互层，CLI 作为调度核心，Agent 通过子进程并行执行。

**Tech Stack:** TypeScript, Commander, @anthropic-ai/sdk, Chokidar, Winston, Vitest

---

## 文件结构

```
openmatrix/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── storage/
│   │   ├── file-store.ts
│   │   └── state-manager.ts
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── status.ts
│   │       ├── start.ts
│   │       ├── approve.ts
│   │       └── resume.ts
│   ├── orchestrator/
│   │   ├── index.ts
│   │   ├── task-parser.ts
│   │   ├── task-planner.ts
│   │   ├── scheduler.ts
│   │   ├── state-machine.ts
│   │   ├── agent-pool.ts
│   │   ├── approval-manager.ts
│   │   ├── exception-handler.ts
│   │   ├── retry-manager.ts
│   │   └── full-test.ts
│   └── agents/
│       ├── base-agent.ts
│       ├── agent-runner.ts
│       ├── prompts/
│       │   ├── planner.md
│       │   ├── coder.md
│       │   └── executor.md
│       └── impl/
│           ├── planner-agent.ts
│           ├── coder-agent.ts
│           └── executor-agent.ts
├── skills/
│   ├── om-start.md
│   ├── om-status.md
│   ├── om-approve.md
│   ├── om-resume.md
│   ├── om-retry.md
│   └── om-report.md
└── tests/
    └── *.test.ts
```

---

## Phase 1: 核心框架

### Task 1.1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts`

- [ ] **Step 1: 初始化 npm 项目**

```bash
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm install commander chalk @anthropic-ai/sdk chokidar winston
npm install -D typescript @types/node vitest tsx
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 创建入口文件**

```typescript
// src/index.ts
export { Orchestrator } from './orchestrator/index.js';
export { FileStore } from './storage/file-store.js';
export { StateManager } from './storage/state-manager.js';
```

- [ ] **Step 5: 添加 scripts 到 package.json**

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "test": "vitest"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/index.ts
git commit -m "chore: init project with dependencies"
```

---

### Task 1.2: 类型定义

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 写类型定义**

```typescript
// src/types/index.ts

// ============ Task Types ============

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'blocked'
  | 'waiting'
  | 'verify'
  | 'accept'
  | 'completed'
  | 'failed'
  | 'retry_queue';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface TaskPhase {
  status: TaskStatus;
  duration: number | null;
  startedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  timeout: number;
  dependencies: string[];
  assignedAgent: AgentType;
  phases: {
    develop: TaskPhase;
    verify: TaskPhase;
    accept: TaskPhase;
  };
  retryCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============ Agent Types ============

export type AgentType =
  | 'planner'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'researcher'
  | 'executor';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AgentResult {
  runId: string;
  taskId: string;
  agentType: AgentType;
  status: AgentStatus;
  output: string;
  artifacts: string[];
  needsApproval: boolean;
  error?: string;
  duration: number;
  completedAt: string;
}

// ============ State Types ============

export type RunStatus = 'initialized' | 'running' | 'paused' | 'completed' | 'failed';

export interface GlobalState {
  version: string;
  runId: string;
  status: RunStatus;
  currentPhase: 'planning' | 'execution' | 'verification' | 'acceptance';
  startedAt: string;
  config: AppConfig;
  statistics: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    failed: number;
    pending: number;
  };
}

export interface AppConfig {
  timeout: number;
  maxRetries: number;
  approvalPoints: ('plan' | 'merge' | 'deploy')[];
  maxConcurrentAgents: number;
  model: string;
}

// ============ Approval Types ============

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  type: 'plan' | 'merge' | 'deploy' | 'custom';
  taskId: string;
  title: string;
  description: string;
  content: string;
  options: ApprovalOption[];
  status: ApprovalStatus;
  decision?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface ApprovalOption {
  key: string;
  label: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add core type definitions"
```

---

### Task 1.3: 存储层 - FileStore

**Files:**
- Create: `src/storage/file-store.ts`
- Create: `tests/storage/file-store.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/storage/file-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStore } from '../../src/storage/file-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileStore', () => {
  let store: FileStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-test-'));
    store = new FileStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write and read JSON file', async () => {
    const data = { name: 'test', value: 123 };
    await store.writeJson('test.json', data);
    const result = await store.readJson('test.json');
    expect(result).toEqual(data);
  });

  it('should return null for non-existent file', async () => {
    const result = await store.readJson('not-exist.json');
    expect(result).toBeNull();
  });

  it('should check file existence', async () => {
    await store.writeJson('exists.json', { data: 1 });
    expect(await store.exists('exists.json')).toBe(true);
    expect(await store.exists('not-exists.json')).toBe(false);
  });

  it('should write and read markdown file', async () => {
    const content = '# Test\n\nThis is a test.';
    await store.writeMarkdown('test.md', content);
    const result = await store.readMarkdown('test.md');
    expect(result).toBe(content);
  });

  it('should list files in directory', async () => {
    await store.writeJson('dir/a.json', { a: 1 });
    await store.writeJson('dir/b.json', { b: 2 });
    const files = await store.listFiles('dir');
    expect(files).toHaveLength(2);
    expect(files).toContain('a.json');
    expect(files).toContain('b.json');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL - FileStore not implemented

- [ ] **Step 3: 实现 FileStore**

```typescript
// src/storage/file-store.ts
import { readFile, writeFile, mkdir, readdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { constants } from 'fs';

export class FileStore {
  constructor(private basePath: string) {}

  async ensureDir(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(fullPath, { recursive: true });
  }

  async writeJson<T>(path: string, data: T): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async readJson<T>(path: string): Promise<T | null> {
    const fullPath = join(this.basePath, path);
    try {
      const content = await readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeMarkdown(path: string, content: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  async readMarkdown(path: string): Promise<string | null> {
    const fullPath = join(this.basePath, path);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = join(this.basePath, path);
    try {
      await access(fullPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const fullPath = join(this.basePath, dir);
    try {
      const files = await readdir(fullPath, { withFileTypes: true });
      return files
        .filter(f => f.isFile())
        .map(f => f.name);
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/file-store.ts tests/storage/file-store.test.ts
git commit -m "feat: implement FileStore with tests"
```

---

### Task 1.4: 存储层 - StateManager

**Files:**
- Create: `src/storage/state-manager.ts`
- Create: `tests/storage/state-manager.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// tests/storage/state-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StateManager', () => {
  let manager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-test-'));
    manager = new StateManager(tempDir);
    await manager.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize with default state', async () => {
    const state = await manager.getState();
    expect(state.status).toBe('initialized');
    expect(state.version).toBe('1.0');
  });

  it('should update state', async () => {
    await manager.updateState({ status: 'running' });
    const state = await manager.getState();
    expect(state.status).toBe('running');
  });

  it('should create and get task', async () => {
    const task = await manager.createTask({
      title: 'Test Task',
      description: 'Test description',
      priority: 'P0',
      timeout: 120,
      dependencies: [],
      assignedAgent: 'coder'
    });

    expect(task.id).toMatch(/^TASK-/);
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('pending');

    const retrieved = await manager.getTask(task.id);
    expect(retrieved).toEqual(task);
  });

  it('should update task status', async () => {
    const task = await manager.createTask({
      title: 'Test',
      description: 'Test',
      priority: 'P1',
      timeout: 60,
      dependencies: [],
      assignedAgent: 'coder'
    });

    await manager.updateTask(task.id, { status: 'in_progress' });
    const updated = await manager.getTask(task.id);
    expect(updated?.status).toBe('in_progress');
  });

  it('should list all tasks', async () => {
    await manager.createTask({ title: 'A', description: 'A', priority: 'P0', timeout: 60, dependencies: [], assignedAgent: 'coder' });
    await manager.createTask({ title: 'B', description: 'B', priority: 'P0', timeout: 60, dependencies: [], assignedAgent: 'coder' });

    const tasks = await manager.listTasks();
    expect(tasks).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: FAIL

- [ ] **Step 3: 实现 StateManager**

```typescript
// src/storage/state-manager.ts
import { FileStore } from './file-store.js';
import type { GlobalState, Task, AppConfig } from '../types/index.js';

const DEFAULT_CONFIG: AppConfig = {
  timeout: 120,
  maxRetries: 3,
  approvalPoints: ['plan', 'merge'],
  maxConcurrentAgents: 3,
  model: 'claude-sonnet-4-6'
};

export class StateManager {
  private store: FileStore;
  private stateCache: GlobalState | null = null;

  constructor(basePath: string) {
    this.store = new FileStore(basePath);
  }

  async initialize(): Promise<void> {
    const existing = await this.store.readJson<GlobalState>('state.json');
    if (!existing) {
      const initialState: GlobalState = {
        version: '1.0',
        runId: this.generateRunId(),
        status: 'initialized',
        currentPhase: 'planning',
        startedAt: new Date().toISOString(),
        config: DEFAULT_CONFIG,
        statistics: {
          totalTasks: 0,
          completed: 0,
          inProgress: 0,
          failed: 0,
          pending: 0
        }
      };
      await this.store.writeJson('state.json', initialState);
      this.stateCache = initialState;
    } else {
      this.stateCache = existing;
    }
  }

  async getState(): Promise<GlobalState> {
    if (!this.stateCache) {
      this.stateCache = await this.store.readJson<GlobalState>('state.json');
    }
    return this.stateCache!;
  }

  async updateState(updates: Partial<GlobalState>): Promise<void> {
    const state = await this.getState();
    const newState = { ...state, ...updates };
    await this.store.writeJson('state.json', newState);
    this.stateCache = newState;
  }

  async createTask(input: {
    title: string;
    description: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    timeout: number;
    dependencies: string[];
    assignedAgent: string;
  }): Promise<Task> {
    const taskId = this.generateTaskId();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      title: input.title,
      description: input.description,
      status: 'pending',
      priority: input.priority,
      timeout: input.timeout,
      dependencies: input.dependencies,
      assignedAgent: input.assignedAgent as any,
      phases: {
        develop: { status: 'pending', duration: null },
        verify: { status: 'pending', duration: null },
        accept: { status: 'pending', duration: null }
      },
      retryCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now
    };

    await this.store.writeJson(`tasks/${taskId}/task.json`, task);

    // Update statistics
    const state = await this.getState();
    await this.updateState({
      statistics: {
        ...state.statistics,
        totalTasks: state.statistics.totalTasks + 1,
        pending: state.statistics.pending + 1
      }
    });

    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return await this.store.readJson<Task>(`tasks/${taskId}/task.json`);
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.store.writeJson(`tasks/${taskId}/task.json`, updatedTask);

    // Update statistics if status changed
    if (updates.status && updates.status !== task.status) {
      await this.updateTaskStatistics(task.status, updates.status);
    }
  }

  async listTasks(): Promise<Task[]> {
    const dirs = await this.store.listFiles('tasks');
    const tasks: Task[] = [];

    for (const dir of dirs) {
      const task = await this.getTask(dir);
      if (task) tasks.push(task);
    }

    return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private async updateTaskStatistics(oldStatus: string, newStatus: string): Promise<void> {
    const state = await this.getState();
    const stats = { ...state.statistics };

    // Decrement old status count
    if (oldStatus === 'pending') stats.pending--;
    else if (oldStatus === 'in_progress') stats.inProgress--;
    else if (oldStatus === 'completed') stats.completed--;
    else if (oldStatus === 'failed') stats.failed--;

    // Increment new status count
    if (newStatus === 'pending') stats.pending++;
    else if (newStatus === 'in_progress') stats.inProgress++;
    else if (newStatus === 'completed') stats.completed++;
    else if (newStatus === 'failed') stats.failed++;

    await this.updateState({ statistics: stats });
  }

  private generateRunId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6);
    return `run-${date}-${rand}`;
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `TASK-${timestamp}${rand}`;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage/state-manager.ts tests/storage/state-manager.test.ts
git commit -m "feat: implement StateManager with tests"
```

---

### Task 1.5: CLI 基础

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/commands/status.ts`

- [ ] **Step 1: 创建 CLI 入口**

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('openmatrix')
  .description('AI Agent Task Orchestration System')
  .version('1.0.0');

program.addCommand(statusCommand);

program.parse();
```

- [ ] **Step 2: 创建 status 命令**

```typescript
// src/cli/commands/status.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show current execution status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const manager = new StateManager('.openmatrix');

    try {
      await manager.initialize();
      const state = await manager.getState();
      const tasks = await manager.listTasks();

      if (options.json) {
        console.log(JSON.stringify({ state, tasks }, null, 2));
        return;
      }

      // Human readable output
      console.log(chalk.bold('\n📊 OpenMatrix Status\n'));
      console.log(`  Run ID: ${chalk.cyan(state.runId)}`);
      console.log(`  Status: ${formatStatus(state.status)}`);
      console.log(`  Phase:  ${chalk.yellow(state.currentPhase)}`);
      console.log(`  Started: ${state.startedAt}\n`);

      console.log(chalk.bold('📈 Statistics'));
      console.log(`  Total: ${state.statistics.totalTasks}`);
      console.log(`  ✅ Completed: ${chalk.green(state.statistics.completed)}`);
      console.log(`  🔄 In Progress: ${chalk.blue(state.statistics.inProgress)}`);
      console.log(`  ⏳ Pending: ${chalk.gray(state.statistics.pending)}`);
      console.log(`  ❌ Failed: ${chalk.red(state.statistics.failed)}\n`);

      if (tasks.length > 0) {
        console.log(chalk.bold('📋 Tasks'));
        for (const task of tasks) {
          const status = formatTaskStatus(task.status);
          console.log(`  ${status} ${task.id}: ${task.title}`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

function formatStatus(status: string): string {
  const colors: Record<string, string> = {
    initialized: 'gray',
    running: 'green',
    paused: 'yellow',
    completed: 'green',
    failed: 'red'
  };
  const color = colors[status] || 'white';
  return chalk[color](status);
}

function formatTaskStatus(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    scheduled: '📅',
    in_progress: '🔄',
    blocked: '🚫',
    completed: '✅',
    failed: '❌'
  };
  return icons[status] || '❓';
}
```

- [ ] **Step 3: 更新 package.json bin**

```json
{
  "bin": {
    "openmatrix": "./dist/cli/index.js"
  }
}
```

- [ ] **Step 4: 构建并测试**

```bash
npm run build
node dist/cli/index.js status
```

Expected: Status output displayed

- [ ] **Step 5: Commit**

```bash
git add src/cli/index.ts src/cli/commands/status.ts package.json
git commit -m "feat: add CLI with status command"
```

---

### Task 1.6: Skill - om:status

**Files:**
- Create: `skills/om-status.md`

- [ ] **Step 1: 创建 Skill 文件**

```markdown
# OpenMatrix: Status

查看当前任务执行状态。

## 使用

```
/om:status
```

## 流程

1. 读取 `.openmatrix/state.json` 获取全局状态
2. 读取 `.openmatrix/tasks/` 下所有任务
3. 展示格式化状态概览

## 输出示例

```
📊 OpenMatrix Status

  Run ID: run-20240323-abc1
  Status: running
  Phase:  execution
  Started: 2024-03-23T10:00:00Z

📈 Statistics
  Total: 10
  ✅ Completed: 3
  🔄 In Progress: 2
  ⏳ Pending: 4
  ❌ Failed: 1

📋 Tasks
  ✅ TASK-001: 用户登录功能
  ✅ TASK-002: 数据验证模块
  🔄 TASK-003: API 接口开发
  🔄 TASK-004: 前端页面
  ⏳ TASK-005: 单元测试
  ...
```

## 状态文件位置

- 全局状态: `.openmatrix/state.json`
- 任务详情: `.openmatrix/tasks/TASK-XXX/task.json`
```

- [ ] **Step 2: Commit**

```bash
git add skills/om-status.md
git commit -m "feat: add om:status skill"
```

---

## Phase 1 验证

- [ ] `npm run build` 无编译错误
- [ ] `openmatrix status` 命令正常运行
- [ ] 所有测试通过

---

## Phase 2-4 简要任务列表

详见设计文档 [2024-03-23-openmatrix-design.md](../specs/2024-03-23-openmatrix-design.md)

### Phase 2: 调度器核心
- 2.1 任务解析器 - `src/orchestrator/task-parser.ts`
- 2.2 问题生成器 - `src/orchestrator/question-generator.ts`
- 2.3 Skill: om:start - `skills/om-start.md`
- 2.4 任务拆解器 - `src/orchestrator/task-planner.ts`
- 2.5 调度引擎 - `src/orchestrator/scheduler.ts`
- 2.6 状态机 - `src/orchestrator/state-machine.ts`

### Phase 3: Agent 系统
- 3.1 Agent 基类 - `src/agents/base-agent.ts`
- 3.2 Agent 运行器 - `src/agents/agent-runner.ts`
- 3.3 Planner Agent - `src/agents/impl/planner-agent.ts`
- 3.4 Coder Agent - `src/agents/impl/coder-agent.ts`
- 3.5 Executor Agent - `src/agents/impl/executor-agent.ts`
- 3.6 Agent 集成 - `src/orchestrator/index.ts`

### Phase 4: 完整流程
- 4.1 Agent 池管理 - `src/orchestrator/agent-pool.ts`
- 4.2 确认管理器 - `src/orchestrator/approval-manager.ts`
- 4.3 Skill: om:approve - `skills/om-approve.md`
- 4.4 异常分类器 - `src/orchestrator/exception-handler.ts`
- 4.5 重试管理器 - `src/orchestrator/retry-manager.ts`
- 4.6 Skill: om:retry - `skills/om-retry.md`
- 4.7 全功能测试 - `src/orchestrator/full-test.ts`
- 4.8 Skill: om:resume - `skills/om-resume.md`
- 4.9 Skill: om:report - `skills/om-report.md`
