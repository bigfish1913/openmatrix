import type { GlobalState, Task, Approval, ApprovalStatus } from '../types/index.js';
export declare class StateManager {
    private store;
    private stateCache;
    constructor(basePath: string);
    initialize(): Promise<void>;
    getState(): Promise<GlobalState>;
    updateState(updates: Partial<GlobalState>): Promise<void>;
    createTask(input: {
        title: string;
        description: string;
        priority: 'P0' | 'P1' | 'P2' | 'P3';
        timeout: number;
        dependencies: string[];
        assignedAgent: string;
    }): Promise<Task>;
    getTask(taskId: string): Promise<Task | null>;
    updateTask(taskId: string, updates: Partial<Task>): Promise<void>;
    listTasks(): Promise<Task[]>;
    private updateTaskStatistics;
    private generateRunId;
    private generateTaskId;
    saveApproval(approval: Approval): Promise<void>;
    getApproval(approvalId: string): Promise<Approval | null>;
    updateApproval(approval: Approval): Promise<void>;
    getApprovalsByStatus(status: ApprovalStatus): Promise<Approval[]>;
    getAllApprovals(): Promise<Approval[]>;
    saveMeeting(meeting: any): Promise<void>;
    getMeeting(meetingId: string): Promise<any | null>;
    getMeetingsByStatus(status: string): Promise<any[]>;
}
