import type { Approval } from '../types/index.js';
import { StateManager } from './state-manager.js';
export declare class ApprovalManager {
    private stateManager;
    private approvals;
    constructor(stateManager: StateManager);
    createApproval(approval: Oartial<Approval>): Promise<Approval>;
    getApproval(id: string): Promise<Approval | null>;
    getPendingApprovals(): Promise<Approval[]>;
    resolveApproval(id: string, decision: 'approved' | 'rejected', comment?: string): Promise<void>;
    hasPendingApprovals(): Promise<boolean>;
    private generateApprovalId;
}
