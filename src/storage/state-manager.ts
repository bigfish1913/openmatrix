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
  private writeLock: Promise<void> = Promise.resolve();

  constructor(basePath: string) {
    this.store = new FileStore(basePath);
  }

  /**
   * 串行化异步写操作，防止并发 read-modify-write 竞态
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeLock;
    let resolve: () => void;
    this.writeLock = new Promise(r => { resolve = r; });
    await prev;
    try {
      return await fn();
    } finally {
      resolve!();
    }
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
          pending: 0,
          scheduled: 0,
          blocked: 0,
          waiting: 0,
          verify: 0,
          accept: 0,
          retry_queue: 0
        }
      };
      await this.store.writeJson('state.json', initialState);
      this.stateCache = initialState;
    } else {
      // 合并旧状态的统计字段（兼容旧版本）
      existing.statistics = {
        totalTasks: existing.statistics.totalTasks ?? 0,
        completed: existing.statistics.completed ?? 0,
        inProgress: existing.statistics.inProgress ?? 0,
        failed: existing.statistics.failed ?? 0,
        pending: existing.statistics.pending ?? 0,
        scheduled: existing.statistics.scheduled ?? 0,
        blocked: existing.statistics.blocked ?? 0,
        waiting: existing.statistics.waiting ?? 0,
        verify: existing.statistics.verify ?? 0,
        accept: existing.statistics.accept ?? 0,
        retry_queue: existing.statistics.retry_queue ?? 0
      };
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
    await this.withLock(async () => {
      const state = await this.getState();
      const newState = { ...state, ...updates };
      await this.store.writeJson('state.json', newState);
      this.stateCache = newState;
    });
  }

  async createTask(input: {
    title: string;
    description: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    timeout: number;
    dependencies: string[];
    assignedAgent: string;
  }): Promise<Task> {
    return this.withLock(async () => {
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
      const newState = {
        ...state,
        statistics: {
          ...state.statistics,
          totalTasks: state.statistics.totalTasks + 1,
          pending: state.statistics.pending + 1
        }
      };
      await this.store.writeJson('state.json', newState);
      this.stateCache = newState;

      return task;
    });
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
    await this.withLock(async () => {
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
    });
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
    // 直接写入状态，不经过 updateState（避免重入锁死锁）
    const state = await this.getState();
    const stats = { ...state.statistics } as typeof state.statistics;

    // 扩展统计字段（如果不存在则初始化）
    if (!('scheduled' in stats)) (stats as any).scheduled = 0;
    if (!('blocked' in stats)) (stats as any).blocked = 0;
    if (!('waiting' in stats)) (stats as any).waiting = 0;
    if (!('verify' in stats)) (stats as any).verify = 0;
    if (!('accept' in stats)) (stats as any).accept = 0;
    if (!('retry_queue' in stats)) (stats as any).retry_queue = 0;

    // Decrement old status count
    if (oldStatus === 'pending') stats.pending--;
    else if (oldStatus === 'scheduled') (stats as any).scheduled--;
    else if (oldStatus === 'in_progress') stats.inProgress--;
    else if (oldStatus === 'blocked') (stats as any).blocked--;
    else if (oldStatus === 'waiting') (stats as any).waiting--;
    else if (oldStatus === 'verify') (stats as any).verify--;
    else if (oldStatus === 'accept') (stats as any).accept--;
    else if (oldStatus === 'completed') stats.completed--;
    else if (oldStatus === 'failed') stats.failed--;
    else if (oldStatus === 'retry_queue') (stats as any).retry_queue--;

    // Increment new status count
    if (newStatus === 'pending') stats.pending++;
    else if (newStatus === 'scheduled') (stats as any).scheduled++;
    else if (newStatus === 'in_progress') stats.inProgress++;
    else if (newStatus === 'blocked') (stats as any).blocked++;
    else if (newStatus === 'waiting') (stats as any).waiting++;
    else if (newStatus === 'verify') (stats as any).verify++;
    else if (newStatus === 'accept') (stats as any).accept++;
    else if (newStatus === 'completed') stats.completed++;
    else if (newStatus === 'failed') stats.failed++;
    else if (newStatus === 'retry_queue') (stats as any).retry_queue++;

    const newState = { ...state, statistics: stats };
    await this.store.writeJson('state.json', newState);
    this.stateCache = newState;
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
