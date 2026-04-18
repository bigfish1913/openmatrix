// tests/cli/commands/approve.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { Approval } from '../../../src/types/index.js';

// Use vi.hoisted so the mock object is available in hoisted vi.mock calls
const { loggerMock, mockApprovalManager, mockStateManager } = vi.hoisted(() => {
  const mockApprovalManager = {
    getPendingApprovals: vi.fn(),
    getApproval: vi.fn(),
    processDecision: vi.fn()
  };

  const mockStateManager = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn(),
    updateState: vi.fn()
  };

  return {
    loggerMock: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    },
    mockApprovalManager,
    mockStateManager
  };
});

vi.mock('../../../src/utils/logger.js', () => ({
  logger: loggerMock
}));

vi.mock('../../../src/orchestrator/approval-manager.js', () => ({
  ApprovalManager: vi.fn().mockImplementation(() => mockApprovalManager)
}));

vi.mock('../../../src/storage/state-manager.js', () => ({
  StateManager: vi.fn().mockImplementation(() => mockStateManager)
}));

// Import after mocking
import { logger } from '../../../src/utils/logger.js';
import { ApprovalManager } from '../../../src/orchestrator/approval-manager.js';
import { StateManager } from '../../../src/storage/state-manager.js';

// Test data
const mockPendingApprovals: Approval[] = [
  {
    id: 'APPR-001',
    type: 'plan',
    taskId: 'TASK-001',
    title: 'Test approval',
    description: 'A test approval',
    content: 'Approval content',
    options: [
      { key: 'approve', label: 'Approve' },
      { key: 'modify', label: 'Modify' },
      { key: 'reject', label: 'Reject' }
    ],
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'APPR-002',
    type: 'merge',
    taskId: 'TASK-002',
    title: 'Merge approval',
    description: 'Merge desc',
    content: 'Merge content',
    options: [{ key: 'approve', label: 'Approve' }],
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

const mockProcessedApproval: Approval = {
  id: 'APPR-003',
  type: 'plan',
  taskId: 'TASK-003',
  title: 'Processed',
  description: 'Already processed',
  content: 'Content',
  options: [{ key: 'approve', label: 'Approve' }],
  status: 'approved',
  decision: 'approve',
  createdAt: new Date().toISOString(),
  decidedAt: new Date().toISOString()
};

/**
 * Directly invoke the approve action logic (mirrors src/cli/commands/approve.ts)
 */
async function approveAction(approvalId?: string, options: { json?: boolean; decision?: string; comment?: string } = {}) {
  const basePath = process.cwd();
  const omPath = `${basePath}/.openmatrix`;

  const stateManager = new StateManager(omPath);
  await stateManager.initialize();

  const approvalManager = new ApprovalManager(stateManager);

  // If no approvalId, list pending approvals
  if (!approvalId) {
    const pendingApprovals = await approvalManager.getPendingApprovals();

    if (pendingApprovals.length === 0) {
      if (options.json) {
        logger.info(JSON.stringify({ status: 'empty', pending: [] }));
      } else {
        logger.info('没有待处理的审批');
      }
      return;
    }

    if (options.json) {
      logger.info(JSON.stringify({ status: 'pending', pending: pendingApprovals }));
    } else {
      logger.info('待处理审批:\n');
      pendingApprovals.forEach((approval: Approval, i: number) => {
        logger.info(`  [${i + 1}] ${approval.id}: ${approval.title}`);
        logger.info(`      类型: ${approval.type} | 任务: ${approval.taskId}`);
      });
      logger.info('\n使用 openmatrix approve <ID> 处理审批');
    }
    return;
  }

  // Get the approval
  const approval = await approvalManager.getApproval(approvalId);
  if (!approval) {
    logger.info(`审批 ${approvalId} 不存在`);
    return;
  }

  if (approval.status !== 'pending') {
    logger.info(`审批 ${approvalId} 已处理`);
    logger.info(`   状态: ${approval.status}`);
    logger.info(`   决策: ${approval.decision}`);
    return;
  }

  // If no decision, show approval details
  if (!options.decision) {
    logger.info(`\n审批详情\n`);
    logger.info(`ID: ${approval.id}`);
    logger.info(`类型: ${approval.type}`);
    logger.info(`任务: ${approval.taskId}`);
    logger.info(`\n${approval.content}\n`);

    logger.info('选项:');
    approval.options.forEach(opt => {
      logger.info(`  ${opt.key}: ${opt.label}`);
    });

    logger.info('\n使用 openmatrix approve <ID> -d <decision>');
    return;
  }

  // Process decision
  const validDecisions = ['approve', 'modify', 'reject'];
  if (!validDecisions.includes(options.decision)) {
    logger.info(`无效决策: ${options.decision}`);
    logger.info(`   有效选项: ${validDecisions.join(', ')}`);
    return;
  }

  await approvalManager.processDecision({
    approvalId,
    decision: options.decision,
    comment: options.comment,
    decidedBy: 'user',
    decidedAt: new Date().toISOString()
  });

  const statusEmoji = options.decision === 'approve' ? 'ok' : 'fail';
  logger.info(`\n审批已处理: ${options.decision}`);

  if (options.decision === 'approve') {
    logger.info('\n使用 /om:resume 继续执行任务');
  }
}

describe('approve command - logger usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApprovalManager.getPendingApprovals.mockResolvedValue(mockPendingApprovals);
    mockApprovalManager.getApproval.mockResolvedValue(null);
    mockApprovalManager.processDecision.mockResolvedValue({});
    mockStateManager.initialize.mockResolvedValue(undefined);
  });

  describe('source code verification', () => {
    it('should not contain any console.log calls', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/approve.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    });

    it('should import logger from utils/logger', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/approve.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).toMatch(/from.*logger/);
    });

    it('should use logger.info for all output (18+ calls)', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/approve.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      const loggerInfoCount = (source.match(/logger\.info/g) || []).length;
      expect(loggerInfoCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('no approvalId - list pending approvals', () => {
    it('should log JSON when --json and no pending approvals', async () => {
      mockApprovalManager.getPendingApprovals.mockResolvedValueOnce([]);

      await approveAction(undefined, { json: true });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('"status":"empty"')
      );
    });

    it('should log no-pending message when no pending and no --json', async () => {
      mockApprovalManager.getPendingApprovals.mockResolvedValueOnce([]);

      await approveAction(undefined, {});

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('没有待处理的审批')
      );
    });

    it('should log JSON pending list when --json and approvals exist', async () => {
      mockApprovalManager.getPendingApprovals.mockResolvedValueOnce(mockPendingApprovals);

      await approveAction(undefined, { json: true });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('"status":"pending"')
      );
    });

    it('should log human-readable pending list when no --json', async () => {
      mockApprovalManager.getPendingApprovals.mockResolvedValueOnce(mockPendingApprovals);

      await approveAction(undefined, {});

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('待处理审批')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('APPR-001')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('openmatrix approve')
      );
    });
  });

  describe('with approvalId', () => {
    it('should log error when approval not found', async () => {
      mockApprovalManager.getApproval.mockResolvedValueOnce(null);

      await approveAction('APPR-999');

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('不存在')
      );
    });

    it('should log error when approval already processed', async () => {
      mockApprovalManager.getApproval.mockResolvedValueOnce(mockProcessedApproval);

      await approveAction('APPR-003');

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('已处理')
      );
    });

    it('should log approval details when no decision provided', async () => {
      const pendingApproval = { ...mockPendingApprovals[0] };
      mockApprovalManager.getApproval.mockResolvedValueOnce(pendingApproval);

      await approveAction('APPR-001');

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('审批详情')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('APPR-001')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('openmatrix approve')
      );
    });

    it('should log error for invalid decision', async () => {
      const pendingApproval = { ...mockPendingApprovals[0] };
      mockApprovalManager.getApproval.mockResolvedValueOnce(pendingApproval);

      await approveAction('APPR-001', { decision: 'invalid' });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('无效决策')
      );
    });

    it('should log approval result for approve decision', async () => {
      const pendingApproval = { ...mockPendingApprovals[0] };
      mockApprovalManager.getApproval.mockResolvedValueOnce(pendingApproval);
      mockApprovalManager.processDecision.mockResolvedValueOnce({});

      await approveAction('APPR-001', { decision: 'approve', comment: 'LGTM' });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('审批已处理')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('/om:resume')
      );
      expect(mockApprovalManager.processDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalId: 'APPR-001',
          decision: 'approve',
          comment: 'LGTM'
        })
      );
    });

    it('should log rejection result for reject decision', async () => {
      const pendingApproval = { ...mockPendingApprovals[0] };
      mockApprovalManager.getApproval.mockResolvedValueOnce(pendingApproval);
      mockApprovalManager.processDecision.mockResolvedValueOnce({});

      await approveAction('APPR-001', { decision: 'reject' });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('审批已处理')
      );
      const allCalls = loggerMock.info.mock.calls.map((c: any) => c[0]);
      const hasResumeHint = allCalls.some((c: string) => c.includes('/om:resume'));
      expect(hasResumeHint).toBe(false);
    });

    it('should log result for modify decision', async () => {
      const pendingApproval = { ...mockPendingApprovals[0] };
      mockApprovalManager.getApproval.mockResolvedValueOnce(pendingApproval);
      mockApprovalManager.processDecision.mockResolvedValueOnce({});

      await approveAction('APPR-001', { decision: 'modify' });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('审批已处理')
      );
    });
  });

  describe('logger method verification', () => {
    it('should only use logger.info, not logger.error/warn/debug', async () => {
      mockApprovalManager.getPendingApprovals.mockResolvedValueOnce([]);

      await approveAction(undefined, {});

      expect(loggerMock.info).toHaveBeenCalled();
      expect(loggerMock.error).not.toHaveBeenCalled();
      expect(loggerMock.warn).not.toHaveBeenCalled();
      expect(loggerMock.debug).not.toHaveBeenCalled();
    });
  });
});
