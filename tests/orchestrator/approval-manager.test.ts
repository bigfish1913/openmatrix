// tests/orchestrator/approval-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ApprovalManager', () => {
  let approvalManager: ApprovalManager;
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-approval-test-'));
    stateManager = new StateManager(tempDir);
    await stateManager.initialize();
    approvalManager = new ApprovalManager(stateManager);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createApproval', () => {
    it('should create approval with default options', async () => {
      const approval = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Plan Approval',
        description: 'Test plan approval',
        content: 'Plan content'
      });

      expect(approval.id).toMatch(/^APPR-/);
      expect(approval.type).toBe('plan');
      expect(approval.taskId).toBe('TASK-001');
      expect(approval.status).toBe('pending');
      expect(approval.options).toHaveLength(3);
    });

    it('should create approval with custom options', async () => {
      const approval = await approvalManager.createApproval({
        type: 'deploy',
        taskId: 'TASK-001',
        title: 'Deploy Approval',
        description: 'Test deploy',
        content: 'Deploy info',
        options: [
          { key: 'approve', label: 'Deploy' },
          { key: 'reject', label: 'Cancel' }
        ]
      });

      expect(approval.options).toHaveLength(2);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals', async () => {
      const approval1 = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Approval 1',
        description: 'Desc',
        content: 'Content'
      });

      // Ensure unique ID by adding small delay
      await new Promise(r => setTimeout(r, 10));

      const approval2 = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-002',
        title: 'Approval 2',
        description: 'Desc',
        content: 'Content'
      });

      const pending = await approvalManager.getPendingApprovals();
      expect(pending).toHaveLength(2);
      expect(pending.some(a => a.id === approval1.id)).toBe(true);
      expect(pending.some(a => a.id === approval2.id)).toBe(true);
    });

    it('should return empty array when no pending approvals', async () => {
      const pending = await approvalManager.getPendingApprovals();
      expect(pending).toHaveLength(0);
    });
  });

  describe('getApproval', () => {
    it('should get approval by id', async () => {
      const created = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Desc',
        content: 'Content'
      });

      const retrieved = await approvalManager.getApproval(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent approval', async () => {
      const approval = await approvalManager.getApproval('APPR-NONEXISTENT');
      expect(approval).toBeNull();
    });
  });

  describe('processDecision', () => {
    it('should approve approval', async () => {
      const approval = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Desc',
        content: 'Content'
      });

      const result = await approvalManager.processDecision({
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      expect(result.status).toBe('approved');
      expect(result.decision).toBe('approve');
    });

    it('should reject approval', async () => {
      const approval = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Desc',
        content: 'Content'
      });

      const result = await approvalManager.processDecision({
        approvalId: approval.id,
        decision: 'reject',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      expect(result.status).toBe('rejected');
      expect(result.decision).toBe('reject');
    });

    it('should throw error for non-existent approval', async () => {
      await expect(approvalManager.processDecision({
        approvalId: 'APPR-NONEXISTENT',
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      })).rejects.toThrow('不存在');
    });

    it('should throw error for already processed approval', async () => {
      const approval = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Desc',
        content: 'Content'
      });

      await approvalManager.processDecision({
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      await expect(approvalManager.processDecision({
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      })).rejects.toThrow('已处理');
    });

    it('should update task status when meeting approval is approved', async () => {
      // Create a task first
      const task = await stateManager.createTask({
        title: 'Blocked Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // Mark task as blocked
      await stateManager.updateTask(task.id, { status: 'blocked', error: 'Test blocking' });

      const approval = await approvalManager.createApproval({
        type: 'meeting',
        taskId: task.id,
        title: 'Meeting',
        description: 'Desc',
        content: 'Content'
      });

      await approvalManager.processDecision({
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      const updatedTask = await stateManager.getTask(task.id);
      expect(updatedTask?.status).toBe('pending');
      expect(updatedTask?.error).toBeNull();
    });
  });

  describe('createMeetingApproval', () => {
    it('should create meeting approval', async () => {
      const approval = await approvalManager.createMeetingApproval(
        'TASK-001',
        'Missing dependency',
        ['Task A', 'Task B']
      );

      expect(approval.type).toBe('meeting');
      expect(approval.taskId).toBe('TASK-001');
      expect(approval.title).toContain('阻塞');
    });
  });

  describe('createPlanApproval', () => {
    it('should create plan approval', async () => {
      const approval = await approvalManager.createPlanApproval(
        'TASK-001',
        'Plan content here'
      );

      expect(approval.type).toBe('plan');
      expect(approval.content).toBe('Plan content here');
    });
  });

  describe('createMergeApproval', () => {
    it('should create merge approval', async () => {
      const approval = await approvalManager.createMergeApproval(
        'TASK-001',
        'Code changes'
      );

      expect(approval.type).toBe('merge');
      expect(approval.title).toContain('合并');
    });
  });

  describe('createDeployApproval', () => {
    it('should create deploy approval', async () => {
      const approval = await approvalManager.createDeployApproval(
        'TASK-001',
        'Deploy info'
      );

      expect(approval.type).toBe('deploy');
      expect(approval.options).toHaveLength(2);
    });
  });

  describe('hasPendingApprovals', () => {
    it('should return true when pending approvals exist', async () => {
      await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Desc',
        content: 'Content'
      });

      const hasPending = await approvalManager.hasPendingApprovals();
      expect(hasPending).toBe(true);
    });

    it('should return false when no pending approvals', async () => {
      const hasPending = await approvalManager.hasPendingApprovals();
      expect(hasPending).toBe(false);
    });
  });

  describe('getApprovalHistory', () => {
    it('should return approval history', async () => {
      const approval1 = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-001',
        title: 'Test 1',
        description: 'Desc',
        content: 'Content'
      });

      await approvalManager.processDecision({
        approvalId: approval1.id,
        decision: 'approve',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      // Create second approval after first is processed
      const approval2 = await approvalManager.createApproval({
        type: 'plan',
        taskId: 'TASK-002',
        title: 'Test 2',
        description: 'Desc',
        content: 'Content'
      });

      await approvalManager.processDecision({
        approvalId: approval2.id,
        decision: 'reject',
        decidedBy: 'user',
        decidedAt: new Date().toISOString()
      });

      const history = await approvalManager.getApprovalHistory();
      expect(history).toHaveLength(2);
    });
  });
});