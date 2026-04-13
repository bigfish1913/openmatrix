import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../src/orchestrator/state-machine.js';
import type { TransitionEvent } from '../../src/orchestrator/state-machine.js';
import type { Task, TaskStatus } from '../../src/types/index.js';

function createTask(status: TaskStatus, overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Test',
    description: 'Test task',
    status,
    priority: 'P1',
    timeout: 60000,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'pending', duration: null },
      verify: { status: 'pending', duration: null },
      accept: { status: 'pending', duration: null }
    },
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('StateMachine', () => {
  const sm = new StateMachine();

  // ========== 1. transition - 合法转换 ==========

  describe('transition - valid transitions', () => {
    it('pending -> scheduled (schedule)', () => {
      const result = sm.transition(createTask('pending'), 'schedule');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('pending');
      expect(result.toStatus).toBe('scheduled');
      expect(result.event).toBe('schedule');
    });

    it('scheduled -> in_progress (start)', () => {
      const result = sm.transition(createTask('scheduled'), 'start');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('scheduled');
      expect(result.toStatus).toBe('in_progress');
      expect(result.event).toBe('start');
    });

    it('pending -> in_progress (start, skip scheduled)', () => {
      const result = sm.transition(createTask('pending'), 'start');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('pending');
      expect(result.toStatus).toBe('in_progress');
      expect(result.event).toBe('start');
    });

    it('in_progress -> verify (develop_done)', () => {
      const result = sm.transition(createTask('in_progress'), 'develop_done');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('in_progress');
      expect(result.toStatus).toBe('verify');
      expect(result.event).toBe('develop_done');
    });

    it('verify -> accept (verify_done)', () => {
      const result = sm.transition(createTask('verify'), 'verify_done');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('verify');
      expect(result.toStatus).toBe('accept');
      expect(result.event).toBe('verify_done');
    });

    it('accept -> completed (accept_done)', () => {
      const result = sm.transition(createTask('accept'), 'accept_done');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('accept');
      expect(result.toStatus).toBe('completed');
      expect(result.event).toBe('accept_done');
    });

    it('in_progress -> blocked (block)', () => {
      const result = sm.transition(createTask('in_progress'), 'block');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('in_progress');
      expect(result.toStatus).toBe('blocked');
      expect(result.event).toBe('block');
    });

    it('blocked -> waiting (wait)', () => {
      const result = sm.transition(createTask('blocked'), 'wait');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('blocked');
      expect(result.toStatus).toBe('waiting');
      expect(result.event).toBe('wait');
    });

    it('waiting -> in_progress (resume)', () => {
      const result = sm.transition(createTask('waiting'), 'resume');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('waiting');
      expect(result.toStatus).toBe('in_progress');
      expect(result.event).toBe('resume');
    });

    it('in_progress -> failed (fail)', () => {
      const result = sm.transition(createTask('in_progress'), 'fail');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('in_progress');
      expect(result.toStatus).toBe('failed');
      expect(result.event).toBe('fail');
    });

    it('verify -> failed (fail)', () => {
      const result = sm.transition(createTask('verify'), 'fail');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('verify');
      expect(result.toStatus).toBe('failed');
      expect(result.event).toBe('fail');
    });

    it('accept -> failed (fail)', () => {
      const result = sm.transition(createTask('accept'), 'fail');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('accept');
      expect(result.toStatus).toBe('failed');
      expect(result.event).toBe('fail');
    });

    it('failed -> retry_queue (retry)', () => {
      const result = sm.transition(createTask('failed'), 'retry');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('failed');
      expect(result.toStatus).toBe('retry_queue');
      expect(result.event).toBe('retry');
    });

    it('retry_queue -> pending (retry, retryCount < 100)', () => {
      const result = sm.transition(createTask('retry_queue', { retryCount: 5 }), 'retry');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('retry_queue');
      expect(result.toStatus).toBe('pending');
      expect(result.event).toBe('retry');
    });

    it('scheduled -> pending (cancel)', () => {
      const result = sm.transition(createTask('scheduled'), 'cancel');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('scheduled');
      expect(result.toStatus).toBe('pending');
      expect(result.event).toBe('cancel');
    });

    it('blocked -> pending (cancel)', () => {
      const result = sm.transition(createTask('blocked'), 'cancel');
      expect(result.success).toBe(true);
      expect(result.fromStatus).toBe('blocked');
      expect(result.toStatus).toBe('pending');
      expect(result.event).toBe('cancel');
    });
  });

  // ========== 2. transition - 非法转换 ==========

  describe('transition - invalid transitions', () => {
    it('completed -> any should fail', () => {
      const events: TransitionEvent[] = ['schedule', 'start', 'develop_done', 'block', 'fail', 'cancel', 'retry'];
      for (const event of events) {
        const result = sm.transition(createTask('completed'), event);
        expect(result.success).toBe(false);
        expect(result.toStatus).toBe('completed');
        expect(result.error).toBeDefined();
      }
    });

    it('pending -> completed should fail (cannot complete directly)', () => {
      const result = sm.transition(createTask('pending'), 'accept_done');
      expect(result.success).toBe(false);
      expect(result.fromStatus).toBe('pending');
      expect(result.toStatus).toBe('pending');
      expect(result.error).toContain('不允许的转换');
    });

    it('failed -> completed should fail (cannot complete directly)', () => {
      const result = sm.transition(createTask('failed'), 'accept_done');
      expect(result.success).toBe(false);
      expect(result.fromStatus).toBe('failed');
      expect(result.toStatus).toBe('failed');
    });

    it('blocked -> failed should fail (cannot mark failed directly)', () => {
      const result = sm.transition(createTask('blocked'), 'fail');
      expect(result.success).toBe(false);
      expect(result.fromStatus).toBe('blocked');
      expect(result.toStatus).toBe('blocked');
    });
  });

  // ========== 3. transition - 条件检查 ==========

  describe('transition - condition checks', () => {
    it('retry_queue -> pending should fail when retryCount >= 100', () => {
      const result = sm.transition(createTask('retry_queue', { retryCount: 100 }), 'retry');
      expect(result.success).toBe(false);
      expect(result.fromStatus).toBe('retry_queue');
      expect(result.toStatus).toBe('retry_queue');
      expect(result.error).toContain('条件不满足');
    });

    it('retry_queue -> pending should fail when retryCount > 100', () => {
      const result = sm.transition(createTask('retry_queue', { retryCount: 150 }), 'retry');
      expect(result.success).toBe(false);
      expect(result.error).toContain('条件不满足');
    });

    it('retry_queue -> pending should succeed when retryCount = 0', () => {
      const result = sm.transition(createTask('retry_queue', { retryCount: 0 }), 'retry');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('pending');
    });

    it('retry_queue -> pending should succeed when retryCount = 99', () => {
      const result = sm.transition(createTask('retry_queue', { retryCount: 99 }), 'retry');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('pending');
    });
  });

  // ========== 4. getAllowedTransitions ==========

  describe('getAllowedTransitions', () => {
    it('pending allows: schedule, start', () => {
      const transitions = sm.getAllowedTransitions('pending');
      const events = transitions.map(t => t.event);
      expect(events).toContain('schedule');
      expect(events).toContain('start');
      expect(transitions).toHaveLength(2);
    });

    it('in_progress allows: develop_done, block, fail', () => {
      const transitions = sm.getAllowedTransitions('in_progress');
      const events = transitions.map(t => t.event);
      expect(events).toContain('develop_done');
      expect(events).toContain('block');
      expect(events).toContain('fail');
      expect(transitions).toHaveLength(3);
    });

    it('failed allows: retry', () => {
      const transitions = sm.getAllowedTransitions('failed');
      const events = transitions.map(t => t.event);
      expect(events).toContain('retry');
      expect(transitions).toHaveLength(1);
    });

    it('blocked allows: wait, cancel', () => {
      const transitions = sm.getAllowedTransitions('blocked');
      const events = transitions.map(t => t.event);
      expect(events).toContain('wait');
      expect(events).toContain('cancel');
      expect(transitions).toHaveLength(2);
    });

    it('completed has no allowed transitions', () => {
      const transitions = sm.getAllowedTransitions('completed');
      expect(transitions).toHaveLength(0);
    });
  });

  // ========== 5. canTransition ==========

  describe('canTransition', () => {
    it('returns true for valid transition: pending + schedule', () => {
      expect(sm.canTransition(createTask('pending'), 'schedule')).toBe(true);
    });

    it('returns true for valid transition: in_progress + develop_done', () => {
      expect(sm.canTransition(createTask('in_progress'), 'develop_done')).toBe(true);
    });

    it('returns true for valid transition: failed + retry', () => {
      expect(sm.canTransition(createTask('failed'), 'retry')).toBe(true);
    });

    it('returns false for invalid transition: completed + start', () => {
      expect(sm.canTransition(createTask('completed'), 'start')).toBe(false);
    });

    it('returns false for invalid transition: pending + fail', () => {
      expect(sm.canTransition(createTask('pending'), 'fail')).toBe(false);
    });

    it('returns false for invalid transition: blocked + start', () => {
      expect(sm.canTransition(createTask('blocked'), 'start')).toBe(false);
    });
  });

  // ========== 6. getStatusDescription ==========

  describe('getStatusDescription', () => {
    const statuses: TaskStatus[] = [
      'pending', 'scheduled', 'in_progress', 'blocked',
      'waiting', 'verify', 'accept', 'completed', 'failed', 'retry_queue'
    ];

    it('returns a non-empty description for every status', () => {
      for (const status of statuses) {
        const desc = sm.getStatusDescription(status);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      }
    });

    it('returns correct descriptions for key statuses', () => {
      expect(sm.getStatusDescription('pending')).toBe('等待执行');
      expect(sm.getStatusDescription('in_progress')).toBe('执行中');
      expect(sm.getStatusDescription('completed')).toBe('已完成');
      expect(sm.getStatusDescription('failed')).toBe('失败');
    });
  });

  // ========== 7. getEventDescription ==========

  describe('getEventDescription', () => {
    const events: TransitionEvent[] = [
      'schedule', 'start', 'develop_done', 'verify_done',
      'accept_done', 'need_verify', 'need_accept', 'block',
      'unblock', 'wait', 'resume', 'fail', 'retry', 'cancel'
    ];

    it('returns a non-empty description for every event', () => {
      for (const event of events) {
        const desc = sm.getEventDescription(event);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe('string');
        expect(desc.length).toBeGreaterThan(0);
      }
    });

    it('returns correct descriptions for key events', () => {
      expect(sm.getEventDescription('schedule')).toBe('调度任务');
      expect(sm.getEventDescription('start')).toBe('开始执行');
      expect(sm.getEventDescription('fail')).toBe('标记失败');
      expect(sm.getEventDescription('retry')).toBe('重试任务');
      expect(sm.getEventDescription('cancel')).toBe('取消任务');
    });
  });
});
