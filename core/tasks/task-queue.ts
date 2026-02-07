/**
 * Task Queue
 * 
 * Manages the pool of pending tasks waiting for worker assignment.
 * usage: Enqueue new tasks, Poll for best matching task.
 */

import { PendingAssignment } from '../registry/assignment-engine';

export class TaskQueue {
    private queue: PendingAssignment[] = [];

    /**
     * Add task to queue and sort by priority
     * Priority: Deadline (Ascending) -> Budget (Descending)
     */
    enqueue(task: PendingAssignment) {
        // Prevent duplicates
        if (this.queue.find(t => t.taskId === task.taskId)) {
            return;
        }

        this.queue.push(task);
        this.sort();
    }

    /**
     * Remove task from queue
     */
    remove(taskId: string) {
        this.queue = this.queue.filter(t => t.taskId !== taskId);
    }

    /**
     * Get best matching task for an agent
     */
    poll(capabilities: string[], minFee: string): PendingAssignment | null {
        const minFeeNum = parseFloat(minFee);

        // Find first match (already sorted by priority)
        const match = this.queue.find(task => {
            if (task.status !== 'open') return false;

            // Check Capabilities
            const hasCaps = task.requiredCapabilities.every(cap =>
                capabilities.includes(cap)
            );
            if (!hasCaps) return false;

            // Check Budget vs Fee
            const budgetNum = parseFloat(task.budget);
            if (budgetNum < minFeeNum) return false;

            return true;
        });

        return match || null;
    }

    /**
     * Sort queue by priority
     */
    private sort() {
        this.queue.sort((a, b) => {
            // 1. Deadline (Sooner first)
            const timeDiff = a.deadline.getTime() - b.deadline.getTime();
            if (timeDiff !== 0) return timeDiff;

            // 2. Budget (Higher first)
            return parseFloat(b.budget) - parseFloat(a.budget);
        });
    }

    get size(): number {
        return this.queue.length;
    }

    getAll(): PendingAssignment[] {
        return [...this.queue];
    }
}
