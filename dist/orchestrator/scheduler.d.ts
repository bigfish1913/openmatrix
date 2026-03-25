import type { Task, AgentType } from '../types/index.js';
import { StateManager } from '../storage/state-manager.js';
export interface SchedulerConfig {
    maxConcurrentTasks: number;
    taskTimeout: number;
}
export interface TaskAssignment {
    taskId: string;
    agentType: AgentType;
    priority: number;
    dependencies: string[];
}
export declare class Scheduler {
    private stateManager;
    private config;
    private runningTasks;
    constructor(stateManager: StateManager, config?: Partial<SchedulerConfig>);
    /**
     * 获取下一个可执行的任务
     */
    getNextTask(): Promise<Task | null>;
    /**
     * 检查任务是否可执行
     */
    private canExecute;
    /**
     * 获取优先级权重
     */
    private getPriorityWeight;
    /**
     * 标记任务开始执行
     */
    markTaskStarted(taskId: string): Promise<void>;
    /**
     * 标记任务完成
     */
    markTaskCompleted(taskId: string): Promise<void>;
    /**
     * 标记任务失败
     */
    markTaskFailed(taskId: string, error: string): Promise<void>;
    /**
     * 标记任务等待确认
     */
    markTaskWaiting(taskId: string): Promise<void>;
    /**
     * 标记任务阻塞（需要 Meeting）
     */
    markTaskBlocked(taskId: string, reason: string): Promise<void>;
    /**
     * 获取所有可并行执行的任务
     */
    getParallelTasks(): Promise<Task[]>;
    /**
     * 获取调度状态
     */
    getStatus(): {
        running: number;
        maxConcurrent: number;
        runningTaskIds: string[];
    };
}
