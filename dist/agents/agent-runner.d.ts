import type { BaseAgent, AgentResult } from './base-agent.js';
import type { Task } from '../types/index.js';
export interface AgentRunOptions {
    timeout?: number;
    maxRetries?: number;
    model?: string;
}
export declare class AgentRunner {
    private options;
    private activeAgents;
    constructor(options?: AgentRunOptions);
    /**
     * Run an agent in a subprocess
     */
    run(agent: BaseAgent, task: Task): Promise<AgentResult>;
    /**
     * Get status of all active agents
     */
    getActiveAgents(): string[];
    /**
     * Kill a specific agent process
     */
    killAgent(runId: string): void;
    /**
     * Kill all active agents
     */
    killAll(): void;
    private generateRunId;
}
