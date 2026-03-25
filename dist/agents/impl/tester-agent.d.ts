import type { Task, AgentType, AgentResult } from '../../types/index.js';
/**
 * Tester Agent - 测试验证
 *
 * 职责：
 * - 编写单元测试
 * - 编写集成测试
 * - 执行测试用例
 * - 生成测试报告
 */
export declare class TesterAgent {
    readonly type: AgentType;
    readonly capabilities: string[];
    execute(task: Task): Promise<AgentResult>;
    private buildTesterPrompt;
    private generateRunId;
}
