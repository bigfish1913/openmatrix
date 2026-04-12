// tests/orchestrator/meeting-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MeetingManager } from '../../src/orchestrator/meeting-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MeetingManager', () => {
  let meetingManager: MeetingManager;
  let approvalManager: ApprovalManager;
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-meeting-test-'));
    stateManager = new StateManager(tempDir);
    await stateManager.initialize();
    approvalManager = new ApprovalManager(stateManager);
    meetingManager = new MeetingManager(stateManager, approvalManager);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createBlockingMeeting', () => {
    it('should create blocking meeting', async () => {
      const { meeting, approval } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Missing dependency',
        ['Task A', 'Task B']
      );

      expect(meeting.id).toMatch(/^meeting-/);
      expect(meeting.type).toBe('blocking');
      expect(meeting.status).toBe('pending');
      expect(meeting.taskId).toBe('TASK-001');
      expect(meeting.blockingReason).toBe('Missing dependency');
      expect(meeting.impactScope).toEqual(['Task A', 'Task B']);

      expect(approval.type).toBe('meeting');
      expect(approval.taskId).toBe('TASK-001');
    });
  });

  describe('createDecisionMeeting', () => {
    it('should create decision meeting', async () => {
      const { meeting, approval } = await meetingManager.createDecisionMeeting(
        'TASK-001',
        'Which framework to use?',
        ['React', 'Vue', 'Angular']
      );

      expect(meeting.type).toBe('decision');
      expect(meeting.status).toBe('pending');
      expect(approval.type).toBe('meeting');
    });
  });

  describe('startMeeting', () => {
    it('should start meeting', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test blocking',
        []
      );

      const started = await meetingManager.startMeeting(meeting.id);

      expect(started.status).toBe('in_progress');
      expect(started.startedAt).toBeDefined();
    });

    it('should throw error for non-existent meeting', async () => {
      await expect(meetingManager.startMeeting('meeting-nonexistent'))
        .rejects.toThrow('not found');
    });
  });

  describe('resolveMeeting', () => {
    it('should resolve meeting', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test blocking',
        []
      );

      const resolved = await meetingManager.resolveMeeting(
        meeting.id,
        'Issue resolved by user'
      );

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('Issue resolved by user');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('should update blocked task to pending when resolved', async () => {
      // Create and block a task
      const task = await stateManager.createTask({
        title: 'Blocked Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });
      await stateManager.updateTask(task.id, { status: 'blocked', error: 'Test error' });

      const { meeting } = await meetingManager.createBlockingMeeting(
        task.id,
        'Test blocking',
        []
      );

      await meetingManager.resolveMeeting(meeting.id, 'Resolved');

      const updatedTask = await stateManager.getTask(task.id);
      expect(updatedTask?.status).toBe('pending');
    });

    it('should throw error for non-existent meeting', async () => {
      await expect(meetingManager.resolveMeeting('meeting-nonexistent', 'test'))
        .rejects.toThrow('not found');
    });
  });

  describe('cancelMeeting', () => {
    it('should cancel meeting', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test blocking',
        []
      );

      const cancelled = await meetingManager.cancelMeeting(
        meeting.id,
        'No longer needed'
      );

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.resolution).toContain('Cancelled');
    });

    it('should throw error for non-existent meeting', async () => {
      await expect(meetingManager.cancelMeeting('meeting-nonexistent', 'test'))
        .rejects.toThrow('not found');
    });
  });

  describe('getPendingMeetings', () => {
    it('should return pending meetings', async () => {
      const result1 = await meetingManager.createBlockingMeeting('TASK-001', 'Block 1', []);
      // Ensure unique ID by adding small delay
      await new Promise(r => setTimeout(r, 10));
      const result2 = await meetingManager.createBlockingMeeting('TASK-002', 'Block 2', []);

      const pending = await meetingManager.getPendingMeetings();
      expect(pending).toHaveLength(2);
      expect(pending.some(m => m.id === result1.meeting.id)).toBe(true);
      expect(pending.some(m => m.id === result2.meeting.id)).toBe(true);
    });

    it('should return empty array when no pending meetings', async () => {
      const pending = await meetingManager.getPendingMeetings();
      expect(pending).toHaveLength(0);
    });
  });

  describe('getActiveMeetings', () => {
    it('should return active meetings', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test',
        []
      );
      await meetingManager.startMeeting(meeting.id);

      const active = await meetingManager.getActiveMeetings();
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('in_progress');
    });
  });

  describe('hasBlockingMeetings', () => {
    it('should return true when blocking meetings exist', async () => {
      await meetingManager.createBlockingMeeting('TASK-001', 'Test', []);

      const hasBlocking = await meetingManager.hasBlockingMeetings();
      expect(hasBlocking).toBe(true);
    });

    it('should return false when no blocking meetings', async () => {
      const hasBlocking = await meetingManager.hasBlockingMeetings();
      expect(hasBlocking).toBe(false);
    });

    it('should not count resolved meetings', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test',
        []
      );
      await meetingManager.resolveMeeting(meeting.id, 'Resolved');

      const hasBlocking = await meetingManager.hasBlockingMeetings();
      expect(hasBlocking).toBe(false);
    });
  });

  describe('generateMeetingReport', () => {
    it('should generate meeting report', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Missing API key',
        ['AuthService', 'APIClient']
      );

      const report = meetingManager.generateMeetingReport(meeting);

      expect(report).toContain('Meeting 报告');
      expect(report).toContain(meeting.id);
      expect(report).toContain('blocking');
      expect(report).toContain('TASK-001');
      expect(report).toContain('Missing API key');
      expect(report).toContain('AuthService');
    });

    it('should include resolution in report', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test',
        []
      );
      const resolved = await meetingManager.resolveMeeting(meeting.id, 'Fixed');

      const report = meetingManager.generateMeetingReport(resolved);

      expect(report).toContain('解决方案');
      expect(report).toContain('Fixed');
    });
  });

  describe('meeting status transitions', () => {
    it('should transition pending -> in_progress -> resolved', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test',
        []
      );

      expect(meeting.status).toBe('pending');

      const started = await meetingManager.startMeeting(meeting.id);
      expect(started.status).toBe('in_progress');

      const resolved = await meetingManager.resolveMeeting(meeting.id, 'Done');
      expect(resolved.status).toBe('resolved');
    });

    it('should transition pending -> cancelled', async () => {
      const { meeting } = await meetingManager.createBlockingMeeting(
        'TASK-001',
        'Test',
        []
      );

      const cancelled = await meetingManager.cancelMeeting(meeting.id, 'Not needed');
      expect(cancelled.status).toBe('cancelled');
    });
  });
});