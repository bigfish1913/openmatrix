import type { Task, AgentType, AgentResult } from '../../types/index.js';
/**
 * Reviewer Agent - 代码审查
 *
 * 职责：
 * - 代码质量审查
 * - 安全性检查
 * - 性能评估
 * - 最佳实践建议
 */
export declare class ReviewerAgent {
    readonly type: AgentType;
    readonly capabilities: string[];
    execute(task: Task): Promise<AgentResult>;
    private buildReviewerPrompt;
    private generateRunId;
}
