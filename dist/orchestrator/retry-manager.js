"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryManager = void 0;
class RetryManager {
    queue = [];
    config;
    constructor(config = {}) {
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
    addToQueue(taskId, error) {
        const existing = this.queue.find(item => item.taskId === taskId);
        if (existing) {
            existing.attempt++;
            existing.nextRetryAt = this.calculateDelay(existing.attempt);
            existing.error = error;
        }
        else {
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
    getReadyTasks() {
        const now = Date.now();
        return this.queue.filter(item => item.nextRetryAt <= now);
    }
    /**
     * Remove a task from the queue
     */
    removeFromQueue(taskId) {
        const index = this.queue.findIndex(item => item.taskId === taskId);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
    }
    /**
     * Check if a task should be retried
     */
    shouldRetry(taskId) {
        const item = this.queue.find(item => item.taskId === taskId);
        if (!item)
            return false;
        return item.attempt < this.config.maxRetries;
    }
    /**
     * Get queue status
     */
    getQueueStatus() {
        const now = Date.now();
        return {
            total: this.queue.length,
            ready: this.getReadyTasks().length,
            pending: this.queue.filter(item => item.nextRetryAt > now).length
        };
    }
    calculateDelay(attempt) {
        switch (this.config.backoff) {
            case 'exponential':
                return Math.min(this.config.baseDelay * Math.pow(2, attempt - 1), 300000 // Max 5 minutes
                );
            case 'linear':
                return this.config.baseDelay * attempt;
            case 'fixed':
            default:
                return this.config.baseDelay;
        }
    }
}
exports.RetryManager = RetryManager;
