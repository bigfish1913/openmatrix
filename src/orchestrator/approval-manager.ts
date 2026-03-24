// src/orchestrator/approval-manager.ts
import type { Approval } from '../types/index.js';
import { StateManager } from './state-manager.js';

export class ApprovalManager {
  private approvals: Map<string, Approval> = new Map();

  constructor(private stateManager: StateManager) {}

  async createApproval(approval: Oartial<Approval>): Promise<Approval> {
    const id = this.generateApprovalId();
    const now = new Date().toISOString();

    const newApproval: Approval = {
      ...approval,
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    this.approvals.set(id, newApproval);
    await this.stateManager.store.writeJson(
      `approvals/pending/${id}.json`,
      newApproval
    );

    return newApproval;
  }

  async getApproval(id: string): Promise<Approval | null> {
    return this.approvals.get(id) || null;
  }

  async getPendingApprovals(): Promise<Approval[]> {
    const files = await this.stateManager.store.listFiles('approvals/pending');
    const approvals: Approval[] = [];

    for (const file of files) {
      const approval = await this.stateManager.store.readJson<Approval>(
        `approvals/pending/${file}`
      );
      if (approval) {
        approvals.push(approval);
      }
    }

    return approvals.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }

  async resolveApproval(id: string, decision: 'approved' | 'rejected', comment?: string): Promise<void> {
    const approval = await this.getApproval(id);
    if (!approval) {
      throw new Error(`Approval ${id} not found`);
    }

    const now = new Date().toISOString();
    const resolved: Approval = {
      ...approval,
      status: decision,
      decision: comment || decision,
      decidedAt: now,
      updatedAt: now
    };

    // Move to history
    this.approvals.delete(id);
    await this.stateManager.store.writeJson(
      `approvals/history/${id}.json`,
      resolved
    );

    // Remove from pending
    await this.stateManager.store.deleteFile?.(`approvals/pending/${id}.json`);
  }

  async hasPendingApprovals(): Promise<boolean> {
    const pending = await this.getPendingApprovals();
    return pending.length > 0;
  }

  private generateApprovalId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `APPR-${timestamp}${random}`;
  }
}
