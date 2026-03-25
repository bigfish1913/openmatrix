import { BaseAgent } from '../base-agent.js';
import type { AgentResult, AgentContext } from '../base-agent.js';
export declare class CoderAgent extends BaseAgent {
    type: string;
    capabilities: string[];
    description: string;
    constructor(id: string);
    execute(taskId: string, context: AgentContext): Promise<AgentResult>;
    validate(taskId: string, context: AgentContext): boolean;
    report(): {
        agentId: string;
        agentType: string;
        taskId: string;
        status: string;
        summary: string;
        artifacts: string[];
        errors: string[];
        duration: number;
    };
    buildPrompt(taskId: string, context: AgentContext): string;
    private generateRunId;
    private readRelevantFiles;
    private applyChanges;
}
