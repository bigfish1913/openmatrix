// src/orchestrator/scheduler.ts
import type { Task, TaskStatus, AgentType } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';

export interface SchedulerConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
}

export interface TaskAssignment {
  taskId: string;
  agentType: AgentType;
  priority: number;
  dependencies: string[];
}

export class Scheduler {
  private stateManager: StateManager;
  private config: SchedulerConfig;
  private runningTasks: Set<string> = new Set();

  constructor(stateManager: StateManager, config?: Partial<SchedulerConfig>) {
    this.stateManager = stateManager;
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: 120000,
      ...config
    };
  }

  /**
   * 获取下一个可执行的任务
   */
  async getNextTask(): Promise<Task | null> {
    const tasks = await this.stateManager.listTasks();

    // 筛选可执行任务
    const executable = tasks.filter(task => this.canExecute(task, tasks));

    if (executable.length === 0) {
      return null;
    }

    // 按优先级排序
    executable.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    return executable[0];
  }

  /**
   * 检查任务是否可执行
   */
  private canExecute(task: Task, allTasks: Task[]): boolean {
    // 1. 状态必须是 pending 或 retry_queue
    if (task.status !== 'pending' && task.status !== 'retry_queue') {
      return false;
    }

    // 2. 检查并发限制
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return false;
    }

    // 3. 检查依赖是否完成
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        const depTask = allTasks.find(t => t.id === depId);
        if (!depTask || depTask.status !== 'completed') {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 获取优先级权重
   */
  private getPriorityWeight(priority: string): number {
    const weights: Record<string, number> = {
      'P0': 4,
      'P1': 3,
      'P2': 2,
      'P3': 1
    };
    return weights[priority] || 0;
  }

  /**
   * 标记任务开始执行
   */
  async markTaskStarted(taskId: string): Promise<void> {
    this.runningTasks.add(taskId);
    await this.stateManager.updateTask(taskId, {
      status: 'in_progress',
      phases: {
        develop: { status: 'in_progress', duration: null, startedAt: new Date().toISOString() },
        verify: { status: 'pending', duration: null },
        accept: { status: 'pending', duration: null }
      }
    });
  }

  /**
   * 标记任务完成
   */
  async markTaskCompleted(taskId: string): Promise<void> {
    this.runningTasks.delete(taskId);
    const task = await this.stateManager.getTask(taskId);
    if (task) {
      await this.stateManager.updateTask(taskId, {
        status: 'completed',
        phases: {
          ...task.phases,
          accept: { status: 'completed', duration: 0, completedAt: new Date().toISOString() }
        }
      });
    }
  }

  /**
   * 标记任务失败
   */
  async markTaskFailed(taskId: string, error: string): Promise<void> {
    this.runningTasks.delete(taskId);
    await this.stateManager.updateTask(taskId, {
      status: 'failed',
      error,
      retryCount: (await this.stateManager.getTask(taskId))?.retryCount || 0
    });
  }

  /**
   * 标记任务等待确认
   */
  async markTaskWaiting(taskId: string): Promise<void> {
    await this.stateManager.updateTask(taskId, {
      status: 'waiting'
    });
  }

  /**
   * 标记任务阻塞（需要 Meeting）
   */
  async markTaskBlocked(taskId: string, reason: string): Promise<void> {
    this.runningTasks.delete(taskId);
    await this.stateManager.updateTask(taskId, {
      status: 'blocked',
      error: reason
    });
  }

  /**
   * 获取所有可并行执行的任务
   */
  async getParallelTasks(): Promise<Task[]> {
    const tasks = await this.stateManager.listTasks();
    const available: Task[] = [];

    for (const task of tasks) {
      if (this.canExecute(task, tasks) && available.length < this.config.maxConcurrentTasks) {
        available.push(task);
      }
    }

    return available;
  }

  /**
   * 获取调度状态
   */
  getStatus(): {
    running: number;
    maxConcurrent: number;
    runningTaskIds: string[];
  } {
    return {
      running: this.runningTasks.size,
      maxConcurrent: this.config.maxConcurrentTasks,
      runningTaskIds: Array.from(this.runningTasks)
    };
  }
}
