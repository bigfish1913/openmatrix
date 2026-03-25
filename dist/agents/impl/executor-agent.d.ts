import type { Task, AgentType, AgentResult } from '../../types/index.js';
/**
 * Executor Agent - 命令执行
 *
 * 职责：
 * - 执行构建命令
 * - 运行测试
 * - 部署应用
 * - 清理环境
 *
 * 安全约束：
 * - 不执行危险命令
 * - 不暴露敏感信息
 * - 验证命令参数
 * - 记录执行日志
 */
export declare class ExecutorAgent {
    readonly type: AgentType;
    readonly capabilities: string[];
    private readonly FORBIDDEN_PATTERNS;
    execute(task: Task): Promise<AgentResult>;
    /**
     * 验证任务安全性
     */
    private validateTask;
    /**
     * 判断是否需要审批
     */
    private needsApproval;
    private buildExecutorPrompt;
    private generateRunId;
}
