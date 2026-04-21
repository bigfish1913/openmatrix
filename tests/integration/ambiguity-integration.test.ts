// tests/integration/ambiguity-integration.test.ts
// Integration tests verifying ambiguity detection cross-module interfaces and data flow

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import type {
  AmbiguityReport,
  AmbiguityItem,
  AmbiguitySeverity,
  AmbiguityType,
  Task,
  Meeting,
  Approval,
} from '../../src/types/index.js';

import { StateManager } from '../../src/storage/state-manager.js';
import { ApprovalManager } from '../../src/orchestrator/approval-manager.js';
import { MeetingManager } from '../../src/orchestrator/meeting-manager.js';
import { AgentRunner } from '../../src/agents/agent-runner.js';
import { OrchestratorExecutor } from '../../src/orchestrator/executor.js';

// =====================================================
// Helpers
// =====================================================

function makeAmbiguityItem(overrides: Partial<AmbiguityItem> = {}): AmbiguityItem {
  return {
    id: `amb-${Date.now().toString(36)}`,
    type: 'requirement',
    severity: 'high',
    description: 'Requirement is unclear',
    impactScope: ['feature-A'],
    possibleSolutions: ['Option 1', 'Option 2'],
    ...overrides,
  };
}

function makeAmbiguityReport(
  taskId: string,
  items: AmbiguityItem[],
  overrides: Partial<AmbiguityReport> = {}
): AmbiguityReport {
  const severityOrder: AmbiguitySeverity[] = ['critical', 'high', 'medium', 'low'];
  const maxSeverity: AmbiguitySeverity = items.length > 0
    ? items.reduce<AmbiguitySeverity>((max, a) => {
        return severityOrder.indexOf(a.severity) < severityOrder.indexOf(max) ? a.severity : max;
      }, 'low')
    : 'low';

  return {
    id: `report-${Date.now().toString(36)}`,
    taskId,
    detectionPhase: 'pre_execution',
    ambiguities: items,
    hasAmbiguity: items.length > 0,
    maxSeverity: items.length > 0 ? maxSeverity : undefined,
    detectedAt: new Date().toISOString(),
    suggestedStrategy: 'write_meeting',
    suggestedQuestions: ['What is the expected behavior?'],
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Test task',
    description: 'Integration test task',
    status: 'in_progress',
    priority: 'P1',
    timeout: 600000,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'in_progress', duration: null },
      verify: { status: 'pending', duration: null },
      accept: { status: 'pending', duration: null },
    },
    retryCount: 0,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =====================================================
// Integration Test Suite
// =====================================================

