// src/orchestrator/scheduler.ts
import type { Task, TaskStatus, AgentType } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { StateMachine } from './state-machine.js';
import type { TransitionEvent } from './state-machine.js';

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
  private stateMachine: StateMachine;
  private config: SchedulerConfig;
  private runningTasks: Set<string> = new Set();

  constructor(stateManager: StateManager, config?: Partial<SchedulerConfig>) {
    this.stateManager = stateManager;
    this.stateMachine = new StateMachine();
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

    // 检测并处理循环依赖
    await this.handleCircularDependencies(tasks);

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
   * 通过状态机验证并执行状态转换
   */
  private async transitionTask(taskId: string, event: TransitionEvent, extraUpdates?: Partial<Task>): Promise<void> {
    const task = await this.stateManager.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const result = this.stateMachine.transition(task, event);
    if (!result.success) {
      throw new Error(`状态转换失败 [${task.id}]: ${result.error}`);
    }

    await this.stateManager.updateTask(taskId, {
      status: result.toStatus,
      ...extraUpdates
    });
  }

  /**
   * 标记任务开始执行
   */
  async markTaskStarted(taskId: string): Promise<void> {
    this.runningTasks.add(taskId);
    await this.transitionTask(taskId, 'start', {
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
      await this.transitionTask(taskId, 'accept_done', {
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
    const task = await this.stateManager.getTask(taskId);
    const retryCount = task?.retryCount || 0;
    await this.transitionTask(taskId, 'fail', {
      error,
      retryCount
    });
  }

  /**
   * 标记任务等待确认
   */
  async markTaskWaiting(taskId: string): Promise<void> {
    await this.transitionTask(taskId, 'wait');
  }

  /**
   * 标记任务阻塞（需要 Meeting）
   */
  async markTaskBlocked(taskId: string, reason: string): Promise<void> {
    this.runningTasks.delete(taskId);
    await this.transitionTask(taskId, 'block', {
      error: reason
    });
  }

  /**
   * 获取所有可并行执行的任务（按优先级排序）
   */
  async getParallelTasks(): Promise<Task[]> {
    const tasks = await this.stateManager.listTasks();

    // 检测并处理循环依赖
    await this.handleCircularDependencies(tasks);

    // 筛选可执行任务
    const executable = tasks.filter(task => this.canExecute(task, tasks));

    // 按优先级排序（高优先级优先）
    executable.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    // 限制并发数
    return executable.slice(0, this.config.maxConcurrentTasks);
  }

  /**
   * 检测循环依赖（DFS）
   * 返回所有检测到的循环路径
   */
  detectCircularDependencies(tasks: Task[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string, path: string[]): void => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const task = tasks.find(t => t.id === taskId);
      if (!task || !task.dependencies) {
        recursionStack.delete(taskId);
        return;
      }

      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          dfs(depId, [...path, depId]);
        } else if (recursionStack.has(depId)) {
          // 找到循环
          const cycleStart = path.indexOf(depId);
          const cycle = cycleStart >= 0
            ? [...path.slice(cycleStart), depId]
            : [taskId, depId];
          cycles.push(cycle);
        }
      }

      recursionStack.delete(taskId);
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        dfs(task.id, [task.id]);
      }
    }

    return cycles;
  }

  /**
   * 检测循环依赖并将相关任务标记为 blocked
   */
  private async handleCircularDependencies(tasks: Task[]): Promise<void> {
    const cycles = this.detectCircularDependencies(tasks);

    for (const cycle of cycles) {
      for (const taskId of cycle) {
        const task = tasks.find(t => t.id === taskId);
        if (task && (task.status === 'pending' || task.status === 'retry_queue')) {
          await this.stateManager.updateTask(taskId, {
            status: 'blocked',
            error: `循环依赖检测: ${cycle.join(' → ')}`
          });
        }
      }
    }
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
