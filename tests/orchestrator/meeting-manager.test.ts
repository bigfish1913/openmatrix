// tests/orchestrator/meeting-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MeetingManager } from '../../src/orchestrator/meeting-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AmbiguityReport, AmbiguityItem, AmbiguitySeverity } from '../../src/types/index.js';

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

  /**
   * Helper function to create a valid AmbiguityReport
   */
  function createAmbiguityReport(
    taskId: string,
    ambiguities: AmbiguityItem[],
    options: {
      detectionPhase?: 'pre_execution' | 'during_execution';
      maxSeverity?: AmbiguitySeverity;
      suggestedStrategy?: 'ask_immediate' | 'write_meeting' | 'continue';
      suggestedQuestions?: string[];
    } = {}
  ): AmbiguityReport {
    const hasAmbiguity = ambiguities.length > 0;
    const maxSeverity = options.maxSeverity || (hasAmbiguity ? ambiguities.reduce((max, a) => {
      const order: AmbiguitySeverity[] = ['critical', 'high', 'medium', 'low'];
      return order.indexOf(a.severity) < order.indexOf(max) ? a.severity : max;
    }, 'low' as AmbiguitySeverity) : undefined);

    return {
      id: `amb-report-${Date.now().toString(36)}`,
      taskId,
      detectionPhase: options.detectionPhase || 'pre_execution',
      ambiguities,
      hasAmbiguity,
      maxSeverity,
      detectedAt: new Date().toISOString(),
      suggestedStrategy: options.suggestedStrategy,
      suggestedQuestions: options.suggestedQuestions
    };
  }

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

  describe('createAmbiguityMeeting', () => {
    it('should create ambiguity meeting with correct properties', async () => {
      const ambiguities: AmbiguityItem[] = [
        {
          id: 'amb-001',
          type: 'requirement',
          severity: 'high',
          description: 'User authentication flow is unclear',
          impactScope: ['AuthService', 'LoginController'],
          possibleSolutions: ['OAuth2', 'JWT', 'Session-based'],
          relatedFiles: ['src/auth/login.ts'],
          relatedTaskIds: ['TASK-002']
        }
      ];
      const report = createAmbiguityReport('TASK-001', ambiguities);

      const { meeting, approval } = await meetingManager.createAmbiguityMeeting(
        'TASK-001',
        report
      );

      expect(meeting.id).toMatch(/^meeting-/);
      expect(meeting.type).toBe('ambiguity');
      expect(meeting.status).toBe('pending');
      expect(meeting.taskId).toBe('TASK-001');
      expect(meeting.ambiguityReport).toEqual(report);
      expect(meeting.suggestedQuestions).toEqual(report.suggestedQuestions);
      expect(meeting.impactScope).toEqual(['AuthService', 'LoginController']);

      expect(approval.type).toBe('meeting');
      expect(approval.taskId).toBe('TASK-001');
    });

    it('should create approval with formatted ambiguity report', async () => {
      const ambiguities: AmbiguityItem[] = [
        {
          id: 'amb-001',
          type: 'technical',
          severity: 'medium',
          description: 'Database schema design needs clarification',
          impactScope: ['DatabaseModule'],
          possibleSolutions: ['Normalize tables', 'Use JSON columns']
        }
      ];
      const report = createAmbiguityReport('TASK-001', ambiguities, {
        detectionPhase: 'pre_execution',
        suggestedStrategy: 'ask_immediate',
        suggestedQuestions: ['Which database approach to use?']
      });

      const { approval } = await meetingManager.createAmbiguityMeeting(
        'TASK-001',
        report
      );

      expect(approval.description).toContain('歧义检测结果');
      expect(approval.description).toContain('执行前');
      expect(approval.description).toContain('检测时间');
      expect(approval.description).toContain('歧义数量');
      expect(approval.description).toContain('technical');
      expect(approval.description).toContain('Database schema design');
      expect(approval.description).toContain('DatabaseModule');
      expect(approval.description).toContain('可能的解决方案');
      expect(approval.description).toContain('建议处理策略');
      expect(approval.description).toContain('建议的问题');
    });

    describe('severity-based title prefix', () => {
      it('should use 🔴 Critical prefix for critical severity', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'critical',
            description: 'Critical ambiguity in core feature',
            impactScope: ['CoreModule']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, { maxSeverity: 'critical' });

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.title).toContain('🔴 Critical');
      });

      it('should use 🟠 High prefix for high severity', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'technical',
            severity: 'high',
            description: 'High priority technical ambiguity',
            impactScope: ['TechModule']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, { maxSeverity: 'high' });

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.title).toContain('🟠 High');
      });

      it('should use 🟡 Medium prefix for medium severity', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'dependency',
            severity: 'medium',
            description: 'Medium priority dependency ambiguity',
            impactScope: ['DepModule']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, { maxSeverity: 'medium' });

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.title).toContain('🟡 Medium');
      });

      it('should use 🟢 Low prefix for low severity', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'acceptance',
            severity: 'low',
            description: 'Low priority acceptance ambiguity',
            impactScope: ['AccModule']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, { maxSeverity: 'low' });

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.title).toContain('🟢 Low');
      });

      it('should derive maxSeverity from ambiguities when not provided', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'low',
            description: 'Low severity',
            impactScope: []
          },
          {
            id: 'amb-002',
            type: 'technical',
            severity: 'critical',
            description: 'Critical severity',
            impactScope: []
          }
        ];
        // Don't set maxSeverity explicitly - should derive from ambiguities
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        // Should use critical as it's the highest severity
        expect(meeting.title).toContain('🔴 Critical');
      });
    });

    describe('formatAmbiguityReport edge cases', () => {
      it('should handle ambiguities without optional fields', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'medium',
            description: 'Simple ambiguity',
            impactScope: ['ScopeA']
            // No possibleSolutions, relatedFiles, relatedTaskIds
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(approval.description).toContain('Simple ambiguity');
        expect(approval.description).toContain('ScopeA');
        expect(approval.description).not.toContain('相关文件');
        expect(approval.description).not.toContain('相关任务');
        expect(approval.description).not.toContain('可能的解决方案');
      });

      it('should handle ambiguities with multiple related files and tasks', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'technical',
            severity: 'high',
            description: 'Complex ambiguity',
            impactScope: ['ModuleA', 'ModuleB'],
            possibleSolutions: ['Solution A', 'Solution B', 'Solution C'],
            relatedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
            relatedTaskIds: ['TASK-002', 'TASK-003']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(approval.description).toContain('file1.ts, file2.ts, file3.ts');
        expect(approval.description).toContain('TASK-002, TASK-003');
        expect(approval.description).toContain('Solution A');
        expect(approval.description).toContain('Solution B');
        expect(approval.description).toContain('Solution C');
      });

      it('should handle empty impactScope', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'test_result',
            severity: 'low',
            description: 'Test result ambiguity',
            impactScope: []
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { meeting, approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.impactScope).toEqual([]);
        expect(approval.description).toContain('Test result ambiguity');
      });

      it('should handle report without suggestedStrategy and suggestedQuestions', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'medium',
            description: 'Ambiguity without suggestions',
            impactScope: ['ScopeA']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, {
          suggestedStrategy: undefined,
          suggestedQuestions: undefined
        });

        const { approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(approval.description).not.toContain('建议处理策略');
        expect(approval.description).not.toContain('建议的问题');
      });

      it('should handle during_execution detection phase', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'technical',
            severity: 'high',
            description: 'Runtime ambiguity',
            impactScope: ['Runtime']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, {
          detectionPhase: 'during_execution'
        });

        const { approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(approval.description).toContain('执行中');
      });
    });

    describe('empty and edge cases', () => {
      it('should handle empty ambiguities array', async () => {
        const report = createAmbiguityReport('TASK-001', []);

        const { meeting, approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.type).toBe('ambiguity');
        expect(meeting.impactScope).toEqual([]);
        // Should use 'medium' as default when no maxSeverity
        expect(meeting.title).toContain('歧义检测');
        expect(approval.description).toContain('歧义数量');
        expect(approval.description).toContain('0');
      });

      it('should handle multiple ambiguities with different types and severities', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'critical',
            description: 'Critical requirement issue',
            impactScope: ['ReqScope']
          },
          {
            id: 'amb-002',
            type: 'technical',
            severity: 'high',
            description: 'High technical issue',
            impactScope: ['TechScope'],
            possibleSolutions: ['Tech solution']
          },
          {
            id: 'amb-003',
            type: 'dependency',
            severity: 'medium',
            description: 'Medium dependency issue',
            impactScope: ['DepScope']
          },
          {
            id: 'amb-004',
            type: 'acceptance',
            severity: 'low',
            description: 'Low acceptance issue',
            impactScope: ['AccScope']
          },
          {
            id: 'amb-005',
            type: 'test_result',
            severity: 'high',
            description: 'High test result issue',
            impactScope: ['TestScope']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { meeting, approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        // Should flatten all impact scopes
        expect(meeting.impactScope).toEqual(['ReqScope', 'TechScope', 'DepScope', 'AccScope', 'TestScope']);

        // Title should use first ambiguity's description
        expect(meeting.title).toContain('Critical requirement issue');

        // All types should be in description
        expect(approval.description).toContain('requirement');
        expect(approval.description).toContain('technical');
        expect(approval.description).toContain('dependency');
        expect(approval.description).toContain('acceptance');
        expect(approval.description).toContain('test_result');
      });

      it('should handle very long description by truncating in title', async () => {
        const longDescription = 'This is a very long ambiguity description that exceeds the fifty character limit and should be truncated in the meeting title for better readability';
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'high',
            description: longDescription,
            impactScope: ['Scope']
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        // Title should contain truncated description (first 50 chars)
        expect(meeting.title).toContain(longDescription.slice(0, 50));
        expect(meeting.title.length).toBeLessThan(longDescription.length + 50);
      });
    });

    describe('meeting with suggestedQuestions', () => {
      it('should include suggestedQuestions in meeting', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'medium',
            description: 'Need user input',
            impactScope: ['Scope']
          }
        ];
        const suggestedQuestions = [
          'Which approach do you prefer?',
          'Should we prioritize performance or maintainability?'
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities, {
          suggestedQuestions
        });

        const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        expect(meeting.suggestedQuestions).toEqual(suggestedQuestions);
      });
    });

    describe('approval content', () => {
      it('should include meetingId and ambiguityReport in approval content', async () => {
        const ambiguities: AmbiguityItem[] = [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'high',
            description: 'Test ambiguity',
            impactScope: []
          }
        ];
        const report = createAmbiguityReport('TASK-001', ambiguities);

        const { meeting, approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

        const content = JSON.parse(approval.content);
        expect(content.meetingId).toBe(meeting.id);
        expect(content.ambiguityReport).toEqual(report);
      });
    });
  });

  describe('meeting status transitions for ambiguity meetings', () => {
    it('should transition ambiguity meeting through full lifecycle', async () => {
      const ambiguities: AmbiguityItem[] = [
        {
          id: 'amb-001',
          type: 'requirement',
          severity: 'high',
          description: 'Test ambiguity',
          impactScope: []
        }
      ];
      const report = createAmbiguityReport('TASK-001', ambiguities);

      const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);
      expect(meeting.status).toBe('pending');

      const started = await meetingManager.startMeeting(meeting.id);
      expect(started.status).toBe('in_progress');

      const resolved = await meetingManager.resolveMeeting(meeting.id, 'User clarified requirements');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toBe('User clarified requirements');
    });

    it('should cancel ambiguity meeting', async () => {
      const ambiguities: AmbiguityItem[] = [
        {
          id: 'amb-001',
          type: 'requirement',
          severity: 'medium',
          description: 'Test ambiguity',
          impactScope: []
        }
      ];
      const report = createAmbiguityReport('TASK-001', ambiguities);

      const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

      const cancelled = await meetingManager.cancelMeeting(meeting.id, 'No longer relevant');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.resolution).toContain('Cancelled');
    });
  });

  describe('generateMeetingReport for ambiguity meetings', () => {
    it('should generate report for ambiguity meeting', async () => {
      const ambiguities: AmbiguityItem[] = [
        {
          id: 'amb-001',
          type: 'requirement',
          severity: 'critical',
          description: 'Critical ambiguity detected',
          impactScope: ['AuthService', 'LoginModule']
        }
      ];
      const report = createAmbiguityReport('TASK-001', ambiguities);

      const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

      const generatedReport = meetingManager.generateMeetingReport(meeting);

      expect(generatedReport).toContain('Meeting 报告');
      expect(generatedReport).toContain(meeting.id);
      expect(generatedReport).toContain('ambiguity');
      expect(generatedReport).toContain('TASK-001');
      expect(generatedReport).toContain('AuthService');
      expect(generatedReport).toContain('LoginModule');
    });
  });
});