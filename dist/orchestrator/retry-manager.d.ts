export interface RetryConfig {
    maxRetries: number;
    backoff: 'exponential' | 'linear' | 'fixed';
    baseDelay: number;
}
export interface RetryItem {
    taskId: string;
    attempt: number;
    nextRetryAt: number;
    error: string;
}
export declare class RetryManager {
    private queue;
    private config;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Add a failed task to retry queue
     */
    addToQueue(taskId: string, error: string): void;
    /**
     * Get tasks ready for retry
     */
    getReadyTasks(): RetryItem[];
    /**
     * Remove a task from the queue
     */
    removeFromQueue(taskId: string): void;
    /**
     * Check if a task should be retried
     */
    shouldRetry(taskId: string): boolean;
    /**
     * Get queue status
     */
    getQueueStatus(): {
        total: number;
        ready: number;
        pending: number;
    };
    private calculateDelay;
}