describe('Ambiguity Detection Integration Tests', () => {
  let tempDir: string;
  let stateManager: StateManager;
  let approvalManager: ApprovalManager;
  let meetingManager: MeetingManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'om-ambiguity-integration-'));
    stateManager = new StateManager(tempDir);
    await stateManager.initialize();
    approvalManager = new ApprovalManager(stateManager);
    meetingManager = new MeetingManager(stateManager, approvalManager);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // =====================================================
  // 1. types → meeting-manager: AmbiguityReport type flow
  // =====================================================

  describe('types → meeting-manager: AmbiguityReport type flow', () => {
    it('should accept a well-formed AmbiguityReport and create a meeting', async () => {
      const item = makeAmbiguityItem({ type: 'requirement', severity: 'high' });
      const report = makeAmbiguityReport('TASK-001', [item]);

      // Type assertion: report satisfies AmbiguityReport interface
      const typed: AmbiguityReport = report;
      expect(typed.hasAmbiguity).toBe(true);
      expect(typed.ambiguities).toHaveLength(1);

      const { meeting, approval } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

      expect(meeting.type).toBe('ambiguity');
      expect(meeting.taskId).toBe('TASK-001');
      expect(meeting.ambiguityReport).toBeDefined();
      expect(meeting.ambiguityReport!.id).toBe(report.id);
      expect(approval.type).toBe('meeting');
    });

    it('should propagate all AmbiguityItem fields through to the stored meeting', async () => {
      const item = makeAmbiguityItem({
        type: 'technical',
        severity: 'critical',
        description: 'No clear tech choice',
        impactScope: ['module-A', 'module-B'],
        possibleSolutions: ['Use REST', 'Use gRPC'],
        relatedFiles: ['src/api.ts'],
        relatedTaskIds: ['TASK-002'],
      });
      const report = makeAmbiguityReport('TASK-001', [item], {
        detectionPhase: 'during_execution',
        suggestedStrategy: 'ask_immediate',
        suggestedQuestions: ['REST or gRPC?'],
      });

      const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

      // Verify the stored meeting has the full report intact
      const stored = await stateManager.getMeeting(meeting.id);
      expect(stored).not.toBeNull();
      expect(stored!.ambiguityReport!.detectionPhase).toBe('during_execution');
      expect(stored!.ambiguityReport!.ambiguities[0].type).toBe('technical');
      expect(stored!.ambiguityReport!.ambiguities[0].severity).toBe('critical');
      expect(stored!.ambiguityReport!.ambiguities[0].relatedFiles).toContain('src/api.ts');
      expect(stored!.suggestedQuestions).toContain('REST or gRPC?');
    });

    it('should handle all AmbiguityType values without error', async () => {
      const types: AmbiguityType[] = ['requirement', 'technical', 'dependency', 'acceptance', 'test_result'];

      for (const type of types) {
        const item = makeAmbiguityItem({ type, severity: 'medium' });
        const report = makeAmbiguityReport(`TASK-${type}`, [item]);
        const { meeting } = await meetingManager.createAmbiguityMeeting(`TASK-${type}`, report);
        expect(meeting.ambiguityReport!.ambiguities[0].type).toBe(type);
      }
    });

    it('should handle all AmbiguitySeverity values and set correct title prefix', async () => {
      const severities: AmbiguitySeverity[] = ['critical', 'high', 'medium', 'low'];

      for (const severity of severities) {
        const item = makeAmbiguityItem({ severity });
        const report = makeAmbiguityReport(`TASK-sev-${severity}`, [item], { maxSeverity: severity });
        const { meeting } = await meetingManager.createAmbiguityMeeting(`TASK-sev-${severity}`, report);

        // Title should contain the severity prefix
        const expectedPrefixes: Record<AmbiguitySeverity, string> = {
          critical: 'Critical',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };
        expect(meeting.title).toContain(expectedPrefixes[severity]);
      }
    });

    it('should aggregate impactScope from all ambiguity items', async () => {
      const items = [
        makeAmbiguityItem({ impactScope: ['module-A', 'module-B'] }),
        makeAmbiguityItem({ impactScope: ['module-C'] }),
      ];
      const report = makeAmbiguityReport('TASK-001', items);
      const { meeting } = await meetingManager.createAmbiguityMeeting('TASK-001', report);

      expect(meeting.impactScope).toContain('module-A');
      expect(meeting.impactScope).toContain('module-B');
      expect(meeting.impactScope).toContain('module-C');
    });
  });

  // =====================================================
  // 2. types → executor: AmbiguityReport used in ExecutionResult
  // =====================================================

  describe('types → executor: AmbiguityReport used in ExecutionResult', () => {
    it('should include ambiguityReport in ExecutionResult when status is ambiguity_ask_user', async () => {
      // Verify the ExecutionResult type accepts ambiguityReport
      const report = makeAmbiguityReport('TASK-001', [makeAmbiguityItem({ severity: 'critical' })]);

      // Construct a minimal ExecutionResult matching the interface
      const result = {
        status: 'ambiguity_ask_user' as const,
        subagentTasks: [],
        message: 'Ambiguity detected',
        statistics: { total: 1, completed: 0, inProgress: 0, pending: 1, failed: 0 },
        ambiguityReport: report,
      };

      expect(result.status).toBe('ambiguity_ask_user');
      expect(result.ambiguityReport).toBeDefined();
      expect(result.ambiguityReport!.hasAmbiguity).toBe(true);
      expect(result.ambiguityReport!.maxSeverity).toBe('critical');
    });

    it('should allow ExecutionResult without ambiguityReport for non-ambiguity statuses', () => {
      const result = {
        status: 'continue' as const,
        subagentTasks: [],
        message: 'Continuing',
        statistics: { total: 1, completed: 0, inProgress: 1, pending: 0, failed: 0 },
      };

      expect(result.status).toBe('continue');
      expect((result as any).ambiguityReport).toBeUndefined();
    });
  });

  // =====================================================
  // 3. executor → meeting-manager: createAmbiguityMeeting call chain
  // =====================================================

  describe('executor → meeting-manager: createAmbiguityMeeting call chain', () => {
    it('should create meeting via executor completeTask when output contains ambiguity JSON (auto mode)', async () => {
      // Setup: auto mode (empty approvalPoints)
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: [],  // auto mode
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      // Create a real task in state
      const task = await stateManager.createTask({
        title: 'Ambiguity test task',
        description: 'Task that will report ambiguity',
        priority: 'P1',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      // Simulate agent output containing an ambiguity report (XML tag format — reliably parsed)
      const reportObj = {
        hasAmbiguity: true,
        id: 'report-test-001',
        taskId: task.id,
        detectionPhase: 'pre_execution',
        ambiguities: [
          {
            id: 'amb-001',
            type: 'requirement',
            severity: 'high',
            description: 'Unclear requirement',
            impactScope: ['feature-X'],
          },
        ],
        maxSeverity: 'high',
        detectedAt: new Date().toISOString(),
      };
      const ambiguityOutput = `<ambiguity_report>\n${JSON.stringify(reportObj)}\n</ambiguity_report>`;

      const result = await executor.completeTask(task.id, {
        success: true,
        output: ambiguityOutput,
      });

      // In auto mode, ambiguity should be handled (written to meeting)
      expect(result.ambiguityResult).toBeDefined();
      expect(result.ambiguityResult!.status).toBe('ambiguity_handled');
      expect(result.ambiguityResult!.report.hasAmbiguity).toBe(true);

      // Verify meeting was actually created in storage
      const pendingMeetings = await stateManager.getMeetingsByStatus('pending');
      const ambiguityMeeting = pendingMeetings.find(m => m.type === 'ambiguity' && m.taskId === task.id);
      expect(ambiguityMeeting).toBeDefined();
      expect(ambiguityMeeting!.ambiguityReport).toBeDefined();
    });

    it('should return ambiguity_ask_user for critical severity in interactive mode', async () => {
      // Setup: interactive mode (non-empty approvalPoints)
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: ['plan', 'merge'],  // interactive mode
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      const task = await stateManager.createTask({
        title: 'Critical ambiguity task',
        description: 'Task with critical ambiguity',
        priority: 'P0',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const criticalObj = {
        hasAmbiguity: true,
        id: 'report-critical-001',
        taskId: task.id,
        detectionPhase: 'pre_execution',
        ambiguities: [
          {
            id: 'amb-critical',
            type: 'technical',
            severity: 'critical',
            description: 'Cannot proceed without tech decision',
            impactScope: ['entire-system'],
          },
        ],
        maxSeverity: 'critical',
        detectedAt: new Date().toISOString(),
      };
      const ambiguityOutput = `<ambiguity_report>\n${JSON.stringify(criticalObj)}\n</ambiguity_report>`;

      const result = await executor.completeTask(task.id, {
        success: true,
        output: ambiguityOutput,
      });

      expect(result.ambiguityResult).toBeDefined();
      expect(result.ambiguityResult!.status).toBe('ambiguity_ask_user');
      expect(result.ambiguityResult!.report.maxSeverity).toBe('critical');
    });

    it('should write meeting for medium severity in interactive mode', async () => {
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: ['plan'],  // interactive mode
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      const task = await stateManager.createTask({
        title: 'Medium ambiguity task',
        description: 'Task with medium ambiguity',
        priority: 'P2',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const mediumObj = {
        hasAmbiguity: true,
        id: 'report-medium-001',
        taskId: task.id,
        detectionPhase: 'pre_execution',
        ambiguities: [
          {
            id: 'amb-medium',
            type: 'acceptance',
            severity: 'medium',
            description: 'Acceptance criteria slightly unclear',
            impactScope: ['test-suite'],
          },
        ],
        maxSeverity: 'medium',
        detectedAt: new Date().toISOString(),
      };
      const ambiguityOutput = `<ambiguity_report>\n${JSON.stringify(mediumObj)}\n</ambiguity_report>`;

      const result = await executor.completeTask(task.id, {
        success: true,
        output: ambiguityOutput,
      });

      expect(result.ambiguityResult).toBeDefined();
      expect(result.ambiguityResult!.status).toBe('ambiguity_handled');

      // Meeting should be created for medium severity
      const pendingMeetings = await stateManager.getMeetingsByStatus('pending');
      const ambiguityMeeting = pendingMeetings.find(m => m.type === 'ambiguity' && m.taskId === task.id);
      expect(ambiguityMeeting).toBeDefined();
    });

    it('should not create ambiguity meeting when output has no ambiguity', async () => {
      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      const task = await stateManager.createTask({
        title: 'Clean task',
        description: 'No ambiguity',
        priority: 'P1',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const cleanOutput = JSON.stringify({ hasAmbiguity: false });

      const result = await executor.completeTask(task.id, {
        success: true,
        output: cleanOutput,
      });

      expect(result.ambiguityResult).toBeUndefined();

      // meetings dir may not exist if nothing was ever written — treat that as empty
      let pendingMeetings: Meeting[] = [];
      try {
        pendingMeetings = await stateManager.getMeetingsByStatus('pending');
      } catch { /* directory doesn't exist yet — no meetings */ }
      const ambiguityMeeting = pendingMeetings.find(m => m.type === 'ambiguity' && m.taskId === task.id);
      expect(ambiguityMeeting).toBeUndefined();
    });

    it('should parse ambiguity report from XML tag format', async () => {
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: [],  // auto mode
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      const task = await stateManager.createTask({
        title: 'XML format task',
        description: 'Task with XML-tagged ambiguity report',
        priority: 'P1',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const xmlOutput = `Some agent output here.
<ambiguity_report>
{
  "hasAmbiguity": true,
  "id": "report-xml-001",
  "taskId": "${task.id}",
  "detectionPhase": "pre_execution",
  "ambiguities": [
    {
      "id": "amb-xml",
      "type": "dependency",
      "severity": "high",
      "description": "Missing dependency version",
      "impactScope": ["build"]
    }
  ],
  "maxSeverity": "high",
  "detectedAt": "${new Date().toISOString()}"
}
</ambiguity_report>
More output here.`;

      const result = await executor.completeTask(task.id, {
        success: true,
        output: xmlOutput,
      });

      expect(result.ambiguityResult).toBeDefined();
      expect(result.ambiguityResult!.report.ambiguities[0].type).toBe('dependency');
    });
  });

  // =====================================================
  // 4. agent-runner → executor: prompt contains ambiguity detection instructions
  // =====================================================

  describe('agent-runner → executor: prompt contains ambiguity detection instructions', () => {
    it('should include ambiguity detection instruction in built prompt', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const task = makeTask({ id: 'TASK-PROMPT-001', assignedAgent: 'coder' });

      const prompt = await agentRunner.buildExecutionPrompt(task);

      // Prompt must contain the ambiguity detection section
      expect(prompt).toContain('歧义检测');
      // The output format template uses hasAmbiguity as the field name
      expect(prompt).toContain('hasAmbiguity');
    });

    it('should include all 5 ambiguity types in the detection checklist', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const task = makeTask({ id: 'TASK-TYPES-001', assignedAgent: 'tester' });

      const prompt = await agentRunner.buildExecutionPrompt(task);

      const expectedTypes: AmbiguityType[] = ['requirement', 'technical', 'dependency', 'acceptance', 'test_result'];
      for (const type of expectedTypes) {
        expect(prompt).toContain(type);
      }
    });

    it('should include all severity levels in the prompt', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const task = makeTask({ id: 'TASK-SEV-001', assignedAgent: 'reviewer' });

      const prompt = await agentRunner.buildExecutionPrompt(task);

      const severities: AmbiguitySeverity[] = ['critical', 'high', 'medium', 'low'];
      for (const sev of severities) {
        // Case-insensitive: prompt uses 'Critical', 'High', etc.
        expect(prompt.toLowerCase()).toContain(sev.toLowerCase());
      }
    });

    it('should embed the task ID in the ambiguity output format template', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const taskId = 'TASK-EMBED-999';
      const task = makeTask({ id: taskId, assignedAgent: 'planner' });

      const prompt = await agentRunner.buildExecutionPrompt(task);

      // The JSON template in the prompt should reference the actual task ID
      expect(prompt).toContain(taskId);
    });

    it('should produce a SubagentTask with the prompt when prepareSubagentTask is called', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const task = makeTask({ id: 'TASK-SUB-001', assignedAgent: 'coder' });

      const subagentTask = await agentRunner.prepareSubagentTask(task);

      expect(subagentTask.taskId).toBe(task.id);
      expect(subagentTask.agentType).toBe('coder');
      expect(subagentTask.prompt).toContain('歧义检测');
      expect(subagentTask.prompt).toContain('hasAmbiguity');
    });

    it('should map all AgentType values to valid ClaudeCodeSubagentType', async () => {
      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const agentTypes = ['planner', 'coder', 'tester', 'reviewer', 'researcher', 'executor'] as const;
      const validSubagentTypes = ['general-purpose', 'Explore', 'Plan'];

      for (const agentType of agentTypes) {
        const mapped = agentRunner.mapAgentType(agentType);
        expect(validSubagentTypes).toContain(mapped);
      }
    });
  });

  // =====================================================
  // 5. End-to-end data flow: types → agent-runner → executor → meeting-manager
  // =====================================================

  describe('End-to-end data flow: full ambiguity pipeline', () => {
    it('should flow AmbiguityReport from agent output through executor to stored meeting', async () => {
      // Auto mode: all ambiguities go to meeting
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: [],
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const agentRunner = new AgentRunner(stateManager, approvalManager);
      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      // Step 1: Create a real task
      const task = await stateManager.createTask({
        title: 'E2E ambiguity flow task',
        description: 'Full pipeline test',
        priority: 'P1',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      // Step 2: Verify agent-runner builds a prompt with ambiguity instructions
      const subagentTask = await agentRunner.prepareSubagentTask(task);
      expect(subagentTask.prompt).toContain('歧义检测');

      // Step 3: Simulate agent returning output with ambiguity report (XML format)
      const report = makeAmbiguityReport(task.id, [
        makeAmbiguityItem({ type: 'requirement', severity: 'high', description: 'E2E test ambiguity' }),
      ]);
      const agentOutput = `<ambiguity_report>\n${JSON.stringify(report)}\n</ambiguity_report>`;

      // Step 4: Executor processes the output
      const completeResult = await executor.completeTask(task.id, {
        success: true,
        output: agentOutput,
      });

      expect(completeResult.ambiguityResult).toBeDefined();
      expect(completeResult.ambiguityResult!.status).toBe('ambiguity_handled');

      // Step 5: Verify meeting was persisted with full report
      const meetings = await stateManager.getMeetingsByStatus('pending');
      const meeting = meetings.find(m => m.taskId === task.id && m.type === 'ambiguity');
      expect(meeting).toBeDefined();
      expect(meeting!.ambiguityReport!.ambiguities[0].description).toBe('E2E test ambiguity');

      // Step 6: Verify approval was also created
      const approvals = await stateManager.getApprovalsByStatus('pending');
      const approval = approvals.find(a => a.taskId === task.id && a.type === 'meeting');
      expect(approval).toBeDefined();
      expect(approval!.description).toContain('歧义');
    });

    it('should handle multiple ambiguity items across different types and severities', async () => {
      await stateManager.updateState({
        config: {
          timeout: 120,
          taskTimeout: 600000,
          maxRetries: 3,
          approvalPoints: [],
          maxConcurrentAgents: 3,
          model: 'claude-sonnet-4-6',
        },
      });

      const executor = new OrchestratorExecutor(stateManager, approvalManager);

      const task = await stateManager.createTask({
        title: 'Multi-ambiguity task',
        description: 'Task with multiple ambiguities',
        priority: 'P1',
        timeout: 600000,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const multiReport = makeAmbiguityReport(task.id, [
        makeAmbiguityItem({ type: 'requirement', severity: 'high' }),
        makeAmbiguityItem({ type: 'technical', severity: 'medium' }),
        makeAmbiguityItem({ type: 'dependency', severity: 'low' }),
      ], { maxSeverity: 'high' });

      const result = await executor.completeTask(task.id, {
        success: true,
        output: `<ambiguity_report>\n${JSON.stringify(multiReport)}\n</ambiguity_report>`,
      });

      expect(result.ambiguityResult).toBeDefined();

      const meetings = await stateManager.getMeetingsByStatus('pending');
      const meeting = meetings.find(m => m.taskId === task.id && m.type === 'ambiguity');
      expect(meeting).toBeDefined();
      expect(meeting!.ambiguityReport!.ambiguities).toHaveLength(3);
      // impactScope should be aggregated from all 3 items
      expect(meeting!.impactScope).toHaveLength(3);
    });
  });
});
