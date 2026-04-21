import { describe, it, expect } from 'vitest';
import type {
  AmbiguityType,
  AmbiguitySeverity,
  AmbiguityItem,
  AmbiguityReport,
  MeetingType,
  Meeting,
} from '../../src/types/index.js';
import { QUALITY_PRESETS } from '../../src/types/index.js';

describe('Ambiguity Types', () => {
  describe('AmbiguityType', () => {
    it('should accept valid AmbiguityType values', () => {
      const validTypes: AmbiguityType[] = [
        'requirement',
        'technical',
        'dependency',
        'acceptance',
        'test_result',
      ];

      validTypes.forEach((type) => {
        expect(type).toBeDefined();
      });
    });

    it('should have exactly 5 types', () => {
      const validTypes: AmbiguityType[] = [
        'requirement',
        'technical',
        'dependency',
        'acceptance',
        'test_result',
      ];
      expect(validTypes).toHaveLength(5);
    });

    it('should be assignable to string type', () => {
      const type: AmbiguityType = 'requirement';
      const str: string = type;
      expect(typeof str).toBe('string');
    });
  });

  describe('AmbiguitySeverity', () => {
    it('should accept valid AmbiguitySeverity values', () => {
      const validSeverities: AmbiguitySeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
      ];

      validSeverities.forEach((severity) => {
        expect(severity).toBeDefined();
      });
    });

    it('should have exactly 4 severity levels', () => {
      const validSeverities: AmbiguitySeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
      ];
      expect(validSeverities).toHaveLength(4);
    });

    it('should be ordered from highest to lowest', () => {
      const orderedSeverities: AmbiguitySeverity[] = [
        'critical',
        'high',
        'medium',
        'low',
      ];
      expect(orderedSeverities[0]).toBe('critical');
      expect(orderedSeverities[3]).toBe('low');
    });
  });

  describe('AmbiguityItem', () => {
    it('should create a valid AmbiguityItem with required fields', () => {
      const item: AmbiguityItem = {
        id: 'AMB-001',
        type: 'requirement',
        severity: 'high',
        description: 'Requirement is unclear about user authentication',
        impactScope: ['auth', 'user-management'],
      };

      expect(item.id).toBe('AMB-001');
      expect(item.type).toBe('requirement');
      expect(item.severity).toBe('high');
      expect(item.description).toBe('Requirement is unclear about user authentication');
      expect(item.impactScope).toEqual(['auth', 'user-management']);
    });

    it('should support optional fields', () => {
      const item: AmbiguityItem = {
        id: 'AMB-002',
        type: 'technical',
        severity: 'medium',
        description: 'Database selection unclear',
        impactScope: ['data-layer'],
        possibleSolutions: ['PostgreSQL', 'MongoDB', 'MySQL'],
        relatedFiles: ['src/db/config.ts', 'src/db/connection.ts'],
        relatedTaskIds: ['TASK-001', 'TASK-002'],
      };

      expect(item.possibleSolutions).toBeDefined();
      expect(item.possibleSolutions).toHaveLength(3);
      expect(item.relatedFiles).toHaveLength(2);
      expect(item.relatedTaskIds).toHaveLength(2);
    });

    it('should allow undefined optional fields', () => {
      const item: AmbiguityItem = {
        id: 'AMB-003',
        type: 'dependency',
        severity: 'low',
        description: 'Minor dependency version conflict',
        impactScope: ['build'],
      };

      expect(item.possibleSolutions).toBeUndefined();
      expect(item.relatedFiles).toBeUndefined();
      expect(item.relatedTaskIds).toBeUndefined();
    });

    it('should support all AmbiguityType values', () => {
      const types: AmbiguityType[] = [
        'requirement',
        'technical',
        'dependency',
        'acceptance',
        'test_result',
      ];

      types.forEach((type, index) => {
        const item: AmbiguityItem = {
          id: `AMB-${index}`,
          type,
          severity: 'medium',
          description: `Test for ${type}`,
          impactScope: [],
        };
        expect(item.type).toBe(type);
      });
    });

    it('should support all AmbiguitySeverity values', () => {
      const severities: AmbiguitySeverity[] = ['critical', 'high', 'medium', 'low'];

      severities.forEach((severity, index) => {
        const item: AmbiguityItem = {
          id: `AMB-${index}`,
          type: 'requirement',
          severity,
          description: `Test for ${severity}`,
          impactScope: [],
        };
        expect(item.severity).toBe(severity);
      });
    });
  });

  describe('AmbiguityReport', () => {
    it('should create a valid AmbiguityReport with required fields', () => {
      const report: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      expect(report.id).toBe('RPT-001');
      expect(report.taskId).toBe('TASK-001');
      expect(report.detectionPhase).toBe('pre_execution');
      expect(report.ambiguities).toEqual([]);
      expect(report.hasAmbiguity).toBe(false);
      expect(report.detectedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should support both detection phases', () => {
      const preReport: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      const duringReport: AmbiguityReport = {
        id: 'RPT-002',
        taskId: 'TASK-001',
        detectionPhase: 'during_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      expect(preReport.detectionPhase).toBe('pre_execution');
      expect(duringReport.detectionPhase).toBe('during_execution');
    });

    it('should support optional fields', () => {
      const report: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [
          {
            id: 'AMB-001',
            type: 'requirement',
            severity: 'high',
            description: 'Test',
            impactScope: [],
          },
        ],
        hasAmbiguity: true,
        maxSeverity: 'high',
        detectedAt: '2024-01-01T00:00:00Z',
        suggestedStrategy: 'ask_immediate',
        suggestedQuestions: ['What is the expected behavior?', 'Should this be configurable?'],
      };

      expect(report.maxSeverity).toBe('high');
      expect(report.suggestedStrategy).toBe('ask_immediate');
      expect(report.suggestedQuestions).toHaveLength(2);
    });

    it('should support all suggestedStrategy values', () => {
      const strategies: Array<'ask_immediate' | 'write_meeting' | 'continue'> = [
        'ask_immediate',
        'write_meeting',
        'continue',
      ];

      strategies.forEach((strategy, index) => {
        const report: AmbiguityReport = {
          id: `RPT-${index}`,
          taskId: 'TASK-001',
          detectionPhase: 'pre_execution',
          ambiguities: [],
          hasAmbiguity: false,
          detectedAt: '2024-01-01T00:00:00Z',
          suggestedStrategy: strategy,
        };
        expect(report.suggestedStrategy).toBe(strategy);
      });
    });

    it('should correctly represent hasAmbiguity based on ambiguities array', () => {
      const noAmbiguityReport: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      const hasAmbiguityReport: AmbiguityReport = {
        id: 'RPT-002',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [
          {
            id: 'AMB-001',
            type: 'technical',
            severity: 'critical',
            description: 'Critical technical ambiguity',
            impactScope: [],
          },
        ],
        hasAmbiguity: true,
        maxSeverity: 'critical',
        detectedAt: '2024-01-01T00:00:00Z',
      };

      expect(noAmbiguityReport.hasAmbiguity).toBe(false);
      expect(noAmbiguityReport.ambiguities).toHaveLength(0);

      expect(hasAmbiguityReport.hasAmbiguity).toBe(true);
      expect(hasAmbiguityReport.ambiguities).toHaveLength(1);
      expect(hasAmbiguityReport.maxSeverity).toBe('critical');
    });

    it('should contain multiple ambiguities', () => {
      const report: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'during_execution',
        ambiguities: [
          {
            id: 'AMB-001',
            type: 'requirement',
            severity: 'high',
            description: 'First ambiguity',
            impactScope: ['auth'],
          },
          {
            id: 'AMB-002',
            type: 'technical',
            severity: 'medium',
            description: 'Second ambiguity',
            impactScope: ['api'],
          },
          {
            id: 'AMB-003',
            type: 'dependency',
            severity: 'low',
            description: 'Third ambiguity',
            impactScope: ['build'],
          },
        ],
        hasAmbiguity: true,
        maxSeverity: 'high',
        detectedAt: '2024-01-01T00:00:00Z',
      };

      expect(report.ambiguities).toHaveLength(3);
      expect(report.maxSeverity).toBe('high');
    });
  });

  describe('MeetingType', () => {
    it('should include ambiguity type', () => {
      const meetingTypes: MeetingType[] = [
        'blocking',
        'decision',
        'review',
        'planning',
        'ambiguity',
      ];

      expect(meetingTypes).toContain('ambiguity');
    });

    it('should have 5 meeting types', () => {
      const meetingTypes: MeetingType[] = [
        'blocking',
        'decision',
        'review',
        'planning',
        'ambiguity',
      ];

      expect(meetingTypes).toHaveLength(5);
    });
  });

  describe('Meeting', () => {
    it('should create a valid Meeting with basic fields', () => {
      const meeting: Meeting = {
        id: 'MTG-001',
        type: 'blocking',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Test Meeting',
        description: 'Meeting for blocked task',
        impactScope: ['auth'],
        participants: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(meeting.id).toBe('MTG-001');
      expect(meeting.type).toBe('blocking');
      expect(meeting.status).toBe('pending');
      expect(meeting.taskId).toBe('TASK-001');
    });

    it('should support ambiguityReport field when type is ambiguity', () => {
      const meeting: Meeting = {
        id: 'MTG-001',
        type: 'ambiguity',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Ambiguity Resolution',
        description: 'Resolve requirement ambiguity',
        impactScope: ['auth'],
        participants: ['user'],
        createdAt: '2024-01-01T00:00:00Z',
        ambiguityReport: {
          id: 'RPT-001',
          taskId: 'TASK-001',
          detectionPhase: 'pre_execution',
          ambiguities: [
            {
              id: 'AMB-001',
              type: 'requirement',
              severity: 'critical',
              description: 'Unclear requirement',
              impactScope: ['auth'],
            },
          ],
          hasAmbiguity: true,
          maxSeverity: 'critical',
          detectedAt: '2024-01-01T00:00:00Z',
        },
        suggestedQuestions: [
          'What is the expected behavior?',
          'Should this be configurable?',
        ],
      };

      expect(meeting.type).toBe('ambiguity');
      expect(meeting.ambiguityReport).toBeDefined();
      expect(meeting.ambiguityReport?.ambiguities).toHaveLength(1);
      expect(meeting.suggestedQuestions).toHaveLength(2);
    });

    it('should have optional ambiguityReport and suggestedQuestions', () => {
      const meeting: Meeting = {
        id: 'MTG-001',
        type: 'blocking',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Test Meeting',
        description: 'Meeting for blocked task',
        impactScope: [],
        participants: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

      expect(meeting.ambiguityReport).toBeUndefined();
      expect(meeting.suggestedQuestions).toBeUndefined();
    });

    it('should support all MeetingStatus values', () => {
      const statuses: Array<Meeting['status']> = [
        'pending',
        'in_progress',
        'resolved',
        'cancelled',
      ];

      statuses.forEach((status, index) => {
        const meeting: Meeting = {
          id: `MTG-${index}`,
          type: 'ambiguity',
          status,
          taskId: 'TASK-001',
          title: 'Test',
          description: 'Test',
          impactScope: [],
          participants: [],
          createdAt: '2024-01-01T00:00:00Z',
        };
        expect(meeting.status).toBe(status);
      });
    });

    it('should support all MeetingType values', () => {
      const types: MeetingType[] = [
        'blocking',
        'decision',
        'review',
        'planning',
        'ambiguity',
      ];

      types.forEach((type, index) => {
        const meeting: Meeting = {
          id: `MTG-${index}`,
          type,
          status: 'pending',
          taskId: 'TASK-001',
          title: 'Test',
          description: 'Test',
          impactScope: [],
          participants: [],
          createdAt: '2024-01-01T00:00:00Z',
        };
        expect(meeting.type).toBe(type);
      });
    });
  });

  describe('Type Constraints', () => {
    it('should enforce AmbiguityType values at compile time', () => {
      // This test verifies the type system by creating valid instances
      const requirementType: AmbiguityType = 'requirement';
      const technicalType: AmbiguityType = 'technical';
      const dependencyType: AmbiguityType = 'dependency';
      const acceptanceType: AmbiguityType = 'acceptance';
      const testResultType: AmbiguityType = 'test_result';

      const types = [requirementType, technicalType, dependencyType, acceptanceType, testResultType];
      expect(types).toHaveLength(5);
    });

    it('should enforce AmbiguitySeverity values at compile time', () => {
      // This test verifies the type system by creating valid instances
      const critical: AmbiguitySeverity = 'critical';
      const high: AmbiguitySeverity = 'high';
      const medium: AmbiguitySeverity = 'medium';
      const low: AmbiguitySeverity = 'low';

      const severities = [critical, high, medium, low];
      expect(severities).toHaveLength(4);
    });

    it('should have valid QUALITY_PRESETS', () => {
      expect(QUALITY_PRESETS.fast).toBeDefined();
      expect(QUALITY_PRESETS.balanced).toBeDefined();
      expect(QUALITY_PRESETS.strict).toBeDefined();

      expect(QUALITY_PRESETS.fast.level).toBe('fast');
      expect(QUALITY_PRESETS.balanced.level).toBe('balanced');
      expect(QUALITY_PRESETS.strict.level).toBe('strict');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ambiguities array', () => {
      const report: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      expect(report.ambiguities).toEqual([]);
      expect(report.hasAmbiguity).toBe(false);
    });

    it('should handle empty impactScope', () => {
      const item: AmbiguityItem = {
        id: 'AMB-001',
        type: 'requirement',
        severity: 'low',
        description: 'Minor ambiguity',
        impactScope: [],
      };

      expect(item.impactScope).toEqual([]);
    });

    it('should handle empty suggestedQuestions', () => {
      const meeting: Meeting = {
        id: 'MTG-001',
        type: 'ambiguity',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Test',
        impactScope: [],
        participants: [],
        createdAt: '2024-01-01T00:00:00Z',
        suggestedQuestions: [],
      };

      expect(meeting.suggestedQuestions).toEqual([]);
    });

    it('should handle all optional fields being undefined', () => {
      const minimalItem: AmbiguityItem = {
        id: 'AMB-001',
        type: 'technical',
        severity: 'medium',
        description: 'Minimal item',
        impactScope: [],
      };

      const minimalReport: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [],
        hasAmbiguity: false,
        detectedAt: '2024-01-01T00:00:00Z',
      };

      const minimalMeeting: Meeting = {
        id: 'MTG-001',
        type: 'ambiguity',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Test',
        description: 'Test',
        impactScope: [],
        participants: [],
        createdAt: '2024-01-01T00:00:00Z',
      };

      // All optional fields should be undefined
      expect(minimalItem.possibleSolutions).toBeUndefined();
      expect(minimalItem.relatedFiles).toBeUndefined();
      expect(minimalItem.relatedTaskIds).toBeUndefined();

      expect(minimalReport.maxSeverity).toBeUndefined();
      expect(minimalReport.suggestedStrategy).toBeUndefined();
      expect(minimalReport.suggestedQuestions).toBeUndefined();

      expect(minimalMeeting.ambiguityReport).toBeUndefined();
      expect(minimalMeeting.suggestedQuestions).toBeUndefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should create a complete ambiguity workflow', () => {
      // Simulate the full workflow from detection to meeting
      const ambiguityItem: AmbiguityItem = {
        id: 'AMB-001',
        type: 'requirement',
        severity: 'critical',
        description: 'User authentication flow is not clearly defined',
        impactScope: ['auth', 'user-management', 'api'],
        possibleSolutions: [
          'Implement OAuth2',
          'Use JWT tokens',
          'Keep current session-based auth',
        ],
        relatedFiles: ['src/auth/login.ts', 'src/auth/middleware.ts'],
        relatedTaskIds: ['TASK-001', 'TASK-005'],
      };

      const report: AmbiguityReport = {
        id: 'RPT-001',
        taskId: 'TASK-001',
        detectionPhase: 'pre_execution',
        ambiguities: [ambiguityItem],
        hasAmbiguity: true,
        maxSeverity: 'critical',
        detectedAt: '2024-01-01T10:00:00Z',
        suggestedStrategy: 'write_meeting',
        suggestedQuestions: [
          'Which authentication method should be used?',
          'Should we support multi-factor authentication?',
          'What is the session timeout policy?',
        ],
      };

      const meeting: Meeting = {
        id: 'MTG-001',
        type: 'ambiguity',
        status: 'pending',
        taskId: 'TASK-001',
        title: 'Resolve Authentication Requirements',
        description: 'Need to clarify authentication requirements before proceeding',
        impactScope: report.ambiguities[0].impactScope,
        participants: ['user', 'architect'],
        createdAt: '2024-01-01T10:05:00Z',
        ambiguityReport: report,
        suggestedQuestions: report.suggestedQuestions,
      };

      // Verify the workflow data integrity
      expect(meeting.ambiguityReport).toEqual(report);
      expect(meeting.ambiguityReport?.ambiguities[0]).toEqual(ambiguityItem);
      expect(meeting.suggestedQuestions).toHaveLength(3);
    });

    it('should handle multiple ambiguities with different severities', () => {
      const report: AmbiguityReport = {
        id: 'RPT-MULTI',
        taskId: 'TASK-001',
        detectionPhase: 'during_execution',
        ambiguities: [
          {
            id: 'AMB-001',
            type: 'requirement',
            severity: 'critical',
            description: 'Critical requirement ambiguity',
            impactScope: ['core'],
          },
          {
            id: 'AMB-002',
            type: 'technical',
            severity: 'high',
            description: 'High priority technical ambiguity',
            impactScope: ['api'],
          },
          {
            id: 'AMB-003',
            type: 'dependency',
            severity: 'medium',
            description: 'Medium priority dependency ambiguity',
            impactScope: ['deps'],
          },
          {
            id: 'AMB-004',
            type: 'acceptance',
            severity: 'low',
            description: 'Low priority acceptance ambiguity',
            impactScope: ['test'],
          },
        ],
        hasAmbiguity: true,
        maxSeverity: 'critical',
        detectedAt: '2024-01-01T00:00:00Z',
        suggestedStrategy: 'ask_immediate',
      };

      expect(report.ambiguities).toHaveLength(4);
      expect(report.maxSeverity).toBe('critical');

      // Verify severities are present
      const severities = report.ambiguities.map((a) => a.severity);
      expect(severities).toContain('critical');
      expect(severities).toContain('high');
      expect(severities).toContain('medium');
      expect(severities).toContain('low');

      // Verify types are present
      const types = report.ambiguities.map((a) => a.type);
      expect(types).toContain('requirement');
      expect(types).toContain('technical');
      expect(types).toContain('dependency');
      expect(types).toContain('acceptance');
    });
  });
});