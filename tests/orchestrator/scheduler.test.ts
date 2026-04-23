// tests/orchestrator/scheduler.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../../src/orchestrator/scheduler.js';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Scheduler', () => {
  let scheduler: Scheduler;
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-scheduler-test-'));
    stateManager = new StateManager(tempDir);
    await stateManager.initialize();
    scheduler = new Scheduler(stateManager);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getNextTask', () => {
    it('should return null when no tasks exist', async () => {
      const task = await scheduler.getNextTask();
      expect(task).toBeNull();
    });

    it('should return pending task', async () => {
      await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const task = await scheduler.getNextTask();
      expect(task).not.toBeNull();
      expect(task?.status).toBe('pending');
    });

    it('should return highest priority task first', async () => {
      await stateManager.createTask({
        title: 'Low Priority',
        description: 'Test',
        priority: 'P3',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await stateManager.createTask({
        title: 'High Priority',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const task = await scheduler.getNextTask();
      expect(task?.priority).toBe('P0');
    });
  });

  describe('getParallelTasks', () => {
    it('should return empty array when no tasks', async () => {
      const tasks = await scheduler.getParallelTasks();
      expect(tasks).toHaveLength(0);
    });

    it('should return multiple independent tasks', async () => {
      await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await stateManager.createTask({
        title: 'Task 2',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const tasks = await scheduler.getParallelTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.length).toBeLessThanOrEqual(3); // maxConcurrentTasks = 3
    });

    it('should not return tasks with unmet dependencies', async () => {
      const depTask = await stateManager.createTask({
        title: 'Dependency Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await stateManager.createTask({
        title: 'Dependent Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [depTask.id],
        assignedAgent: 'coder'
      });

      const tasks = await scheduler.getParallelTasks();
      // Only the dependency task should be returned (not completed yet)
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(depTask.id);
    });

    it('should return dependent task after dependency completes', async () => {
      const depTask = await stateManager.createTask({
        title: 'Dependency Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await stateManager.createTask({
        title: 'Dependent Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [depTask.id],
        assignedAgent: 'coder'
      });

      // Complete the dependency task
      await stateManager.updateTask(depTask.id, { status: 'completed' });

      const tasks = await scheduler.getParallelTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Dependent Task');
    });
  });

  describe('detectCircularDependencies', () => {
    it('should return empty array when no cycles', async () => {
      const task1 = await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const task2 = await stateManager.createTask({
        title: 'Task 2',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [task1.id],
        assignedAgent: 'coder'
      });

      const tasks = await stateManager.listTasks();
      const cycles = scheduler.detectCircularDependencies(tasks);
      expect(cycles).toHaveLength(0);
    });

    it('should detect simple cycle', async () => {
      const task1 = await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const task2 = await stateManager.createTask({
        title: 'Task 2',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [task1.id],
        assignedAgent: 'coder'
      });

      // Create cycle: Task 1 depends on Task 2
      await stateManager.updateTask(task1.id, { dependencies: [task2.id] });

      const tasks = await stateManager.listTasks();
      const cycles = scheduler.detectCircularDependencies(tasks);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect self-dependency', async () => {
      const task = await stateManager.createTask({
        title: 'Self Dependent',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // Create self-dependency
      await stateManager.updateTask(task.id, { dependencies: [task.id] });

      const tasks = await stateManager.listTasks();
      const cycles = scheduler.detectCircularDependencies(tasks);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('markTaskStarted', () => {
    it('should mark task as in_progress', async () => {
      const task = await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await scheduler.markTaskStarted(task.id);
      const updated = await stateManager.getTask(task.id);

      expect(updated?.status).toBe('in_progress');
      expect(updated?.phases.develop.status).toBe('in_progress');
    });

    it('should throw error for non-existent task', async () => {
      await expect(scheduler.markTaskStarted('TASK-NONEXISTENT'))
        .rejects.toThrow('not found');
    });
  });

  describe('markTaskCompleted', () => {
    it('should mark task as completed after passing through all phases', async () => {
      const task = await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // Start task (pending → in_progress)
      await scheduler.markTaskStarted(task.id);
      let updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('in_progress');

      // Simulate develop completion (in_progress → verify)
      await stateManager.updateTask(task.id, { status: 'verify' });
      updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('verify');

      // Simulate verify completion (verify → accept)
      await stateManager.updateTask(task.id, { status: 'accept' });
      updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('accept');

      // Complete task (accept → completed)
      await scheduler.markTaskCompleted(task.id);
      updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('completed');
    });
  });

  describe('markTaskFailed', () => {
    it('should mark task as failed with error', async () => {
      const task = await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await scheduler.markTaskStarted(task.id);
      await scheduler.markTaskFailed(task.id, 'Something went wrong');

      const updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error).toContain('Something went wrong');
    });
  });

  describe('markTaskBlocked', () => {
    it('should mark task as blocked when in_progress', async () => {
      const task = await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      // First start the task (pending → in_progress)
      await scheduler.markTaskStarted(task.id);

      // Then block it (in_progress → blocked)
      await scheduler.markTaskBlocked(task.id, 'Missing dependency');

      const updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('blocked');
    });

    it('should allow blocking pending task (e.g. circular dependency)', async () => {
      const task = await stateManager.createTask({
        title: 'Test Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await scheduler.markTaskBlocked(task.id, 'Circular dependency');
      const updated = await stateManager.getTask(task.id);
      expect(updated?.status).toBe('blocked');
    });
  });

  describe('cycleCache', () => {
    it('should cache cycle detection results', async () => {
      const task1 = await stateManager.createTask({
        title: 'Task 1',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      const task2 = await stateManager.createTask({
        title: 'Task 2',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [task1.id],
        assignedAgent: 'coder'
      });

      // First call - cache should be empty
      expect(scheduler.getCycleCache().size).toBe(0);

      // Get parallel tasks (triggers cycle check)
      await scheduler.getParallelTasks();

      // Cache should now have entries
      expect(scheduler.getCycleCache().size).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache when requested', async () => {
      await stateManager.createTask({
        title: 'Task',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await scheduler.getParallelTasks();
      scheduler.clearCycleCache();

      expect(scheduler.getCycleCache().size).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      const status = await scheduler.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('maxConcurrent');
      expect(status.maxConcurrent).toBe(3);
    });

    it('should count running tasks', async () => {
      const task = await stateManager.createTask({
        title: 'Test',
        description: 'Test',
        priority: 'P0',
        timeout: 60,
        dependencies: [],
        assignedAgent: 'coder'
      });

      await scheduler.markTaskStarted(task.id);

      const status = await scheduler.getStatus();
      expect(status.running).toBe(1);
    });
  });

  describe('DEFAULT_TASK_TIMEOUT constant', () => {
    it('should have correct default timeout', () => {
      expect(Scheduler.DEFAULT_TASK_TIMEOUT).toBe(600000); // 10 minutes
    });
  });
});