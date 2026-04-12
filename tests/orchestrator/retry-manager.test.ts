// tests/orchestrator/retry-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetryManager } from '../../src/orchestrator/retry-manager.js';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RetryManager', () => {
  let manager: RetryManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-retry-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('basic operations (without persistence)', () => {
    beforeEach(() => {
      manager = new RetryManager();
    });

    it('should add task to queue', () => {
      manager.addToQueue('TASK-001', 'timeout error');
      const queue = manager.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].taskId).toBe('TASK-001');
      expect(queue[0].error).toBe('timeout error');
      expect(queue[0].attempt).toBe(1);
    });

    it('should increment attempt on retry', () => {
      manager.addToQueue('TASK-001', 'error 1');
      manager.addToQueue('TASK-001', 'error 2');

      const queue = manager.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].attempt).toBe(2);
    });

    it('should get ready tasks', async () => {
      manager.addToQueue('TASK-001', 'error');

      // Wait for base delay (30s by default, but we test the logic)
      const readyTasks = manager.getReadyTasks();
      // Initially not ready (nextRetryAt is in future)
      expect(readyTasks.length).toBe(0);
    });

    it('should remove task from queue', () => {
      manager.addToQueue('TASK-001', 'error');
      manager.removeFromQueue('TASK-001');
      expect(manager.getQueue()).toHaveLength(0);
    });

    it('should check if task should retry', () => {
      manager.addToQueue('TASK-001', 'error');

      // Should retry until maxRetries reached
      expect(manager.shouldRetry('TASK-001')).toBe(true);

      // Retry 2 more times to reach max (default 3)
      manager.addToQueue('TASK-001', 'error 2');
      manager.addToQueue('TASK-001', 'error 3');

      // After 3 attempts, should not retry
      expect(manager.shouldRetry('TASK-001')).toBe(false);
    });

    it('should return correct queue status', () => {
      manager.addToQueue('TASK-001', 'error');
      manager.addToQueue('TASK-002', 'error');

      const status = manager.getQueueStatus();
      expect(status.total).toBe(2);
    });

    it('should clear queue', () => {
      manager.addToQueue('TASK-001', 'error');
      manager.addToQueue('TASK-002', 'error');
      manager.clearQueue();
      expect(manager.getQueue()).toHaveLength(0);
    });
  });

  describe('with persistence', () => {
    beforeEach(() => {
      manager = new RetryManager({}, tempDir);
    });

    it('should persist queue to file', async () => {
      manager.addToQueue('TASK-001', 'timeout error');

      // Check file exists
      const queuePath = join(tempDir, 'retry-queue.json');
      await expect(access(queuePath)).resolves.not.toThrow();

      // Check content
      const content = await readFile(queuePath, 'utf-8');
      const data = JSON.parse(content);
      expect(data.queue).toHaveLength(1);
      expect(data.queue[0].taskId).toBe('TASK-001');
    });

    it('should load queue on construction', async () => {
      // First manager creates and persists
      manager.addToQueue('TASK-001', 'error');

      // Second manager should load the queue
      const manager2 = new RetryManager({}, tempDir);
      const queue = manager2.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].taskId).toBe('TASK-001');
    });

    it('should persist removal', async () => {
      manager.addToQueue('TASK-001', 'error');
      manager.removeFromQueue('TASK-001');

      // New manager should not see the removed task
      const manager2 = new RetryManager({}, tempDir);
      expect(manager2.getQueue()).toHaveLength(0);
    });
  });

  describe('exponential backoff', () => {
    beforeEach(() => {
      manager = new RetryManager({
        backoff: 'exponential',
        baseDelay: 1000 // 1 second for testing
      });
    });

    it('should calculate exponential delay', () => {
      manager.addToQueue('TASK-001', 'error');
      const queue = manager.getQueue();
      const firstDelay = queue[0].nextRetryAt - Date.now();

      // First attempt: 1000ms
      expect(firstDelay).toBeGreaterThanOrEqual(900);
      expect(firstDelay).toBeLessThanOrEqual(1100);
    });
  });

  describe('linear backoff', () => {
    beforeEach(() => {
      manager = new RetryManager({
        backoff: 'linear',
        baseDelay: 1000
      });
    });

    it('should calculate linear delay', () => {
      manager.addToQueue('TASK-001', 'error');
      const firstDelay = manager.getQueue()[0].nextRetryAt - Date.now();
      expect(firstDelay).toBeGreaterThanOrEqual(900);
      expect(firstDelay).toBeLessThanOrEqual(1100);

      manager.addToQueue('TASK-001', 'error 2');
      const secondDelay = manager.getQueue()[0].nextRetryAt - Date.now();
      expect(secondDelay).toBeGreaterThanOrEqual(1900);
      expect(secondDelay).toBeLessThanOrEqual(2100);
    });
  });

  describe('fixed backoff', () => {
    beforeEach(() => {
      manager = new RetryManager({
        backoff: 'fixed',
        baseDelay: 1000
      });
    });

    it('should calculate fixed delay', () => {
      manager.addToQueue('TASK-001', 'error');
      const delay1 = manager.getQueue()[0].nextRetryAt - Date.now();
      expect(delay1).toBeGreaterThanOrEqual(900);
      expect(delay1).toBeLessThanOrEqual(1100);

      manager.addToQueue('TASK-001', 'error 2');
      const delay2 = manager.getQueue()[0].nextRetryAt - Date.now();
      expect(delay2).toBeGreaterThanOrEqual(900);
      expect(delay2).toBeLessThanOrEqual(1100);
    });
  });
});