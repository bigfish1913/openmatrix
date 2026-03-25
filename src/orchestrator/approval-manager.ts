// src/orchestrator/approval-manager.ts
import type { Approval, ApprovalStatus, ApprovalOption } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';

export type ApprovalType = 'plan' | 'merge' | 'deploy' | 'meeting' | 'custom';

export interface CreateApprovalInput {
  type: ApprovalType;
  taskId: string;
  title: string;
  description: string;
  content: string;
  options?: ApprovalOption[];
}

export interface ApprovalDecision {
  approvalId: string;
  decision: 'approve' | 'modify' | 'reject';
  comment?: string;
  decidedBy: string;
  decidedAt: string;
}

export class ApprovalManager {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * 创建审批请求
   */
  async createApproval(input: CreateApprovalInput): Promise<Approval> {
    const approvalId = `APPR-${Date.now().toString(36).toUpperCase()}`;

    const defaultOptions: ApprovalOption[] = [
      { key: 'approve', label: '✅ 批准' },
      { key: 'modify', label: '✏️ 需要修改' },
      { key: 'reject', label: '❌ 拒绝' }
    ];

    const approval: Approval = {
      id: approvalId,
      type: input.type,
      taskId: input.taskId,
      title: input.title,
      description: input.description,
      content: input.content,
      options: input.options || defaultOptions,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await this.stateManager.saveApproval(approval);
    return approval;
  }

  /**
   * 获取待处理的审批
   */
  async getPendingApprovals(): Promise<Approval[]> {
    return this.stateManager.getApprovalsByStatus('pending');
  }

  /**
   * 获取指定审批
   */
  async getApproval(approvalId: string): Promise<Approval | null> {
    return this.stateManager.getApproval(approvalId);
  }

  /**
   * 处理审批决策
   */
  async processDecision(decision: ApprovalDecision): Promise<Approval> {
    const approval = await this.getApproval(decision.approvalId);
    if (!approval) {
      throw new Error(`审批 ${decision.approvalId} 不存在`);
    }

    if (approval.status !== 'pending') {
      throw new Error(`审批 ${decision.approvalId} 已处理`);
    }

    // 更新审批状态
    const updatedApproval: Approval = {
      ...approval,
      status: decision.decision === 'approve' ? 'approved' : 'rejected',
      decision: decision.decision,
      decidedAt: decision.decidedAt
    };

    await this.stateManager.updateApproval(updatedApproval);

    // 如果是 meeting 类型且被批准，解除任务阻塞
    if (approval.type === 'meeting' && decision.decision === 'approve') {
      await this.stateManager.updateTask(approval.taskId, {
        status: 'in_progress',
        error: null
      });
    }

    return updatedApproval;
  }

  /**
   * 创建 Meeting 审批
   */
  async createMeetingApproval(
    taskId: string,
    blockingReason: string,
    impactScope: string[]
  ): Promise<Approval> {
    return this.createApproval({
      type: 'meeting',
      taskId,
      title: `🔴 阻塞问题需要解决`,
      description: `任务 ${taskId} 遇到阻塞问题`,
      content: `
## 阻塞原因

${blockingReason}

## 影响范围

${impactScope.map(t => `- ${t}`).join('\n')}

## 需要决策

请选择解决方案或提供自定义方案：
      `.trim(),
      options: [
        { key: 'approve', label: '✅ 问题已解决，继续执行' },
        { key: 'modify', label: '🔄 跳过此任务' },
        { key: 'reject', label: '❌ 终止任务链' }
      ]
    });
  }

  /**
   * 创建 Plan 审批
   */
  async createPlanApproval(taskId: string, planContent: string): Promise<Approval> {
    return this.createApproval({
      type: 'plan',
      taskId,
      title: '📋 任务计划审批',
      description: '请审批以下任务计划',
      content: planContent
    });
  }

  /**
   * 创建 Merge 审批
   */
  async createMergeApproval(taskId: string, changes: string): Promise<Approval> {
    return this.createApproval({
      type: 'merge',
      taskId,
      title: '🔀 代码合并审批',
      description: '请审批以下代码变更',
      content: changes
    });
  }

  /**
   * 创建 Deploy 审批
   */
  async createDeployApproval(taskId: string, deployInfo: string): Promise<Approval> {
    return this.createApproval({
      type: 'deploy',
      taskId,
      title: '🚀 部署审批',
      description: '请审批以下部署',
      content: deployInfo,
      options: [
        { key: 'approve', label: '✅ 批准部署' },
        { key: 'reject', label: '❌ 取消部署' }
      ]
    });
  }

  /**
   * 检查是否有待处理的审批
   */
  async hasPendingApprovals(): Promise<boolean> {
    const pending = await this.getPendingApprovals();
    return pending.length > 0;
  }

  /**
   * 获取审批历史
   */
  async getApprovalHistory(limit: number = 10): Promise<Approval[]> {
    const all = await this.stateManager.getAllApprovals();
    return all
      .filter(a => a.status !== 'pending')
      .sort((a, b) => (b.decidedAt || b.createdAt).localeCompare(a.decidedAt || a.createdAt))
      .slice(0, limit);
  }
}
