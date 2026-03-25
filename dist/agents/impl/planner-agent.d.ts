import type { Task, AgentType, AgentResult } from '../../types/index.js';
/**
 * Planner Agent - 任务规划
 *
 * 职责：
 * - 分析任务需求
 * - 拆解为子任务
 * - 识别依赖关系
 * - 制定执行计划
 * - 评估风险和资源
 */
export declare class PlannerAgent {
    readonly type: AgentType;
    readonly capabilities: string[];
    /**
     * 执行规划任务
     */
    execute(task: Task): Promise<AgentResult>;
    /**
     * 构建规划提示词
     */
    private buildPlanPrompt;
    private generateRunId;
}
