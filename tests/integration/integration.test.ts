// tests/integration/integration.test.ts
// TASK-011: Integration tests verifying cross-module collaboration

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Logger module
import {
  createLogger,
  setLogger,
  getLogger,
  logger,
  persistLog,
  initLoggerWithRunId,
  type StructuredLog,
  type LoggerOptions
} from '../../src/utils/logger.js';

// Type system
import type {
  Task,
  TaskStatus,
  TaskPriority,
  AgentType,
  QualityConfig,
  QualityReport,
  GlobalState,
  AppConfig,
  SubagentTask,
  RunStatus,
  Approval,
  Meeting,
  TaskPhase,
} from '../../src/types/index.js';
import { QUALITY_PRESETS } from '../../src/types/index.js';

// State machine
import { StateMachine, type TransitionEvent } from '../../src/orchestrator/state-machine.js';

// Storage
import { FileStore } from '../../src/storage/file-store.js';
import { StateManager } from '../../src/storage/state-manager.js';

// Scheduler
import { Scheduler, type SchedulerConfig } from '../../src/orchestrator/scheduler.js';

// Upgrade detector
import {
  UpgradeDetector,
  type DetectionResult,
  type UpgradeCategory,
  type UpgradePriority,
  type ProjectType,
  DEFAULT_DETECTOR_CONFIG
} from '../../src/orchestrator/upgrade-detector.js';

// Check command display helpers
import {
  displayProjectInfo,
  displaySummary,
  getCategoryLabels,
  displaySuggestionsByPriority,
  displayHints,
} from '../../src/cli/commands/check.js';

// =====================================================
// Helpers
// =====================================================

let tempDir: string;

function createTestTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'TASK-001',
    title: 'Test task',
    description: 'A test task for integration testing',
    status: 'pending',
    priority: 'P1',
    timeout: 600,
    dependencies: [],
    assignedAgent: 'coder',
    phases: {
      develop: { status: 'pending', duration: null },
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

function createTestGlobalState(overrides: Partial<GlobalState> = {}): GlobalState {
  return {
    version: '0.2.6',
    runId: 'test-run-001',
    status: 'running',
    currentPhase: 'execution',
    startedAt: new Date().toISOString(),
    config: {
      timeout: 120,
      taskTimeout: 600000,
      maxRetries: 3,
      approvalPoints: ['plan', 'merge'],
      maxConcurrentAgents: 3,
      model: 'claude-sonnet-4-6',
    },
    statistics: {
      totalTasks: 1,
      completed: 0,
      inProgress: 0,
      failed: 0,
      pending: 1,
      scheduled: 0,
      blocked: 0,
      waiting: 0,
      verify: 0,
      accept: 0,
      retry_queue: 0,
    },
    ...overrides,
  };
}

/**
 * Helper: create a StateManager with initialized state, ready for task operations.
 */
async function createInitializedStateManager(basePath: string): Promise<StateManager> {
  const sm = new StateManager(basePath);
  await sm.initialize();
  return sm;
}

/**
 * Helper: directly write a task file to the store (for tests that need specific task states).
 */
async function writeTaskDirectly(basePath: string, task: Task): Promise<void> {
  const store = new FileStore(basePath);
  await store.ensureDir(`tasks/${task.id}`);
  await store.writeJson(`tasks/${task.id}/task.json`, task);
}

// =====================================================
// Integration Test Suite
// =====================================================

describe('Integration Tests', () => {

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'om-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =====================================================
  // 1. Logger + Type Safety Integration
  // =====================================================

  describe('Logger + Type Safety Integration', () => {
    it('should create StructuredLog that conforms to type constraints across modules', () => {
      const task = createTestTask();
      const state = createTestGlobalState();

      // Logger integrates with Task and GlobalState types
      const log: StructuredLog = {
        level: 'info',
        runId: state.runId,
        taskId: task.id,
        operation: 'taskTransition',
        message: `Task ${task.id} transitioned from ${task.status} to in_progress`,
        metadata: {
          fromStatus: task.status,
          toStatus: 'in_progress' as TaskStatus,
          priority: task.priority,
          agentType: task.assignedAgent,
        },
        timestamp: new Date().toISOString(),
      };

      expect(log.runId).toBe(state.runId);
      expect(log.taskId).toBe(task.id);
      expect(log.metadata).toBeDefined();
    });

    it('should persist and read back logs that reference typed entities', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-log-types-'));
      try {
        const task = createTestTask({ id: 'TASK-LOG-001', status: 'in_progress' });

        const log: StructuredLog = {
          level: 'info',
          runId: 'run-log-test',
          taskId: task.id,
          operation: 'taskStart',
          message: 'Task started execution',
          metadata: { status: task.status, priority: task.priority },
          timestamp: new Date().toISOString(),
        };

        persistLog(log, omPath);

        const logFile = path.join(omPath, 'logs', 'run-log-test.log');
        const content = await fs.readFile(logFile, 'utf-8');
        const parsed = JSON.parse(content.trim());

        expect(parsed.taskId).toBe('TASK-LOG-001');
        expect(parsed.metadata.status).toBe('in_progress');
        expect(parsed.metadata.priority).toBe('P1');
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should initialize logger with runId from GlobalState and log typed events', async () => {
      const state = createTestGlobalState();
      const logDir = path.join(tempDir, 'logs');

      const testLogger = createLogger({
        level: 'debug',
        logDir,
        console: false,
        runId: state.runId,
      });

      setLogger(testLogger);

      // Verify logger is configured with GlobalState runId
      const currentLogger = getLogger();
      expect(currentLogger.defaultMeta).toHaveProperty('runId', state.runId);
      expect(currentLogger.defaultMeta).toHaveProperty('service', 'openmatrix');

      // Log typed events
      expect(() => {
        logger.info(`Run started: ${state.runId}`, { phase: state.currentPhase });
        logger.task.start('TASK-001', 'Integration test task');
        logger.agent.call('coder', 'TASK-001');
      }).not.toThrow();
    });

    it('should use logger with all TaskStatus transitions', () => {
      setLogger(createLogger({ logDir: tempDir, console: false }));

      const statuses: TaskStatus[] = [
        'pending', 'scheduled', 'in_progress', 'verify', 'accept', 'completed',
        'blocked', 'waiting', 'failed', 'retry_queue'
      ];

      for (const status of statuses) {
        expect(() => {
          logger.info(`Status: ${status}`, { status });
        }).not.toThrow();
      }
    });

    it('should use logger with all QualityConfig levels', () => {
      setLogger(createLogger({ logDir: tempDir, console: false }));

      for (const [level, config] of Object.entries(QUALITY_PRESETS)) {
        expect(() => {
          logger.info(`Quality level: ${level}`, {
            tdd: config.tdd,
            minCoverage: config.minCoverage,
            strictLint: config.strictLint,
            securityScan: config.securityScan,
          });
        }).not.toThrow();
      }
    });
  });

  // =====================================================
  // 2. State Machine + Storage + Type Safety Integration
  // =====================================================

  describe('State Machine + Storage + Type Safety Integration', () => {
    it('should persist task with valid types through FileStore', async () => {
      const store = new FileStore(tempDir);
      const task = createTestTask();

      await store.ensureDir('tasks');
      await store.writeJson(`tasks/${task.id}.json`, task);

      const loaded = await store.readJson<Task>(`tasks/${task.id}.json`);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(task.id);
      expect(loaded!.status).toBe(task.status);
      expect(loaded!.priority).toBe(task.priority);
      expect(loaded!.assignedAgent).toBe(task.assignedAgent);
    });

    it('should transition task through full lifecycle and persist each state', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      // Use createTask API
      const task = await stateManager.createTask({
        title: 'Lifecycle test task',
        description: 'Testing full lifecycle',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const stateMachine = new StateMachine();

      // pending -> scheduled
      let result = stateMachine.transition(task, 'schedule');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('scheduled');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // scheduled -> in_progress
      result = stateMachine.transition({ ...task, status: 'scheduled' }, 'start');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('in_progress');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // in_progress -> verify
      result = stateMachine.transition({ ...task, status: 'in_progress' }, 'develop_done');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('verify');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // verify -> accept
      result = stateMachine.transition({ ...task, status: 'verify' }, 'verify_done');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('accept');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // accept -> completed
      result = stateMachine.transition({ ...task, status: 'accept' }, 'accept_done');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('completed');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // Verify final state persisted
      const finalTask = await stateManager.getTask(task.id);
      expect(finalTask).not.toBeNull();
      expect(finalTask!.status).toBe('completed');
    });

    it('should handle blocked/waiting lifecycle with type safety', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      const task = await stateManager.createTask({
        title: 'Blocked task test',
        description: 'Testing blocked lifecycle',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const stateMachine = new StateMachine();

      // pending -> in_progress (skip scheduled)
      let result = stateMachine.transition(task, 'start');
      expect(result.success).toBe(true);
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // in_progress -> blocked
      result = stateMachine.transition({ ...task, status: 'in_progress' }, 'block');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('blocked');
      await stateManager.updateTask(task.id, { status: result.toStatus, error: 'Dependency issue' });

      // blocked -> waiting
      result = stateMachine.transition({ ...task, status: 'blocked' }, 'wait');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('waiting');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // waiting -> in_progress (meeting resolved)
      result = stateMachine.transition({ ...task, status: 'waiting' }, 'resume');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('in_progress');
      await stateManager.updateTask(task.id, { status: result.toStatus, error: null });

      const loaded = await stateManager.getTask(task.id);
      expect(loaded!.status).toBe('in_progress');
      expect(loaded!.error).toBeNull();
    });

    it('should handle failure and retry lifecycle', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      const task = await stateManager.createTask({
        title: 'Retry task test',
        description: 'Testing failure and retry',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const stateMachine = new StateMachine();

      // pending -> in_progress
      let result = stateMachine.transition(task, 'start');
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // in_progress -> failed
      result = stateMachine.transition({ ...task, status: 'in_progress' }, 'fail');
      expect(result.success).toBe(true);
      await stateManager.updateTask(task.id, {
        status: result.toStatus,
        error: 'Test failure',
        retryCount: 1,
      });

      // failed -> retry_queue
      const failedTask = { ...task, status: 'failed' as TaskStatus, retryCount: 1 };
      result = stateMachine.transition(failedTask, 'retry');
      expect(result.success).toBe(true);
      await stateManager.updateTask(task.id, { status: result.toStatus });

      // retry_queue -> pending (retryCount < 100)
      const retryTask = { ...task, status: 'retry_queue' as TaskStatus, retryCount: 1 };
      result = stateMachine.transition(retryTask, 'retry');
      expect(result.success).toBe(true);
      await stateManager.updateTask(task.id, { status: result.toStatus });

      const loaded = await stateManager.getTask(task.id);
      expect(loaded!.status).toBe('pending');
      expect(loaded!.retryCount).toBe(1);
    });

    it('should reject invalid state transitions', () => {
      const task = createTestTask({ status: 'completed' });
      const stateMachine = new StateMachine();

      // completed state has no valid outgoing transitions
      const result = stateMachine.transition(task, 'start');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // =====================================================
  // 3. Scheduler + State Machine + Storage Integration
  // =====================================================

  describe('Scheduler + State Machine + Storage Integration', () => {
    it('should schedule tasks respecting dependencies and concurrency', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      // Create tasks with dependencies using createTask API
      const taskA = await stateManager.createTask({
        title: 'Task A',
        description: 'First task',
        priority: 'P0',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const taskB = await stateManager.createTask({
        title: 'Task B',
        description: 'Depends on A',
        priority: 'P1',
        timeout: 600,
        dependencies: [taskA.id],
        assignedAgent: 'coder',
      });

      const taskC = await stateManager.createTask({
        title: 'Task C',
        description: 'Depends on A',
        priority: 'P2',
        timeout: 600,
        dependencies: [taskA.id],
        assignedAgent: 'coder',
      });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 2,
        taskTimeout: 600000,
      });

      // Only taskA should be executable (B and C depend on A)
      const nextTask = await scheduler.getNextTask();
      expect(nextTask).not.toBeNull();
      expect(nextTask!.id).toBe(taskA.id);

      // Get parallel tasks - should only be taskA
      const parallel = await scheduler.getParallelTasks();
      expect(parallel.length).toBe(1);
      expect(parallel[0].id).toBe(taskA.id);
    });

    it('should detect and handle circular dependencies', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      // Create tasks first (without dependencies), then manually update to create cycle
      const taskA = await stateManager.createTask({
        title: 'Task A',
        description: 'Cycle task',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const taskB = await stateManager.createTask({
        title: 'Task B',
        description: 'Cycle task',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const taskC = await stateManager.createTask({
        title: 'Task C',
        description: 'Cycle task',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      // Manually create circular dependency: A -> C, B -> A, C -> B
      await stateManager.updateTask(taskA.id, { dependencies: [taskC.id] });
      await stateManager.updateTask(taskB.id, { dependencies: [taskA.id] });
      await stateManager.updateTask(taskC.id, { dependencies: [taskB.id] });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 3,
        taskTimeout: 600000,
      });

      // Scheduler should detect circular deps - no task executable
      const nextTask = await scheduler.getNextTask();
      expect(nextTask).toBeNull();
    });

    it('should allow dependent tasks after dependency completes', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      // Create taskA and manually set it to completed
      const taskA = await stateManager.createTask({
        title: 'Task A',
        description: 'Already done',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });
      await stateManager.updateTask(taskA.id, { status: 'completed' });

      const taskB = await stateManager.createTask({
        title: 'Task B',
        description: 'Depends on A',
        priority: 'P1',
        timeout: 600,
        dependencies: [taskA.id],
        assignedAgent: 'coder',
      });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 2,
        taskTimeout: 600000,
      });

      const nextTask = await scheduler.getNextTask();
      expect(nextTask).not.toBeNull();
      expect(nextTask!.id).toBe(taskB.id);
    });

    it('should mark task started with correct phase updates', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      const task = await stateManager.createTask({
        title: 'Start test',
        description: 'Testing markTaskStarted',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 3,
        taskTimeout: 600000,
      });

      await scheduler.markTaskStarted(task.id);

      const loaded = await stateManager.getTask(task.id);
      expect(loaded!.status).toBe('in_progress');
      expect(loaded!.phases.develop.status).toBe('in_progress');
      expect(loaded!.phases.develop.startedAt).toBeDefined();
    });

    it('should mark task completed with all phases updated', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      const task = await stateManager.createTask({
        title: 'Complete test',
        description: 'Testing markTaskCompleted',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      // Move task to accept state
      await stateManager.updateTask(task.id, { status: 'accept' });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 3,
        taskTimeout: 600000,
      });

      await scheduler.markTaskCompleted(task.id);

      const loaded = await stateManager.getTask(task.id);
      expect(loaded!.status).toBe('completed');
      expect(loaded!.phases.accept.status).toBe('completed');
    });

    it('should report correct scheduler status', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      const task1 = await stateManager.createTask({
        title: 'Running task',
        description: 'In progress',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });
      await stateManager.updateTask(task1.id, { status: 'in_progress' });

      await stateManager.createTask({
        title: 'Pending task',
        description: 'Pending',
        priority: 'P2',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });

      const scheduler = new Scheduler(stateManager, {
        maxConcurrentTasks: 3,
        taskTimeout: 600000,
      });

      const status = await scheduler.getStatus();
      expect(status.running).toBe(1);
      expect(status.maxConcurrent).toBe(3);
    });
  });

  // =====================================================
  // 4. Upgrade Detector + Display Integration (E2E check flow)
  // =====================================================

  describe('Upgrade Detector + Display Integration (E2E check flow)', () => {
    it('should detect issues and display them through check helpers', async () => {
      // Create a mock project with known issues
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'app.ts'),
        `// TODO: implement feature
// FIXME: fix this bug
const apiKey = "sk-1234567890";
eval(userInput);
console.log("debug");`
      );
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project', devDependencies: { typescript: '^5.0.0' } })
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // Verify detection results have correct types
      expect(result.projectType).toBe('typescript');
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.summary.total).toBe(result.suggestions.length);

      // Verify summary structure matches type
      const categories: UpgradeCategory[] = [
        'bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'
      ];
      for (const cat of categories) {
        expect(result.summary.byCategory).toHaveProperty(cat);
        expect(typeof result.summary.byCategory[cat]).toBe('number');
      }

      const priorities: UpgradePriority[] = ['critical', 'high', 'medium', 'low'];
      for (const pri of priorities) {
        expect(result.summary.byPriority).toHaveProperty(pri);
        expect(typeof result.summary.byPriority[pri]).toBe('number');
      }

      // Display should not throw
      vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        expect(() => displayResult(result)).not.toThrow();
        expect(() => displayProjectInfo(result.projectName, result.projectType, result.timestamp)).not.toThrow();
        expect(() => displaySummary(result.summary)).not.toThrow();
        expect(() => displaySuggestionsByPriority(result.suggestions)).not.toThrow();
        expect(() => displayHints()).not.toThrow();
      } finally {
        vi.restoreAllMocks();
      }
    });

    it('should produce valid JSON output for --json mode', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.ts'),
        `// TODO: add tests`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // Simulate --json output
      const jsonOutput = JSON.stringify(result, null, 2);
      const parsed = JSON.parse(jsonOutput);

      expect(parsed.projectType).toBe(result.projectType);
      expect(parsed.suggestions).toHaveLength(result.suggestions.length);
      expect(parsed.summary.total).toBe(result.summary.total);

      // Each suggestion should have required fields matching UpgradeSuggestion type
      for (const suggestion of parsed.suggestions) {
        expect(suggestion.id).toBeDefined();
        expect(suggestion.category).toBeDefined();
        expect(suggestion.priority).toBeDefined();
        expect(suggestion.title).toBeDefined();
        expect(suggestion.location).toBeDefined();
        expect(typeof suggestion.autoFixable).toBe('boolean');
      }
    });

    it('should detect multiple categories of issues simultaneously', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'skills'), { recursive: true });

      // Code with multiple issue types
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.ts'),
        `// TODO(critical): urgent fix needed
// FIXME: this is broken
// HACK: temporary workaround
const apiKey = "hardcoded-secret-key";
eval("dangerous");
console.log("debug message");`
      );

      // Skill file without frontmatter
      await fs.writeFile(
        path.join(tempDir, 'skills', 'test.md'),
        `# Test Skill\nNo frontmatter here.`
      );

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'multi-issue-project' })
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src', 'skills'] });
      const result = await detector.detect();

      // Should detect issues from multiple categories
      const detectedCategories = Object.entries(result.summary.byCategory)
        .filter(([, count]) => count > 0)
        .map(([cat]) => cat);

      expect(detectedCategories.length).toBeGreaterThanOrEqual(2);

      // Should have security issues (hardcoded key + eval)
      expect(result.summary.byCategory.security).toBeGreaterThan(0);

      // Should have bug issues (TODO, FIXME, HACK)
      expect(result.summary.byCategory.bug).toBeGreaterThan(0);
    });

    it('should respect userHint filtering in detection results', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'app.ts'),
        `// TODO: add feature
const apiKey = "sk-secret";
eval("code");`
      );

      const detector = new UpgradeDetector(tempDir, {
        scanDirs: ['src'],
        userHint: 'security',
      });
      const result = await detector.detect();

      // Security suggestions should be prioritized first
      if (result.suggestions.length > 1) {
        const firstSecurity = result.suggestions.findIndex(s => s.category === 'security');
        const firstBug = result.suggestions.findIndex(s => s.category === 'bug');
        if (firstSecurity >= 0 && firstBug >= 0) {
          expect(firstSecurity).toBeLessThan(firstBug);
        }
      }
    });

    it('should detect project type correctly through detector + types integration', async () => {
      // OpenMatrix project
      await fs.mkdir(path.join(tempDir, '.openmatrix'));
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'openmatrix' })
      );

      const detector1 = new UpgradeDetector(tempDir);
      const result1 = await detector1.detect();
      expect(result1.projectType).toBe('openmatrix');

      // Clean up for next test
      await fs.rm(path.join(tempDir, '.openmatrix'), { recursive: true });

      // AI project
      await fs.mkdir(path.join(tempDir, '.claude'));
      await fs.writeFile(path.join(tempDir, 'CLAUDE.md'), '# Test');
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'ai-test' })
      );

      const detector2 = new UpgradeDetector(tempDir);
      const result2 = await detector2.detect();
      expect(result2.projectType).toBe('ai-project');
    });
  });

  // =====================================================
  // 5. Full Pipeline: Logger + StateMachine + Storage + Types
  // =====================================================

  describe('Full Pipeline: Logger + StateMachine + Storage + Types', () => {
    it('should log structured events during task lifecycle transitions', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-pipeline-'));
      try {
        // Initialize logger with runId
        initLoggerWithRunId('run-pipeline-001', omPath);
        const logDir = path.join(omPath, '.openmatrix', 'logs');
        setLogger(createLogger({ logDir, console: false, runId: 'run-pipeline-001' }));

        // Setup storage
        const stateDir = path.join(omPath, '.openmatrix');
        const stateManager = await createInitializedStateManager(stateDir);

        // Override state with our runId
        await stateManager.updateState({ runId: 'run-pipeline-001' });

        // Create and transition task through lifecycle
        const task = await stateManager.createTask({
          title: 'Pipeline task',
          description: 'Testing full pipeline',
          priority: 'P0',
          timeout: 600,
          dependencies: [],
          assignedAgent: 'coder',
        });

        const stateMachine = new StateMachine();
        const events: TransitionEvent[] = ['schedule', 'start', 'develop_done', 'verify_done', 'accept_done'];
        const statuses: TaskStatus[] = ['scheduled', 'in_progress', 'verify', 'accept', 'completed'];

        let currentStatus: TaskStatus = task.status;
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          const workingTask = { ...task, status: currentStatus };
          const result = stateMachine.transition(workingTask, event);
          expect(result.success).toBe(true);
          currentStatus = result.toStatus;
          await stateManager.updateTask(task.id, { status: result.toStatus });

          // Log each transition
          const log: StructuredLog = {
            level: 'info',
            runId: 'run-pipeline-001',
            taskId: task.id,
            operation: 'stateTransition',
            message: `Task transitioned via ${event}`,
            metadata: { event, fromStatus: result.fromStatus, toStatus: result.toStatus },
            timestamp: new Date().toISOString(),
          };
          persistLog(log, omPath);
        }

        // Verify final task state
        const finalTask = await stateManager.getTask(task.id);
        expect(finalTask!.status).toBe('completed');

        // Verify log file was written
        const logFile = path.join(omPath, 'logs', 'run-pipeline-001.log');
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n');
        // +1 for the init log from initLoggerWithRunId
        expect(lines.length).toBe(events.length + 1);

        // First line should be the init log
        const initParsed = JSON.parse(lines[0]);
        expect(initParsed.operation).toBe('init');

        // Remaining lines should be stateTransition logs
        for (let i = 1; i < lines.length; i++) {
          const parsed = JSON.parse(lines[i]);
          expect(parsed.runId).toBe('run-pipeline-001');
          expect(parsed.operation).toBe('stateTransition');
        }
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should maintain type consistency across all modules for QualityConfig', () => {
      // Verify QualityConfig type flows through all modules correctly
      const qualityLevels: Array<keyof typeof QUALITY_PRESETS> = ['fast', 'balanced', 'strict'];

      for (const level of qualityLevels) {
        const config = QUALITY_PRESETS[level];

        // Type guard: ensure config matches QualityConfig interface
        const _typedConfig: QualityConfig = config;

        expect(typeof _typedConfig.tdd).toBe('boolean');
        expect(typeof _typedConfig.minCoverage).toBe('number');
        expect(typeof _typedConfig.strictLint).toBe('boolean');
        expect(typeof _typedConfig.securityScan).toBe('boolean');
        expect(typeof _typedConfig.e2eTests).toBe('boolean');
        expect(_typedConfig.level).toBe(level);

        // Logger should accept quality config metadata
        setLogger(createLogger({ logDir: tempDir, console: false }));
        expect(() => {
          logger.info(`Quality: ${level}`, _typedConfig as unknown as Record<string, unknown>);
        }).not.toThrow();
      }
    });

    it('should handle GlobalState statistics updates consistently', async () => {
      const stateManager = await createInitializedStateManager(tempDir);

      // Create multiple tasks
      const task1 = await stateManager.createTask({
        title: 'Completed task',
        description: 'Done',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });
      await stateManager.updateTask(task1.id, { status: 'completed' });

      const task2 = await stateManager.createTask({
        title: 'In-progress task',
        description: 'Running',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });
      await stateManager.updateTask(task2.id, { status: 'in_progress' });

      const task3 = await stateManager.createTask({
        title: 'Failed task',
        description: 'Error',
        priority: 'P1',
        timeout: 600,
        dependencies: [],
        assignedAgent: 'coder',
      });
      await stateManager.updateTask(task3.id, { status: 'failed' });

      // Verify all tasks can be retrieved
      const allTasks = await stateManager.listTasks();
      expect(allTasks.length).toBe(3);

      // Verify states
      const taskMap = new Map(allTasks.map(t => [t.id, t]));
      expect(taskMap.get(task1.id)!.status).toBe('completed');
      expect(taskMap.get(task2.id)!.status).toBe('in_progress');
      expect(taskMap.get(task3.id)!.status).toBe('failed');

      // Verify global state reflects the tasks
      const state = await stateManager.getState();
      expect(state.statistics.totalTasks).toBe(3);
    });
  });

  // =====================================================
  // 6. Upgrade Detector + System-wide Integration
  // =====================================================

  describe('Upgrade Detector + System-wide Integration', () => {
    it('should detect issues in a realistic project structure', async () => {
      // Create a realistic project structure
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'agents'), { recursive: true });

      await fs.writeFile(
        path.join(tempDir, 'src', 'utils', 'helper.ts'),
        `export function helper() {
  // TODO: implement error handling
  return "hello";
}`
      );

      await fs.writeFile(
        path.join(tempDir, 'src', 'agents', 'runner.ts'),
        `export class Runner {
  // FIXME: memory leak in cleanup
  run() {
    console.log("running");
    return true;
  }
}`
      );

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'realistic-project',
          version: '1.0.0',
          devDependencies: { typescript: '^5.0.0' },
        })
      );

      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project');

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.projectType).toBe('typescript');
      expect(result.projectName).toBe('realistic-project');
      expect(result.suggestions.length).toBeGreaterThan(0);

      // Verify detection result type consistency
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
      expect(result.scanPath).toBe(tempDir);
    });

    it('should handle empty project gracefully', async () => {
      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.projectType).toBe('unknown');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThanOrEqual(0);
    });

    it('should provide autoFixable flag consistent across detection', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'app.ts'),
        `console.log("debug");
// Very long line that exceeds one hundred and twenty characters in length to test the auto-fixable detection for line length
const x = 1;`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // Every suggestion should have a valid autoFixable boolean
      for (const suggestion of result.suggestions) {
        expect(typeof suggestion.autoFixable).toBe('boolean');
      }

      // Console.log should be autoFixable
      const consoleSuggestion = result.suggestions.find(s =>
        s.category === 'quality' && s.title.includes('调试日志')
      );
      if (consoleSuggestion) {
        expect(consoleSuggestion.autoFixable).toBe(true);
      }
    });

    it('should respect DEFAULT_DETECTOR_CONFIG type structure', () => {
      // Verify the default config matches DetectorConfig type
      expect(Array.isArray(DEFAULT_DETECTOR_CONFIG.scanDirs)).toBe(true);
      expect(Array.isArray(DEFAULT_DETECTOR_CONFIG.excludeDirs)).toBe(true);
      expect(Array.isArray(DEFAULT_DETECTOR_CONFIG.categories)).toBe(true);
      expect(DEFAULT_DETECTOR_CONFIG.minPriority).toMatch(/^(critical|high|medium|low)$/);

      // Verify all categories are valid UpgradeCategory values
      const validCategories: UpgradeCategory[] = [
        'bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'
      ];
      for (const cat of DEFAULT_DETECTOR_CONFIG.categories) {
        expect(validCategories).toContain(cat);
      }
    });
  });

  // =====================================================
  // 7. CLI Check Command Integration
  // =====================================================

  describe('CLI Check Command Integration', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should format DetectionResult through display helpers without errors', async () => {
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'app.ts'),
        `// TODO: test
const x = 1;`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // All display functions should work
      expect(() => displayProjectInfo(result.projectName, result.projectType, result.timestamp)).not.toThrow();
      expect(() => displaySummary(result.summary)).not.toThrow();
      expect(() => displaySuggestionsByPriority(result.suggestions)).not.toThrow();
      expect(() => displayHints()).not.toThrow();
    });

    it('should display all category labels for detected categories', () => {
      const labels = getCategoryLabels();
      const categories: UpgradeCategory[] = [
        'bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'
      ];

      for (const cat of categories) {
        expect(labels[cat]).toBeDefined();
        expect(typeof labels[cat]).toBe('string');
      }
    });

    it('should handle empty suggestions in display', () => {
      const emptyResult: DetectionResult = {
        projectType: 'typescript',
        projectName: 'test',
        scanPath: tempDir,
        timestamp: new Date().toISOString(),
        suggestions: [],
        summary: {
          total: 0,
          byCategory: {
            bug: 0, quality: 0, capability: 0, ux: 0, style: 0, security: 0,
            common: 0, prompt: 0, skill: 0, agent: 0,
          },
          byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
          autoFixable: 0,
        },
      };

      expect(() => {
        displayProjectInfo(emptyResult.projectName, emptyResult.projectType, emptyResult.timestamp);
        displaySummary(emptyResult.summary);
        displaySuggestionsByPriority(emptyResult.suggestions);
      }).not.toThrow();
    });
  });

  // =====================================================
  // 8. Cross-cutting: Type safety validation across all modules
  // =====================================================

  describe('Cross-cutting Type Safety Validation', () => {
    it('should ensure all TaskStatus values are handled in state machine transitions', () => {
      const stateMachine = new StateMachine();
      const allStatuses: TaskStatus[] = [
        'pending', 'scheduled', 'in_progress', 'blocked', 'waiting',
        'verify', 'accept', 'completed', 'failed', 'retry_queue'
      ];

      for (const status of allStatuses) {
        const transitions = stateMachine.getAllowedTransitions(status);
        expect(Array.isArray(transitions)).toBe(true);
      }
    });

    it('should ensure Task interface satisfies all module requirements', () => {
      const task: Task = {
        id: 'TASK-FULL',
        title: 'Full task',
        description: 'A task with all fields populated',
        status: 'in_progress',
        priority: 'P0',
        timeout: 300,
        dependencies: ['TASK-DEP-1', 'TASK-DEP-2'],
        assignedAgent: 'coder',
        phases: {
          develop: { status: 'in_progress', duration: null, startedAt: new Date().toISOString() },
          verify: { status: 'pending', duration: null },
          accept: { status: 'pending', duration: null },
        },
        retryCount: 0,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        testTaskId: 'TEST-001',
        phase: 'develop',
      };

      // Task should be serializable (for storage)
      const serialized = JSON.stringify(task);
      const deserialized: Task = JSON.parse(serialized);
      expect(deserialized.id).toBe(task.id);
      expect(deserialized.acceptanceCriteria).toHaveLength(2);
      expect(deserialized.phase).toBe('develop');

      // Task should work with state machine
      const stateMachine = new StateMachine();
      const result = stateMachine.transition(deserialized, 'develop_done');
      expect(result.success).toBe(true);
      expect(result.toStatus).toBe('verify');
    });

    it('should ensure SubagentTask type is consistent with AgentType', () => {
      const agentTypes: AgentType[] = ['planner', 'coder', 'tester', 'reviewer', 'researcher', 'executor'];

      for (const agentType of agentTypes) {
        const subagentTask: SubagentTask = {
          subagent_type: 'general-purpose',
          description: `Run ${agentType}`,
          prompt: `Execute task using ${agentType}`,
          taskId: 'TASK-001',
          agentType,
          timeout: 60000,
          needsApproval: false,
        };

        expect(subagentTask.agentType).toBe(agentType);
        expect(typeof subagentTask.timeout).toBe('number');
        expect(typeof subagentTask.needsApproval).toBe('boolean');
      }
    });

    it('should ensure AppConfig integrates with QualityConfig', () => {
      const config: AppConfig = {
        timeout: 120,
        taskTimeout: 600000,
        maxRetries: 3,
        approvalPoints: ['plan', 'merge'],
        maxConcurrentAgents: 3,
        model: 'claude-sonnet-4-6',
        quality: QUALITY_PRESETS.strict,
      };

      expect(config.quality).toBeDefined();
      expect(config.quality!.tdd).toBe(true);
      expect(config.quality!.minCoverage).toBe(80);
      expect(config.quality!.level).toBe('strict');
    });
  });
});

// Helper function used in integration tests (mirrors the one in check.ts)
function displayResult(result: DetectionResult): void {
  displayProjectInfo(result.projectName, result.projectType, result.timestamp);
  displaySummary(result.summary);
  if (result.suggestions.length > 0) {
    displaySuggestionsByPriority(result.suggestions);
  }
  displayHints();
}
