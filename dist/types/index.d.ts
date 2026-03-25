export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'blocked' | 'waiting' | 'verify' | 'accept' | 'completed' | 'failed' | 'retry_queue';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
export interface TaskPhase {
    status: TaskStatus;
    duration: number | null;
    startedAt?: string;
    completedAt?: string;
}
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    timeout: number;
    dependencies: string[];
    assignedAgent: AgentType;
    phases: {
        develop: TaskPhase;
        verify: TaskPhase;
        accept: TaskPhase;
    };
    retryCount: number;
    error: string | null;
    createdAt: string;
    updatedAt: string;
}
export type AgentType = 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';
export interface AgentResult {
    runId: string;
    taskId: string;
    agentType: AgentType;
    status: AgentStatus;
    output: string;
    artifacts: string[];
    needsApproval: boolean;
    error?: string;
    duration: number;
    completedAt: string;
}
export type RunStatus = 'initialized' | 'running' | 'paused' | 'completed' | 'failed';
export interface GlobalState {
    version: string;
    runId: string;
    status: RunStatus;
    currentPhase: 'planning' | 'execution' | 'verification' | 'acceptance';
    startedAt: string;
    config: AppConfig;
    statistics: {
        totalTasks: number;
        completed: number;
        inProgress: number;
        failed: number;
        pending: number;
    };
}
export interface AppConfig {
    timeout: number;
    maxRetries: number;
    approvalPoints: ('plan' | 'merge' | 'deploy')[];
    maxConcurrentAgents: number;
    model: string;
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export interface Approval {
    id: string;
    type: 'plan' | 'merge' | 'deploy' | 'meeting' | 'custom';
    taskId: string;
    title: string;
    description: string;
    content: string;
    options: ApprovalOption[];
    status: ApprovalStatus;
    decision?: 'approve' | 'modify' | 'reject';
    createdAt: string;
    decidedAt?: string;
}
export interface ApprovalOption {
    key: string;
    label: string;
}
export interface ParsedTask {
    title: string;
    description: string;
    goals: string[];
    constraints: string[];
    deliverables: string[];
    rawContent: string;
}
