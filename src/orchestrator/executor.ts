// src/orchestrator/executor.ts
import { Scheduler } from './scheduler.js';
import { AgentRunner } from '../agents/agent-runner.js';
import type { SubagentTask } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { StateMachine } from './state-machine.js';
import { PhaseExecutor } from './phase-executor.js';
import { RetryManager } from './retry-manager.js';
import { AIReviewer } from './ai-reviewer.js';
import { MeetingManager } from './meeting-manager.js';
import type { Task, GlobalState, Approval, AmbiguityReport, AmbiguityItem } from '../types/index.js';
import { logger } from '../utils/logger.js';

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
  status: 'continue' | 'waiting_approval' | 'completed' | 'failed' | 'ambiguity_ask_user';
  subagentTasks: SubagentTask[];
  message: string;
  statistics: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
  };
  /** 歧义报告 (仅 status 为 'ambiguity_ask_user' 时存在) */
  ambiguityReport?: AmbiguityReport;
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
  private retryManager: RetryManager;
  private aiReviewer: AIReviewer;
  private meetingManager: MeetingManager;
  private config: ExecutorConfig;
  private taskTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager,
    config?: Partial<ExecutorConfig>
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.meetingManager = new MeetingManager(stateManager, approvalManager);

    // 从 state.config 读取 taskTimeout，如果未定义则使用默认值
    const stateConfig = stateManager.getState().then(s => s.config).catch(() => null);
    const defaultTaskTimeout = 600000; // 10 分钟（毫秒）

    this.config = {
      maxConcurrent: 3,
      taskTimeout: defaultTaskTimeout,
      ...config
    };

    // 异步获取配置并更新 taskTimeout
    stateConfig.then(cfg => {
      if (cfg?.taskTimeout) {
        this.config.taskTimeout = cfg.taskTimeout;
      }
    });

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
    this.retryManager = new RetryManager();
    this.aiReviewer = new AIReviewer();
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
        // 尝试自动重试
        const retried = await this.processRetries(failedTasks);
        if (retried > 0) {
          // 有任务被重新放入队列，继续执行循环
          return {
            status: 'continue',
            subagentTasks: [],
            message: `${retried} 个失败任务已加入重试队列`,
            statistics: this.getStatistics(state)
          };
        }
        // 所有重试次数已耗尽
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

    // 11. 更新任务状态为 in_progress 并设置超时
    for (const task of executableTasks) {
      await this.scheduler.markTaskStarted(task.id);
      this.setupTaskTimeout(task.id);
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
   *
   * 增强：
   * 1. 对于 reviewer 任务，自动解析 Review 报告并生成修复任务
   * 2. 解析歧义报告并根据执行模式处理
   */
  async completeTask(taskId: string, result: { success: boolean; output?: string; error?: string }): Promise<{ createdFixTasks?: string[]; ambiguityResult?: { status: 'ambiguity_ask_user' | 'ambiguity_handled'; report: AmbiguityReport } }> {
    const task = await this.stateManager.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 检查输出中是否包含歧义报告（仅匹配 XML 标签作为唯一触发标记）
    if (result.output?.includes('<ambiguity_report>')) {
      const ambiguityReport = this.parseAmbiguityReport(taskId, result.output);
      if (ambiguityReport?.hasAmbiguity) {
        const ambiguityResult = await this.handleAmbiguity(task, ambiguityReport);
        if (ambiguityResult) {
          return { ambiguityResult };
        }
      }
    }

    if (result.success) {
      // 清除超时计时器
      this.clearTaskTimeout(taskId);

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

        // Review 任务完成：自动解析报告并生成修复任务
        if (task.assignedAgent === 'reviewer' && result.output) {
          return await this.processReviewResult(taskId, result.output);
        }
      }
    } else {
      this.clearTaskTimeout(taskId);
      await this.scheduler.markTaskFailed(taskId, result.error || 'Unknown error');
    }

    return {};
  }

  /**
   * 处理 Review 结果：解析报告，如有 critical/major 问题则自动创建修复任务
   */
  private async processReviewResult(taskId: string, output: string): Promise<{ createdFixTasks?: string[] }> {
    const report = this.aiReviewer.parseReviewResult(taskId, output);
    const task = await this.stateManager.getTask(taskId);
    if (!task) return {};

    // 保存 Review 报告到 artifacts
    await this.stateManager.savePhaseResult(taskId, 'review', {
      report,
      taskId,
      reviewedAt: report.reviewedAt
    });

    if (!this.aiReviewer.needsAutoFix(report)) {
      console.log(`✅ Review 通过: ${taskId} — 无 critical/major 问题`);
      return {};
    }

    // 生成修复任务
    const fixTasks = this.aiReviewer.generateFixTasks(task, report, taskId);
    const createdIds: string[] = [];

    for (const fixTask of fixTasks) {
      // 将生成的 taskId 转换为 StateManager 的 ID 格式
      const created = await this.stateManager.createTask({
        title: fixTask.title,
        description: fixTask.description,
        priority: fixTask.priority,
        timeout: fixTask.timeout,
        dependencies: fixTask.dependencies,
        assignedAgent: fixTask.assignedAgent
      });
      createdIds.push(created.id);
    }

    console.log(`🔧 Review 发现 ${report.issues.length} 个问题，已创建 ${createdIds.length} 个修复任务`);
    return { createdFixTasks: createdIds };
  }

  /**
   * 获取当前阶段
   */
  private getCurrentPhase(task: Task): 'develop' | 'verify' | 'accept' {
    if (task.phases.develop.status !== 'completed') return 'develop';
    if (task.phases.verify.status !== 'completed') return 'verify';
    return 'accept';
  }

  // ============ Ambiguity Management ============

  /**
   * 解析歧义报告
   *
   * 从 Agent 输出中提取歧义报告 JSON
   * 支持多种标记格式：
   * - <ambiguity_report>...</ambiguity_report>
   * - AMBIGUITY_REPORT: {...}
   * - 直接 JSON 块
   */
  private parseAmbiguityReport(taskId: string, output: string): AmbiguityReport | null {
    try {
      // 尝试提取 XML 标记格式
      const xmlMatch = output.match(/<ambiguity_report>([\s\S]*?)<\/ambiguity_report>/);
      if (xmlMatch) {
        const jsonStr = xmlMatch[1].trim();
        const report = JSON.parse(jsonStr) as AmbiguityReport;
        return { ...report, taskId };
      }

      // 尝试提取 AMBIGUITY_REPORT: 格式
      const prefixMatch = output.match(/AMBIGUITY_REPORT:\s*([\s\S]*?)(?:\n\n|\n---|$)/);
      if (prefixMatch) {
        const jsonStr = prefixMatch[1].trim();
        const report = JSON.parse(jsonStr) as AmbiguityReport;
        return { ...report, taskId };
      }

      // 尝试查找包含 hasAmbiguity 的 JSON 块（非贪婪，作为最后兜底）
      const jsonBlockMatch = output.match(/\{[^{}]*?"hasAmbiguity"[^{}]*?\}/);
      if (jsonBlockMatch) {
        const report = JSON.parse(jsonBlockMatch[0]) as AmbiguityReport;
        return { ...report, taskId };
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ 解析歧义报告失败: ${taskId}`, error);
      return null;
    }
  }

  /**
   * 处理歧义
   *
   * 根据执行模式和严重程度选择处理策略：
   * - auto 模式：所有歧义写入 Meeting，继续执行
   * - 其他模式：
   *   - Critical/High：返回 ambiguity_ask_user 状态，让 Skill 层用 AskUserQuestion 处理
   *   - Medium/Low：写入 Meeting，继续执行
   */
  private async handleAmbiguity(
    task: Task,
    report: AmbiguityReport
  ): Promise<{ status: 'ambiguity_ask_user' | 'ambiguity_handled'; report: AmbiguityReport } | null> {
    const state = await this.stateManager.getState();
    const mode = state.config.approvalPoints.length === 0 ? 'auto' : 'interactive';

    console.log(`🔍 检测到歧义: ${task.id} - 最高严重程度: ${report.maxSeverity || 'unknown'}`);

    // auto 模式：所有歧义写入 Meeting，继续执行
    if (mode === 'auto') {
      await this.meetingManager.createAmbiguityMeeting(task.id, report);
      console.log(`📝 [auto模式] 歧义已写入 Meeting，继续执行`);
      return { status: 'ambiguity_handled', report };
    }

    // 其他模式：根据严重程度处理
    const severity = report.maxSeverity;
    if (severity === 'critical' || severity === 'high') {
      // Critical/High: 返回特殊状态让 Skill 层用 AskUserQuestion 处理
      console.log(`⚠️ [interactive模式] Critical/High 歧义，需用户确认`);
      return { status: 'ambiguity_ask_user', report };
    } else {
      // Medium/Low: 写入 Meeting，继续执行
      await this.meetingManager.createAmbiguityMeeting(task.id, report);
      console.log(`📝 [interactive模式] Medium/Low 歧义已写入 Meeting，继续执行`);
      return { status: 'ambiguity_handled', report };
    }
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

  // ============ Timeout Management ============

  /**
   * 设置任务超时计时器
   */
  private setupTaskTimeout(taskId: string): void {
    const timer = setTimeout(async () => {
      const timeoutSeconds = this.config.taskTimeout / 1000;
      console.error(`⏰ 任务超时: ${taskId} (${timeoutSeconds}s)`);
      logger.task.timeout(taskId, timeoutSeconds);
      this.taskTimers.delete(taskId);
      await this.scheduler.markTaskFailed(taskId, `Task timed out after ${timeoutSeconds}s`);
    }, this.config.taskTimeout);
    this.taskTimers.set(taskId, timer);
  }

  /**
   * 清除任务超时计时器
   */
  private clearTaskTimeout(taskId: string): void {
    const timer = this.taskTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.taskTimers.delete(taskId);
    }
  }

  // ============ Retry Management ============

  /**
   * 处理失败任务的重试
   * @returns 成功加入重试队列的任务数量
   */
  private async processRetries(failedTasks: Task[]): Promise<number> {
    let retried = 0;
    let limit: number;
    try {
      const state = await this.stateManager.getState();
      limit = state.config.maxRetries;
    } catch {
      limit = 3;
    }

    for (const task of failedTasks) {
      const currentRetryCount = task.retryCount || 0;

      // 先检查是否还有重试次数，再决定是否加入队列
      if (currentRetryCount >= limit) {
        console.log(`⚠️ 任务 ${task.id} 已达到最大重试次数 (${limit})，跳过重试`);
        continue;
      }

      this.retryManager.addToQueue(task.id, task.error || 'Unknown error');

      if (this.retryManager.shouldRetry(task.id)) {
        // 将任务从 failed 转为 retry_queue 再转为 pending
        await this.stateManager.updateTask(task.id, {
          status: 'retry_queue',
          retryCount: currentRetryCount + 1
        });
        await this.stateManager.updateTask(task.id, {
          status: 'pending'
        });
        this.retryManager.removeFromQueue(task.id);
        retried++;
      }
    }

    return retried;
  }

  /**
   * 销毁执行器，清理所有资源
   */
  destroy(): void {
    for (const timer of this.taskTimers.values()) {
      clearTimeout(timer);
    }
    this.taskTimers.clear();
  }
}
