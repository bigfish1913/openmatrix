import type { ParsedTask } from '../types/index.js';
export interface TaskBreakdown {
    taskId: string;
    title: string;
    description: string;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    dependencies: string[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    assignedAgent: 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor';
}
export declare class TaskPlanner {
    /**
     * Break down a parsed task into sub-tasks
     */
    breakdown(parsedTask: ParsedTask, answers: Record<string, string>): TaskBreakdown[];
    private generateTaskId;
    private determinePriority;
    private estimateComplexity;
    private determineAgent;
}
