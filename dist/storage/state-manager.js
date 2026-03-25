"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
const file_store_js_1 = require("./file-store.js");
const DEFAULT_CONFIG = {
    timeout: 120,
    maxRetries: 3,
    approvalPoints: ['plan', 'merge'],
    maxConcurrentAgents: 3,
    model: 'claude-sonnet-4-6'
};
class StateManager {
    store;
    stateCache = null;
    constructor(basePath) {
        this.store = new file_store_js_1.FileStore(basePath);
    }
    async initialize() {
        const existing = await this.store.readJson('state.json');
        if (!existing) {
            const initialState = {
                version: '1.0',
                runId: this.generateRunId(),
                status: 'initialized',
                currentPhase: 'planning',
                startedAt: new Date().toISOString(),
                config: DEFAULT_CONFIG,
                statistics: {
                    totalTasks: 0,
                    completed: 0,
                    inProgress: 0,
                    failed: 0,
                    pending: 0
                }
            };
            await this.store.writeJson('state.json', initialState);
            this.stateCache = initialState;
        }
        else {
            this.stateCache = existing;
        }
    }
    async getState() {
        if (!this.stateCache) {
            this.stateCache = await this.store.readJson('state.json');
        }
        return this.stateCache;
    }
    async updateState(updates) {
        const state = await this.getState();
        const newState = { ...state, ...updates };
        await this.store.writeJson('state.json', newState);
        this.stateCache = newState;
    }
    async createTask(input) {
        const taskId = this.generateTaskId();
        const now = new Date().toISOString();
        const task = {
            id: taskId,
            title: input.title,
            description: input.description,
            status: 'pending',
            priority: input.priority,
            timeout: input.timeout,
            dependencies: input.dependencies,
            assignedAgent: input.assignedAgent,
            phases: {
                develop: { status: 'pending', duration: null },
                verify: { status: 'pending', duration: null },
                accept: { status: 'pending', duration: null }
            },
            retryCount: 0,
            error: null,
            createdAt: now,
            updatedAt: now
        };
        await this.store.writeJson(`tasks/${taskId}/task.json`, task);
        // Update statistics
        const state = await this.getState();
        await this.updateState({
            statistics: {
                ...state.statistics,
                totalTasks: state.statistics.totalTasks + 1,
                pending: state.statistics.pending + 1
            }
        });
        return task;
    }
    async getTask(taskId) {
        return await this.store.readJson(`tasks/${taskId}/task.json`);
    }
    async updateTask(taskId, updates) {
        const task = await this.getTask(taskId);
        if (!task)
            throw new Error(`Task ${taskId} not found`);
        const oldStatus = task.status;
        const updatedTask = {
            ...task,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await this.store.writeJson(`tasks/${taskId}/task.json`, updatedTask);
        // Update statistics if status changed
        if (updates.status && updates.status !== oldStatus) {
            await this.updateTaskStatistics(oldStatus, updates.status);
        }
    }
    async listTasks() {
        const dirs = await this.store.listDirs('tasks');
        const tasks = [];
        for (const dir of dirs) {
            const task = await this.getTask(dir);
            if (task)
                tasks.push(task);
        }
        return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    async updateTaskStatistics(oldStatus, newStatus) {
        const state = await this.getState();
        const stats = { ...state.statistics };
        // Decrement old status count
        if (oldStatus === 'pending')
            stats.pending--;
        else if (oldStatus === 'in_progress')
            stats.inProgress--;
        else if (oldStatus === 'completed')
            stats.completed--;
        else if (oldStatus === 'failed')
            stats.failed--;
        // Increment new status count
        if (newStatus === 'pending')
            stats.pending++;
        else if (newStatus === 'in_progress')
            stats.inProgress++;
        else if (newStatus === 'completed')
            stats.completed++;
        else if (newStatus === 'failed')
            stats.failed++;
        await this.updateState({ statistics: stats });
    }
    generateRunId() {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.random().toString(36).slice(2, 6);
        return `run-${date}-${rand}`;
    }
    generateTaskId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
        return `TASK-${timestamp}${rand}`;
    }
    // ============ Approval Methods ============
    async saveApproval(approval) {
        await this.store.writeJson(`approvals/${approval.id}.json`, approval);
    }
    async getApproval(approvalId) {
        return await this.store.readJson(`approvals/${approvalId}.json`);
    }
    async updateApproval(approval) {
        await this.store.writeJson(`approvals/${approval.id}.json`, approval);
    }
    async getApprovalsByStatus(status) {
        const files = await this.store.listFiles('approvals');
        const approvals = [];
        for (const file of files) {
            const approval = await this.store.readJson(`approvals/${file}`);
            if (approval && approval.status === status) {
                approvals.push(approval);
            }
        }
        return approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    async getAllApprovals() {
        const files = await this.store.listFiles('approvals');
        const approvals = [];
        for (const file of files) {
            const approval = await this.store.readJson(`approvals/${file}`);
            if (approval) {
                approvals.push(approval);
            }
        }
        return approvals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    // ============ Meeting Methods ============
    async saveMeeting(meeting) {
        await this.store.writeJson(`meetings/${meeting.id}.json`, meeting);
    }
    async getMeeting(meetingId) {
        return await this.store.readJson(`meetings/${meetingId}.json`);
    }
    async getMeetingsByStatus(status) {
        const files = await this.store.listFiles('meetings');
        const meetings = [];
        for (const file of files) {
            const meeting = await this.store.readJson(`meetings/${file}`);
            if (meeting && meeting.status === status) {
                meetings.push(meeting);
            }
        }
        return meetings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
}
exports.StateManager = StateManager;
