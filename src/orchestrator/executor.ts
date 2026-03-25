// src/orchestrator/executor.ts
import { Scheduler } from './scheduler.js';
import { AgentRunner, type SubagentTask } from '../agents/agent-runner.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { StateMachine } from './state-machine.js';
import type { Task, GlobalState, Approval } from '../types/index.js';

export interface ExecutorConfig {
  maxConcurrent: number;
  taskTimeout: number;
}

export interface ExecutorStatus {
  running: boolean;
  currentPhase: string;
  pendingTasks: number;
  runningTasks: number;
  waitingApprovals: number;
}

export interface ExecutionResult {
  status: 'continue' | 'waiting_approval' | 'completed' | 'failed';
  subagentTasks: SubagentTask[];
  message: string;
  statistics: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
  };
}

/**
 * OrchestratorExecutor - 执行循环核心
 *
 * 负责持续调度任务并返回 Subagent 任务列表供 Skills 执行
 */
export class OrchestratorExecutor {
  private scheduler: Scheduler;
  private agentRunner: AgentRunner;
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private stateMachine: StateMachine;
  private config: ExecutorConfig;

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager,
    config?: Partial<ExecutorConfig>
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.config = {
      maxConcurrent: 3,
      taskTimeout: 120000,
      ...config
    };

    this.scheduler = new Scheduler(stateManager, {
      maxConcurrentTasks: this.config.maxConcurrent,
      taskTimeout: this.config.taskTimeout
    });

    this.agentRunner = new AgentRunner(stateManager, approvalManager, {
      maxConcurrent: this.config.maxConcurrent,
      taskTimeout: this.config.taskTimeout
    });

