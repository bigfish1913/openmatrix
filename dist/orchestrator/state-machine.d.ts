import type { Task, TaskStatus } from '../types/index.js';
/**
 * 任务状态转换规则
 *
 * pending → scheduled → in_progress → verify → accept → completed
 *                │            │           │        │
 *                │            ▼           ▼        ▼
 *                │        blocked      failed   failed
 *                │            │           │        │
 *                │            ▼           └────────┘
 *                │        waiting              │
 *                │            │                ▼
 *                └────────────┴──────────► retry_queue
 */
export type TransitionEvent = 'schedule' | 'start' | 'develop_done' | 'verify_done' | 'accept_done' | 'need_verify' | 'need_accept' | 'block' | 'unblock' | 'wait' | 'resume' | 'fail' | 'retry' | 'cancel';
export interface TransitionResult {
    success: boolean;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    event: TransitionEvent;
    error?: string;
}
export interface StateTransition {
    from: TaskStatus;
    to: TaskStatus;
    event: TransitionEvent;
    condition?: (task: Task) => boolean;
}
export declare class StateMachine {
    /**
     * 尝试转换状态
     */
    transition(task: Task, event: TransitionEvent): TransitionResult;
    /**
     * 获取当前状态允许的转换
     */
    getAllowedTransitions(status: TaskStatus): {
        event: TransitionEvent;
        toStatus: TaskStatus;
    }[];
    /**
     * 检查是否可以执行指定事件
     */
    canTransition(task: Task, event: TransitionEvent): boolean;
    /**
     * 获取状态描述
     */
    getStatusDescription(status: TaskStatus): string;
    /**
     * 获取事件描述
     */
    getEventDescription(event: TransitionEvent): string;
}
