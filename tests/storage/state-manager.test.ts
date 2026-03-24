import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/storage/state-manager.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StateManager', () => {
  let manager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-test-'));
    manager = new StateManager(tempDir);
    await manager.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should initialize with default state', async () => {
    const state = await manager.getState();
    expect(state.status).toBe('initialized');
    expect(state.version).toBe('1.0');
  });

  it('should update state', async () => {
    await manager.updateState({ status: 'running' });
    const state = await manager.getState();
    expect(state.status).toBe('running');
  });

  it('should create and get task', async () => {
    const task = await manager.createTask({
      title: 'Test Task',
      description: 'Test description',
      priority: 'P0',
      timeout: 120,
      dependencies: [],
      assignedAgent: 'coder'
    });

    expect(task.id).toMatch(/^TASK-/);
    expect(task.title).toBe('Test Task');
    expect(task.status).toBe('pending');

    const retrieved = await manager.getTask(task.id);
    expect(retrieved).toEqual(task);
  });

  it('should update task status', async () => {
    const task = await manager.createTask({
      title: 'Test',
      description: 'Test',
      priority: 'P1',
      timeout: 60,
      dependencies: [],
      assignedAgent: 'coder'
    });

    await manager.updateTask(task.id, { status: 'in_progress' });
    const updated = await manager.getTask(task.id);
    expect(updated?.status).toBe('in_progress');
  });

  it('should list all tasks', async () => {
    await manager.createTask({ title: 'A', description: 'A', priority: 'P0', timeout: 60, dependencies: [], assignedAgent: 'coder' });
    await manager.createTask({ title: 'B', description: 'B', priority: 'P0', timeout: 60, dependencies: [], assignedAgent: 'coder' });

    const tasks = await manager.listTasks();
    expect(tasks).toHaveLength(2);
  });

  it('should update statistics when task status changes', async () => {
    await manager.createTask({ title: 'Test', description: 'Test', priority: 'P0', timeout: 60, dependencies: [], assignedAgent: 'coder' });

    let state = await manager.getState();
    expect(state.statistics.pending).toBe(1);
    expect(state.statistics.inProgress).toBe(0);

    const tasks = await manager.listTasks();
    await manager.updateTask(tasks[0].id, { status: 'in_progress' });

    state = await manager.getState();
    expect(state.statistics.pending).toBe(0);
    expect(state.statistics.inProgress).toBe(1);
  });
});
