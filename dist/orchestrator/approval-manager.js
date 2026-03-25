"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalManager = void 0;
class ApprovalManager {
    stateManager;
    approvals = new Map();
    constructor(stateManager) {
        this.stateManager = stateManager;
    }
    async createApproval(approval) {
        const id = this.generateApprovalId();
        const now = new Date().toISOString();
        const newApproval = {
            ...approval,
            id,
            status: 'pending',
            createdAt: now,
            updatedAt: now
        };
        this.approvals.set(id, newApproval);
        await this.stateManager.store.writeJson(`approvals/pending/${id}.json`, newApproval);
        return newApproval;
    }
    async getApproval(id) {
        return this.approvals.get(id) || null;
    }
    async getPendingApprovals() {
        const files = await this.stateManager.store.listFiles('approvals/pending');
        const approvals = [];
        for (const file of files) {
            const approval = await this.stateManager.store.readJson(`approvals/pending/${file}`);
            if (approval) {
                approvals.push(approval);
            }
        }
        return approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    async resolveApproval(id, decision, comment) {
        const approval = await this.getApproval(id);
        if (!approval) {
            throw new Error(`Approval ${id} not found`);
        }
        const now = new Date().toISOString();
        const resolved = {
            ...approval,
            status: decision,
            decision: comment || decision,
            decidedAt: now,
            updatedAt: now
        };
        // Move to history
        this.approvals.delete(id);
        await this.stateManager.store.writeJson(`approvals/history/${id}.json`, resolved);
        // Remove from pending
        await this.stateManager.store.deleteFile?.(`approvals/pending/${id}.json`);
    }
    async hasPendingApprovals() {
        const pending = await this.getPendingApprovals();
        return pending.length > 0;
    }
    generateApprovalId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).slice(2, 4).toUpperCase();
        return `APPR-${timestamp}${random}`;
    }
}
exports.ApprovalManager = ApprovalManager;
