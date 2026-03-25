import type { AgentType } from '../types/index.js';
export interface AgentConfig {
    timeout: number;
    maxRetries: number;
    model: string;
}
export interface AgentContext {
    workspaceRoot: string;
    taskDescription: string;
    relevantFiles: string[];
    constraints: string[];
    config: AgentConfig;
}
export interface AgentResult {
    runId: string;
    taskId: string;
    agentType: AgentType;
    status: 'completed' | 'failed' | 'needs_approval';
    output: string;
    artifacts: string[];
    needsApproval: boolean;
    error?: string;
    duration: number;
}
export interface AgentReport {
    agentId: string;
    agentType: AgentType;
    taskId: string;
    status: string;
    summary: string;
    artifacts: string[];
    errors: string[];
    duration: number;
}
export declare abstract class BaseAgent {
    readonly id: string;
    readonly agentType: AgentType;
    abstract type: AgentType;
    abstract capabilities: string[];
    constructor(id: string, agentType: AgentType);
    abstract execute(taskId: string, context: AgentContext): Promise<AgentResult>;
    abstract validate(taskId: string, context: AgentContext): boolean;
    abstract report(): AgentReport;
    abstract buildPrompt(taskId: string, context: AgentContext): string;
    protected callClaude(prompt: string): Promise<string>;
}