    this.stateMachine = new StateMachine();
  }

  /**
   * 执行一步 - 返回待执行的 Subagent 任务
   *
   * Skills 调用此方法获取任务，然后使用 Agent 工具执行
   */
  async step(): Promise<ExecutionResult> {
    const state = await this.stateManager.getState();

    // 1. 检查是否需要审批
    const pendingApprovals = await this.checkApprovals(state);
    if (pendingApprovals.length > 0) {
      return this.createWaitingResult(pendingApprovals, state);
    }

    // 2. 获取可执行任务
    const executableTasks = await this.scheduler.getParallelTasks();

    if (executableTasks.length === 0) {
      // 3. 检查是否全部完成
      const allTasks = await this.stateManager.listTasks();
      const allCompleted = this.checkAllCompleted(allTasks);

      if (allCompleted) {
        return this.createCompletedResult(state);
      }

      // 4. 检查是否有失败任务需要重试
      const failedTasks = allTasks.filter(t => t.status === 'failed');
      if (failedTasks.length > 0) {
        return this.createRetryNeededResult(failedTasks, state);
      }

      // 5. 检查是否有阻塞任务
      const blockedTasks = allTasks.filter(t => t.status === 'blocked');
      if (blockedTasks.length > 0) {
        return this.createBlockedResult(blockedTasks, state);
      }

      // 6. 无任务可执行，等待中
      return this.createWaitingResult([], state);
    }

    // 7. 准备 Subagent 任务
    const subagentTasks = await this.agentRunner.prepareSubagentTasks(executableTasks);

    // 8. 更新任务状态为 scheduled
    for (const task of executableTasks) {
      await this.scheduler.markTaskStarted(task.id);
    }

    return {
      status: 'continue',
      subagentTasks,
      message: `准备执行 ${subagentTasks.length} 个任务`,
      statistics: this.getStatistics(state)
    };
  }

  /**
   * 检查审批点
   */
  private async checkApprovals(state: GlobalState): Promise<Approval[]> {
    const pendingApprovals = await this.stateManager.getApprovalsByStatus('pending');

    // 过滤出当前需要处理的审批
    return pendingApprovals.filter(approval => {
      const approvalPoint = approval.type;
      return state.config.approvalPoints.includes(approvalPoint as any);
    });
  }

  /**
   * 检查是否所有任务完成
   */
  private checkAllCompleted(tasks: Task[]): boolean {
    if (tasks.length === 0) return true;

    return tasks.every(task => task.status === 'completed');
  }

  /**
   * 获取统计信息
   */
  private getStatistics(state: GlobalState) {
    return {
      total: state.statistics.totalTasks,
      completed: state.statistics.completed,
      inProgress: state.statistics.inProgress,
      pending: state.statistics.pending,
      failed: state.statistics.failed
    };
  }

  /**
   * 创建等待审批结果
   */
  private createWaitingResult(approvals: Approval[], state: GlobalState): ExecutionResult {
    return {
      status: 'waiting_approval',
      subagentTasks: [],
      message: approvals.length > 0
        ? `等待 ${approvals.length} 个审批`
        : '等待中...',
      statistics: this.getStatistics(state)
    };
  }

  /**
   * 创建完成结果
   */
  private createCompletedResult(state: GlobalState): ExecutionResult {
    return {
      status: 'completed',
      subagentTasks: [],
      message: '所有任务已完成！',
      statistics: this.getStatistics(state)
    };
  }

  /**
   * 创建需要重试结果
   */
  private createRetryNeededResult(failedTasks: Task[], state: GlobalState): ExecutionResult {
    return {
      status: 'failed',
      subagentTasks: [],
      message: `${failedTasks.length} 个任务失败，需要重试`,
      statistics: this.getStatistics(state)
    };
  }

  /**
   * 创建阻塞结果
   */
  private createBlockedResult(blockedTasks: Task[], state: GlobalState): ExecutionResult {
    const reasons = blockedTasks.map(t => t.error || '未知原因').join('; ');
    return {
      status: 'failed',
      subagentTasks: [],
      message: `${blockedTasks.length} 个任务被阻塞: ${reasons}`,
      statistics: this.getStatistics(state)
    };
  }

  /**
   * 标记任务完成
   */
  async completeTask(taskId: string, result: { success: boolean; output?: string; error?: string }): Promise<void> {
    const task = await this.stateManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (result.success) {
      // 更新阶段状态
      const currentPhase = this.getCurrentPhase(task);
      const updatedPhases = { ...task.phases };

      if (currentPhase === 'develop') {
        updatedPhases.develop = {
          status: 'completed',
          duration: 0,
          completedAt: new Date().toISOString()
        };
        updatedPhases.verify = {
          status: 'in_progress',
          duration: null,
          startedAt: new Date().toISOString()
        };
        await this.stateManager.updateTask(taskId, {
          phases: updatedPhases,
          status: 'verify'
        });
      } else if (currentPhase === 'verify') {
        updatedPhases.verify = {
          status: 'completed',
          duration: 0,
          completedAt: new Date().toISOString()
        };
        updatedPhases.accept = {
          status: 'in_progress',
          duration: null,
          startedAt: new Date().toISOString()
        };
        await this.stateManager.updateTask(taskId, {
          phases: updatedPhases,
          status: 'accept'
        });
      } else if (currentPhase === 'accept') {
        await this.scheduler.markTaskCompleted(taskId);
      }
    } else {
      await this.scheduler.markTaskFailed(taskId, result.error || 'Unknown error');
    }
  }

  /**
   * 获取当前阶段
   */
  private getCurrentPhase(task: Task): 'develop' | 'verify' | 'accept' {
    if (task.phases.develop.status !== 'completed') return 'develop';
    if (task.phases.verify.status !== 'completed') return 'verify';
    return 'accept';
  }

  /**
   * 获取执行器状态
   */
  async getStatus(): Promise<ExecutorStatus> {
    const state = await this.stateManager.getState();
    const pendingApprovals = await this.stateManager.getApprovalsByStatus('pending');
    const tasks = await this.stateManager.listTasks();

    return {
      running: state.status === 'running',
      currentPhase: state.currentPhase,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      runningTasks: tasks.filter(t => t.status === 'in_progress').length,
      waitingApprovals: pendingApprovals.length
    };
  }

  /**
   * 获取 AgentRunner 实例
   */
  getAgentRunner(): AgentRunner {
    return this.agentRunner;
  }

  /**
   * 获取 Scheduler 实例
   */
  getScheduler(): Scheduler {
    return this.scheduler;
  }
}
