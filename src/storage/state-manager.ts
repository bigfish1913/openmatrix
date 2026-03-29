import { FileStore } from './file-store.js';
import type { GlobalState, Task, AppConfig, TaskStatus, Approval, ApprovalStatus } from '../types/index.js';

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

    // Create artifacts subdirectory
    await this.store.ensureDir(`tasks/${taskId}/artifacts`);

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
    // Try subdirectory structure first, fall back to flat file
    let task = await this.store.readJson<Task>(`tasks/${taskId}/task.json`);
    if (!task) {
      task = await this.store.readJson<Task>(`tasks/${taskId}.json`);
    }
    return task;
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

    // Always write to subdirectory structure
    await this.store.writeJson(`tasks/${taskId}/task.json`, updatedTask);

    // Update statistics if status changed
    if (updates.status && updates.status !== oldStatus) {
      await this.updateTaskStatistics(oldStatus, updates.status);
    }
  }

  async listTasks(): Promise<Task[]> {
    const tasks: Task[] = [];

    // Read from subdirectory structure: tasks/TASK-XXX/task.json
    const dirs = await this.store.listDirs('tasks');
    for (const dir of dirs) {
      const task = await this.store.readJson<Task>(`tasks/${dir}/task.json`);
      if (task) tasks.push(task);
    }

    // Also check flat files (backward compat)
    const files = await this.store.listFiles('tasks');
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const task = await this.store.readJson<Task>(`tasks/${file}`);
      if (task) {
        // Avoid duplicate if already found in subdirectory
        if (!tasks.some(t => t.id === task.id)) {
          tasks.push(task);
        }
      }
    }

    return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // ============ Task Artifact Methods ============

  /**
   * 保存 Phase 结果到任务子目录
   */
  async savePhaseResult(taskId: string, phase: string, result: Record<string, unknown>): Promise<void> {
    await this.store.writeJson(`tasks/${taskId}/${phase}.json`, {
      taskId,
      phase,
      timestamp: new Date().toISOString(),
      ...result
    });
  }

  /**
   * 读取 Phase 结果
   */
  async getPhaseResult(taskId: string, phase: string): Promise<Record<string, unknown> | null> {
    return await this.store.readJson(`tasks/${taskId}/${phase}.json`);
  }

  /**
   * 保存 Agent 上下文到 context.md
   */
  async saveTaskContext(taskId: string, content: string): Promise<void> {
    await this.store.writeMarkdown(`tasks/${taskId}/context.md`, content);
  }

  /**
   * 读取 Agent 上下文
   */
  async getTaskContext(taskId: string): Promise<string | null> {
    return await this.store.readMarkdown(`tasks/${taskId}/context.md`);
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
    const count = this.stateCache?.statistics.totalTasks ?? 0;
    const seq = count + 1;
    return `TASK-${String(seq).padStart(3, '0')}`;
  }

  // ============ Approval Methods ============

  async saveApproval(approval: Approval): Promise<void> {
    await this.store.writeJson(`approvals/${approval.id}.json`, approval);
  }

  async getApproval(approvalId: string): Promise<Approval | null> {
    return await this.store.readJson<Approval>(`approvals/${approvalId}.json`);
  }

  async updateApproval(approval: Approval): Promise<void> {
    await this.store.writeJson(`approvals/${approval.id}.json`, approval);
  }

  async getApprovalsByStatus(status: ApprovalStatus): Promise<Approval[]> {
    const files = await this.store.listFiles('approvals');
    const approvals: Approval[] = [];

    for (const file of files) {
      const approval = await this.store.readJson<Approval>(`approvals/${file}`);
      if (approval && approval.status === status) {
        approvals.push(approval);
      }
    }

    return approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getAllApprovals(): Promise<Approval[]> {
    const files = await this.store.listFiles('approvals');
    const approvals: Approval[] = [];

    for (const file of files) {
      const approval = await this.store.readJson<Approval>(`approvals/${file}`);
      if (approval) {
        approvals.push(approval);
      }
    }

    return approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // ============ Meeting Methods ============

  async saveMeeting(meeting: any): Promise<void> {
    await this.store.writeJson(`meetings/${meeting.id}.json`, meeting);
  }

  async getMeeting(meetingId: string): Promise<any | null> {
    return await this.store.readJson(`meetings/${meetingId}.json`);
  }

  async getMeetingsByStatus(status: string): Promise<any[]> {
    const files = await this.store.listFiles('meetings');
    const meetings: any[] = [];

    for (const file of files) {
      const meeting = await this.store.readJson<{ id: string; status: string; createdAt: string }>(`meetings/${file}`);
      if (meeting && meeting.status === status) {
        meetings.push(meeting);
      }
    }

    return meetings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
