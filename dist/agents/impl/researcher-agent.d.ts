import type { Task, AgentType, AgentResult } from '../../types/index.js';
/**
 * Researcher Agent - 调研分析
 *
 * 职责：
 * - 搜索相关资料
 * - 分析技术方案
 * - 总结最佳实践
 * - 提供决策建议
 */
export declare class ResearcherAgent {
    readonly type: AgentType;
    readonly capabilities: string[];
    execute(task: Task): Promise<AgentResult>;
    private buildResearchPrompt;
    private generateRunId;
}
