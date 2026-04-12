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

  // 循环依赖检测缓存（避免重复计算）
  private cycleCache: Map<string, string[]> = new Map();
  private lastCycleCheck = 0;
  private cycleCheckTTL = 30000; // 30 秒缓存
  private cycleCacheKey = ''; // 任务列表哈希

  /** 默认任务超时（毫秒） */
  private static readonly DEFAULT_TASK_TIMEOUT = 600000; // 10 分钟

  constructor(stateManager: StateManager, config?: Partial<SchedulerConfig>) {
    this.stateManager = stateManager;
    this.stateMachine = new StateMachine();
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: Scheduler.DEFAULT_TASK_TIMEOUT,
      ...config
    };
  }

  /**
   * 计算任务列表的简单哈希（用于缓存键）
   */
  private computeTasksHash(tasks: Task[]): string {
    // 使用任务 ID + 状态 + 依赖的组合作为哈希
    return tasks
      .map(t => `${t.id}:${t.status}:${(t.dependencies || []).join(',')}`)
      .sort()
      .join('|');
  }

  /**
   * 获取当前正在执行的任务数（从持久化状态读取，非内存缓存）
   */
  private async getRunningCount(): Promise<number> {
    const tasks = await this.stateManager.listTasks();
    return tasks.filter(t => t.status === 'in_progress' || t.status === 'scheduled').length;
  }

  /**
   * 获取下一个可执行的任务
   */
  async getNextTask(): Promise<Task | null> {
    const tasks = await this.stateManager.listTasks();

    // 检测并处理循环依赖
    await this.handleCircularDependencies(tasks);

    // 筛选可执行任务
    const executable: Task[] = [];
    for (const task of tasks) {
      if (await this.canExecute(task, tasks)) {
        executable.push(task);
      }
    }

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
  private async canExecute(task: Task, allTasks: Task[]): Promise<boolean> {
    // 1. 状态必须是 pending 或 retry_queue
    if (task.status !== 'pending' && task.status !== 'retry_queue') {
      return false;
    }

    // 2. 检查并发限制（从持久化状态读取）
    const runningCount = await this.getRunningCount();
    if (runningCount >= this.config.maxConcurrentTasks) {
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
   * 标记任务开始执行（阶段感知，不重置已完成的 phase）
   */
  async markTaskStarted(taskId: string): Promise<void> {
    const task = await this.stateManager.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const now = new Date().toISOString();

    // 根据任务当前状态决定设置哪个 phase 为 in_progress
    let phases = { ...task.phases };

    if (task.status === 'pending' || task.status === 'retry_queue') {
      // 首次开始：设置 develop 为 in_progress
      phases.develop = { status: 'in_progress', duration: null, startedAt: now };
      if (phases.verify.status === 'pending') {
        phases.verify = { status: 'pending', duration: null };
      }
      if (phases.accept.status === 'pending') {
        phases.accept = { status: 'pending', duration: null };
      }
    } else if (task.status === 'verify') {
      // develop 已完成，开始 verify 阶段
      phases.verify = { status: 'in_progress', duration: null, startedAt: now };
    } else if (task.status === 'accept') {
      // develop + verify 已完成，开始 accept 阶段
      phases.accept = { status: 'in_progress', duration: null, startedAt: now };
    }

    await this.transitionTask(taskId, 'start', { phases });
  }

  /**
   * 标记任务完成
   */
  async markTaskCompleted(taskId: string): Promise<void> {
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
    const executable: Task[] = [];
    for (const task of tasks) {
      if (await this.canExecute(task, tasks)) {
        executable.push(task);
      }
    }

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
   * 使用缓存避免重复计算
   */
  private async handleCircularDependencies(tasks: Task[]): Promise<void> {
    const now = Date.now();
    const hash = this.computeTasksHash(tasks);

    // 检查缓存是否有效
    if (hash === this.cycleCacheKey && now - this.lastCycleCheck < this.cycleCheckTTL) {
      // 使用缓存结果，跳过重新检测
      return;
    }

    // 缓存失效或任务列表变化，重新检测
    const cycles = this.detectCircularDependencies(tasks);

    // 更新缓存
    this.cycleCache.clear();
    for (const cycle of cycles) {
      for (const taskId of cycle) {
        this.cycleCache.set(taskId, cycle);
      }
    }
    this.cycleCacheKey = hash;
    this.lastCycleCheck = now;

    // 标记阻塞任务
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
   * 获取任务的循环依赖缓存（用于调试）
   */
  getCycleCache(): Map<string, string[]> {
    return this.cycleCache;
  }

  /**
   * 清除循环依赖缓存
   */
  clearCycleCache(): void {
    this.cycleCache.clear();
    this.lastCycleCheck = 0;
    this.cycleCacheKey = '';
  }

  /**
   * 获取调度状态（从持久化状态读取）
   */
  async getStatus(): Promise<{
    running: number;
    maxConcurrent: number;
  }> {
    const running = await this.getRunningCount();
    return {
      running,
      maxConcurrent: this.config.maxConcurrentTasks
    };
  }
}
