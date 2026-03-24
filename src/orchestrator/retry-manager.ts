// src/orchestrator/retry-manager.ts
import type { Task } from '../types/index.js';

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
}

export class RetryManager {
  private queue: RetryItem[] = [];
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      backoff: 'exponential',
      baseDelay: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Add a failed task to retry queue
   */
  addToQueue(taskId: string, error: string): void {
    const existing = this.queue.find(item => item.taskId === taskId);

    if (existing) {
      existing.attempt++;
      existing.nextRetryAt = this.calculateDelay(existing.attempt);
      existing.error = error;
    } else {
      this.queue.push({
        taskId,
        attempt: 1,
        nextRetryAt: Date.now() + this.calculateDelay(1),
        error
      });
    }
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
