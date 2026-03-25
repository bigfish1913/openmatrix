import type { Task, AgentResult } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from '../orchestrator/approval-manager.js';
export interface AgentRunnerConfig {
    maxConcurrent: number;
    taskTimeout: number;
}
export interface SubagentPrompt {
    task: Task;
    context: string;
    instructions: string;
}
/**
 * AgentRunner - 使用 Subagent 执行任务
 *
 * 通过 Claude Code 的 Agent 工具启动子 Agent 执行任务
 */
export declare class AgentRunner {
    private stateManager;
    private approvalManager;
    private config;
    private runningAgents;
    constructor(stateManager: StateManager, approvalManager: ApprovalManager, config?: Partial<AgentRunnerConfig>);
    /**
     * 执行任务 - 返回 Subagent 调用提示
     */
    runTask(task: Task): Promise<AgentResult>;
    /**
     * 构建 Agent 提示词
     */
    private buildAgentPrompt;
    /**
     * 构建任务上下文
     */
    private buildContext;
    /**
     * Planner Agent 提示词
     */
    private getPlannerPrompt;
    /**
     * Coder Agent 提示词
     */
    private getCoderPrompt;
    /**
     * Tester Agent 提示词
     */
    private getTesterPrompt;
    /**
     * Reviewer Agent 提示词
     */
    private getReviewerPrompt;
    /**
     * Researcher Agent 提示词
     */
    private getResearcherPrompt;
    /**
     * Executor Agent 提示词
     */
    private getExecutorPrompt;
    /**
     * 生成运行 ID
     */
    private generateRunId;
    /**
     * 获取运行中的 Agent 数量
     */
    getRunningCount(): number;
    /**
     * 检查是否可以启动新 Agent
     */
    canStartNew(): boolean;
}
