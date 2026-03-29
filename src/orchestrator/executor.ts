// src/orchestrator/executor.ts
import { Scheduler } from './scheduler.js';
import { AgentRunner } from '../agents/agent-runner.js';
import type { SubagentTask } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { StateMachine } from './state-machine.js';
import { PhaseExecutor } from './phase-executor.js';
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
  private phaseExecutor: PhaseExecutor;
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
    this.phaseExecutor = new PhaseExecutor(stateManager, approvalManager);
  }

  /**
   * 获取 PhaseExecutor 实例
   */
  getPhaseExecutor(): PhaseExecutor {
    return this.phaseExecutor;
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
      // 3. 获取所有任务
      const allTasks = await this.stateManager.listTasks();

      // 4. 检查是否有失败任务需要重试
      const failedTasks = allTasks.filter(t => t.status === 'failed');
      if (failedTasks.length > 0) {
        return this.createRetryNeededResult(failedTasks, state);
      }

      // 5. 检查是否有阻塞任务
      const blockedTasks = allTasks.filter(t => t.status === 'blocked');

      // 6. 检查剩余可执行任务（排除 blocked/failed/completed）
      const remainingTasks = allTasks.filter(t =>
        t.status !== 'blocked' &&
        t.status !== 'failed' &&
        t.status !== 'completed'
      );

      // 7. 如果只剩下阻塞任务或没有剩余任务，算完成
      if (remainingTasks.length === 0) {
        return await this.createCompletedResult(state);
      }

      // 8. 如果有阻塞任务
      if (blockedTasks.length > 0) {
        return await this.handleBlockedTasks(blockedTasks, state);
      }

      // 9. 无任务可执行，等待中
      return this.createWaitingResult([], state);
    }

    // 10. 准备 Subagent 任务
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
   *
   * 在 auto 模式下 (approvalPoints 为空数组)，跳过所有审批
   * 仅在失败/异常时才暂停
   */
  private async checkApprovals(state: GlobalState): Promise<Approval[]> {
    // auto 模式: approvalPoints 为空
    if (state.config.approvalPoints.length === 0) {
      // 只自动批准非 meeting 类型
      // meeting 类型保持 pending，供最后统一处理
      const pendingApprovals = await this.stateManager.getApprovalsByStatus('pending');
      for (const approval of pendingApprovals) {
        // meeting 类型不自动批准，保持 pending 状态
        if (approval.type !== 'meeting') {
          await this.approvalManager.processDecision({
            approvalId: approval.id,
            decision: 'approve',
            comment: 'Auto-approved in fully automatic mode',
            decidedBy: 'system',
            decidedAt: new Date().toISOString()
          });
        }
      }
      // 返回非 meeting 类型的 pending 审批（应该已经处理完了）
      return pendingApprovals.filter(a => a.type !== 'meeting');
    }

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
   * 创建完成结果 - 检查是否有待处理的 Meeting
   */
  private async createCompletedResult(state: GlobalState): Promise<ExecutionResult> {
    // 检查是否有待处理的 meeting 审批
    const pendingApprovals = await this.stateManager.getApprovalsByStatus('pending');
    const pendingMeetings = pendingApprovals.filter(a => a.type === 'meeting');

    if (pendingMeetings.length > 0) {
      return {
        status: 'waiting_approval',
        subagentTasks: [],
        message: `✅ 所有非阻塞任务已完成！\n\n📋 有待确认的 Meeting (${pendingMeetings.length}个):\n${pendingMeetings.map(m => `  - ${m.taskId}: ${m.title}`).join('\n')}\n\n请使用 /om:approve 确认或处理这些阻塞问题`,
        statistics: this.getStatistics(state)
      };
    }

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
   * 处理阻塞任务 - 创建 Meeting 审批并跳过该任务
   *
   * 在 auto 模式下:
   * 1. 标记任务为 blocked 状态
   * 2. 创建 Meeting 审批记录
   * 3. 跳过该任务，继续执行其他可执行任务
   * 4. 所有 Meeting 留到最后统一处理
   */
  private async handleBlockedTasks(blockedTasks: Task[], state: GlobalState): Promise<ExecutionResult> {
    const reasons = blockedTasks.map(t => t.error || '未知原因').join('; ');

    for (const task of blockedTasks) {
      // 1. 标记任务为 blocked
      await this.scheduler.markTaskBlocked(task.id, task.error || '未知原因');

      // 2. 检查是否已有该任务的 pending meeting 审批
      const existingApprovals = await this.stateManager.getApprovalsByStatus('pending');
      const hasExistingMeeting = existingApprovals.some(
        a => a.taskId === task.id && a.type === 'meeting'
      );

      if (!hasExistingMeeting) {
        // 3. 创建 Meeting 审批（但不暂停执行）
        const allTasks = await this.stateManager.listTasks();
        const impactedTasks = allTasks
          .filter(t => t.dependencies.includes(task.id))
          .map(t => `${t.id}: ${t.title}`);

        await this.approvalManager.createMeetingApproval(
          task.id,
          task.error || '未知原因',
          impactedTasks.length > 0 ? impactedTasks : ['无下游任务受影响']
        );

        console.log(`🔴 任务阻塞，已创建 Meeting: ${task.id} - ${task.error}`);
      }
    }

    // 4. 返回 continue，继续执行其他任务
    // 阻塞的任务被标记为 blocked，调度器会自动跳过它们
    return {
      status: 'continue',
      subagentTasks: [],
      message: `${blockedTasks.length} 个任务被阻塞，已跳过，继续执行其他任务。Meeting 记录待最后统一处理。原因: ${reasons}`,
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
