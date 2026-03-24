import { FileStore } from './file-store.js';
import type { GlobalState, Task, AppConfig, TaskStatus } from '../types/index.js';

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

    const oldStatus = task.status;
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.store.writeJson(`tasks/${taskId}/task.json`, updatedTask);

    // Update statistics if status changed
    if (updates.status && updates.status !== oldStatus) {
      await this.updateTaskStatistics(oldStatus, updates.status);
    }
  }

  async listTasks(): Promise<Task[]> {
    const dirs = await this.store.listDirs('tasks');
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
