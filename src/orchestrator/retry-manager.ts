// src/orchestrator/retry-manager.ts
import type { Task } from '../types/index.js';
import { FileStore } from '../storage/file-store.js';
import { logError } from '../utils/error-handler.js';

export interface RetryConfig {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  baseDelay: number; // ms
}

export interface RetryItem {
  taskId: string;
  attempt: number;
  nextRetryAt: number;
  error: string;
  addedAt: string; // ISO timestamp for persistence
}

export class RetryManager {
  private queue: RetryItem[] = [];
  private config: RetryConfig;
  private store: FileStore | null = null;
  private queuePath = 'retry-queue.json';

  constructor(config: Partial<RetryConfig> = {}, basePath?: string) {
    this.config = {
      maxRetries: 3,
      backoff: 'exponential',
      baseDelay: 30000, // 30 seconds
      ...config
    };

    // 初始化持久化存储
    if (basePath) {
      this.store = new FileStore(basePath);
      this.loadQueue();
    }
  }

  /**
   * 从文件加载队列（进程重启恢复）
   */
  private loadQueue(): void {
    if (!this.store) return;
    const data = this.store.readJsonSync<{ queue: RetryItem[] }>(this.queuePath);
    if (data?.queue) {
      // 过滤掉已经过期的重试项（超过 maxRetries 或超过 24 小时）
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      this.queue = data.queue.filter(item => {
        const addedTime = new Date(item.addedAt).getTime();
        return item.attempt < this.config.maxRetries && (now - addedTime) < maxAge;
      });
    }
  }

  /**
   * 持久化队列到文件
   */
  private persistQueue(): void {
    if (!this.store) return;
    this.store.writeJsonSync(this.queuePath, { queue: this.queue, updatedAt: new Date().toISOString() });
  }

  /**
   * Add a failed task to retry queue
   */
  addToQueue(taskId: string, error: string): void {
    const existing = this.queue.find(item => item.taskId === taskId);

    if (existing) {
      existing.attempt++;
      existing.nextRetryAt = Date.now() + this.calculateDelay(existing.attempt);
      existing.error = error;
    } else {
      this.queue.push({
        taskId,
        attempt: 1,
        nextRetryAt: Date.now() + this.calculateDelay(1),
        error,
        addedAt: new Date().toISOString()
      });
    }
    this.persistQueue();
  }

  /**
   * Get tasks ready for retry
   */
  getReadyTasks(): RetryItem[] {
    const now = Date.now();
    return this.queue.filter(item => item.nextRetryAt <= now);
  }

  /**
   * Remove a task from the queue
   */
  removeFromQueue(taskId: string): void {
    const index = this.queue.findIndex(item => item.taskId === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistQueue();
    }
  }

  /**
   * Check if a task should be retried
   */
  shouldRetry(taskId: string): boolean {
    const item = this.queue.find(item => item.taskId === taskId);
    if (!item) return false;
    return item.attempt < this.config.maxRetries;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    ready: number;
    pending: number;
  } {
    const now = Date.now();
    return {
      total: this.queue.length,
      ready: this.getReadyTasks().length,
      pending: this.queue.filter(item => item.nextRetryAt > now).length
    };
  }

  /**
   * 获取队列内容（用于测试和调试）
   */
  getQueue(): RetryItem[] {
    return [...this.queue];
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
  }

  private calculateDelay(attempt: number): number {
    switch (this.config.backoff) {
      case 'exponential':
        return Math.min(
          this.config.baseDelay * Math.pow(2, attempt - 1),
          300000 // Max 5 minutes
        );
      case 'linear':
        return this.config.baseDelay * attempt;
      case 'fixed':
      default:
        return this.config.baseDelay;
    }
  }
}
