// src/orchestrator/state-machine.ts
import type { Task, TaskStatus } from '../types/index.js';

/**
 * 任务状态转换规则
 *
 * pending → scheduled → in_progress → verify → accept → completed
 *    │                       │           │        │
 *    ├──────► blocked ◄──────┘           ▼        ▼
 *    │            │                   failed ◄─ failed
 *    │            ▼                      │
 *    │        waiting                    ▼
 *    │            │               retry_queue
 *    │            │                   │  │
 *    └────────────┴───────────────────┘  └──► blocked
 *
 * retry_queue → in_progress (直接重试)
 * scheduled/blocked/waiting → failed
 */

export type TransitionEvent =
  | 'schedule'      // 调度
  | 'start'         // 开始执行
  | 'develop_done'  // 开发完成
  | 'verify_done'   // 验证完成
  | 'accept_done'   // 验收完成
  | 'block'         // 阻塞
  | 'wait'          // 等待外部资源
  | 'resume'        // 恢复
  | 'fail'          // 失败
  | 'retry'         // 重试
  | 'cancel';       // 取消

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

// 定义允许的状态转换
const TRANSITIONS: StateTransition[] = [
  // pending → scheduled
  { from: 'pending', to: 'scheduled', event: 'schedule' },

  // scheduled → in_progress
  { from: 'scheduled', to: 'in_progress', event: 'start' },

  // pending → in_progress (跳过 scheduled，直接开始)
  { from: 'pending', to: 'in_progress', event: 'start' },

  // retry_queue → in_progress (重试后直接开始)
  { from: 'retry_queue', to: 'in_progress', event: 'start' },

  // pending → blocked (循环依赖检测)
  { from: 'pending', to: 'blocked', event: 'block' },

  // retry_queue → blocked (循环依赖检测)
  { from: 'retry_queue', to: 'blocked', event: 'block' },

  // in_progress → verify
  { from: 'in_progress', to: 'verify', event: 'develop_done' },

  // verify → accept
  { from: 'verify', to: 'accept', event: 'verify_done' },

  // accept → completed
  { from: 'accept', to: 'completed', event: 'accept_done' },

  // in_progress → blocked
  { from: 'in_progress', to: 'blocked', event: 'block' },

  // blocked → waiting (等待 Meeting)
  { from: 'blocked', to: 'waiting', event: 'wait' },

  // waiting → in_progress (Meeting 解决后)
  { from: 'waiting', to: 'in_progress', event: 'resume' },

  // any → failed
  { from: 'in_progress', to: 'failed', event: 'fail' },
  { from: 'verify', to: 'failed', event: 'fail' },
  { from: 'accept', to: 'failed', event: 'fail' },
  { from: 'scheduled', to: 'failed', event: 'fail' },
  { from: 'blocked', to: 'failed', event: 'fail' },
  { from: 'waiting', to: 'failed', event: 'fail' },

  // failed → retry_queue
  { from: 'failed', to: 'retry_queue', event: 'retry' },

  // retry_queue → pending (安全上限 100，由 executor 层控制具体 maxRetries)
  { from: 'retry_queue', to: 'pending', event: 'retry', condition: (task) => (task.retryCount || 0) < 100 },

  // any → pending (cancel and restart)
  { from: 'scheduled', to: 'pending', event: 'cancel' },
  { from: 'blocked', to: 'pending', event: 'cancel' },
];

export class StateMachine {
  /**
   * 尝试转换状态
   */
  transition(task: Task, event: TransitionEvent): TransitionResult {
    const fromStatus = task.status;

    // 查找允许的转换
    const allowedTransition = TRANSITIONS.find(
      t => t.from === fromStatus && t.event === event
    );

    if (!allowedTransition) {
      return {
        success: false,
        fromStatus,
        toStatus: fromStatus,
        event,
        error: `不允许的转换: ${fromStatus} --[${event}]--> ?`
      };
    }

    // 检查条件
    if (allowedTransition.condition && !allowedTransition.condition(task)) {
      return {
        success: false,
        fromStatus,
        toStatus: fromStatus,
        event,
        error: '转换条件不满足'
      };
    }

    return {
      success: true,
      fromStatus,
      toStatus: allowedTransition.to,
      event
    };
  }

  /**
   * 获取当前状态允许的转换
   */
  getAllowedTransitions(status: TaskStatus): { event: TransitionEvent; toStatus: TaskStatus }[] {
    return TRANSITIONS
      .filter(t => t.from === status)
      .map(t => ({ event: t.event, toStatus: t.to }));
  }

  /**
   * 检查是否可以执行指定事件
   */
  canTransition(task: Task, event: TransitionEvent): boolean {
    const result = this.transition(task, event);
    return result.success;
  }

  /**
   * 获取状态描述
   */
  getStatusDescription(status: TaskStatus): string {
    const descriptions: Record<TaskStatus, string> = {
      'pending': '等待执行',
      'scheduled': '已调度，等待 Agent',
      'in_progress': '执行中',
      'blocked': '被阻塞',
      'waiting': '等待确认/Meeting',
      'verify': '验证中',
      'accept': '验收中',
      'completed': '已完成',
      'failed': '失败',
      'retry_queue': '重试队列'
    };
    return descriptions[status] || status;
  }

  /**
   * 获取事件描述
   */
  getEventDescription(event: TransitionEvent): string {
    const descriptions: Record<TransitionEvent, string> = {
      'schedule': '调度任务',
      'start': '开始执行',
      'develop_done': '开发完成',
      'verify_done': '验证完成',
      'accept_done': '验收完成',
      'block': '阻塞任务',
      'wait': '等待外部',
      'resume': '恢复执行',
      'fail': '标记失败',
      'retry': '重试任务',
      'cancel': '取消任务'
    };
    return descriptions[event] || event;
  }
}
