import type { Approval, ApprovalOption } from '../types/index.js';
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
export declare class ApprovalManager {
    private stateManager;
    constructor(stateManager: StateManager);
    /**
     * 创建审批请求
     */
    createApproval(input: CreateApprovalInput): Promise<Approval>;
    /**
     * 获取待处理的审批
     */
    getPendingApprovals(): Promise<Approval[]>;
    /**
     * 获取指定审批
     */
    getApproval(approvalId: string): Promise<Approval | null>;
    /**
     * 处理审批决策
     */
    processDecision(decision: ApprovalDecision): Promise<Approval>;
    /**
     * 创建 Meeting 审批
     */
    createMeetingApproval(taskId: string, blockingReason: string, impactScope: string[]): Promise<Approval>;
    /**
     * 创建 Plan 审批
     */
    createPlanApproval(taskId: string, planContent: string): Promise<Approval>;
    /**
     * 创建 Merge 审批
     */
    createMergeApproval(taskId: string, changes: string): Promise<Approval>;
    /**
     * 创建 Deploy 审批
     */
    createDeployApproval(taskId: string, deployInfo: string): Promise<Approval>;
    /**
     * 检查是否有待处理的审批
     */
    hasPendingApprovals(): Promise<boolean>;
    /**
     * 获取审批历史
     */
    getApprovalHistory(limit?: number): Promise<Approval[]>;
}
