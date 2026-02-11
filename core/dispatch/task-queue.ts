/**
 * Task Queue System
 * 
 * Centralized queue for dispatching tasks to agents with priority handling,
 * deduplication, and expiration.
 */

import * as fs from 'fs';
import * as path from 'path';

export type DispatchTaskType =
    | 'mission_assigned'
    | 'mission_reminder'
    | 'verification_required'
    | 'payment_received'
    | 'bond_slashed'
    | 'mission_failed'
    | 'crew_task_available'      // Broadcast to agents with matching specialty
    | 'crew_task_assigned'       // Specific agent claimed a crew subtask
    | 'revision_required';       // Worker needs to revise submission

export type DispatchTaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface DispatchTask {
    id: string;
    agent_id: string;
    type: DispatchTaskType;
    priority: DispatchTaskPriority;
    payload: {
        mission_id?: string;
        action: string;              // Human-readable instruction
        deadline?: Date;
        reward?: number;
        amount?: number;
        reason?: string;
        [key: string]: any;          // Additional context
    };
    created_at: Date;
    expires_at: Date;
    acknowledged: boolean;
    acknowledged_at?: Date;
}

export interface TaskQueueConfig {
    expiration_hours: number;        // Default: 24
    max_tasks_per_agent: number;     // Default: 100
    persist_to_disk: boolean;        // Default: true
}

const DEFAULT_CONFIG: TaskQueueConfig = {
    expiration_hours: 24,
    max_tasks_per_agent: 100,
    persist_to_disk: true
};

export class TaskQueue {
    private tasks: Map<string, DispatchTask> = new Map();
    private config: TaskQueueConfig;
    private dataPath: string;
    private instanceId: string;

    constructor(dataDir: string = './data', config?: Partial<TaskQueueConfig>) {
        this.instanceId = `TQ_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.dataPath = path.join(dataDir, 'dispatch-tasks.json');
        this.config = { ...DEFAULT_CONFIG, ...config };

        console.log(`[TaskQueue:${this.instanceId}] 🆕 NEW INSTANCE created, dataPath: ${this.dataPath}`);
        if (this.config.persist_to_disk) {
            this.load();
        }
    }

    /**
     * Enqueue a new task with deduplication
     */
    enqueue(params: {
        agent_id: string;
        type: DispatchTaskType;
        priority: DispatchTaskPriority;
        payload: DispatchTask['payload'];
        expires_in_hours?: number;
    }): DispatchTask {
        // Deduplication: Check if similar task already exists
        const dedupeKey = this.getDedupeKey(params.agent_id, params.type, params.payload.mission_id);
        const existingTask = this.findTaskByDedupeKey(dedupeKey);

        if (existingTask && !existingTask.acknowledged) {
            console.log(`[TaskQueue:${this.instanceId}] Duplicate task detected, skipping: ${dedupeKey}`);
            return existingTask;
        }

        // Create new task
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresInHours = params.expires_in_hours || this.config.expiration_hours;
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

        const task: DispatchTask = {
            id: taskId,
            agent_id: params.agent_id,
            type: params.type,
            priority: params.priority,
            payload: params.payload,
            created_at: new Date(),
            expires_at: expiresAt,
            acknowledged: false
        };

        this.tasks.set(taskId, task);
        this.save();

        console.log(`[TaskQueue:${this.instanceId}] ✅ ENQUEUED ${params.type} for agent ${params.agent_id} (task: ${taskId}, priority: ${params.priority})`);
        console.log(`[TaskQueue:${this.instanceId}] Total tasks in memory: ${this.tasks.size}`);

        return task;
    }

    /**
     * Poll for pending tasks for an agent
     */
    poll(agentId: string, limit: number = 10): {
        tasks: DispatchTask[];
        has_more: boolean;
    } {
        // CRITICAL: Reload from disk to get fresh data from other instances
        if (this.config.persist_to_disk) {
            this.load();
        }

        // Get all pending tasks for agent
        const pendingTasks = Array.from(this.tasks.values())
            .filter(t =>
                t.agent_id === agentId &&
                !t.acknowledged &&
                new Date() < t.expires_at
            )
            .sort((a, b) => {
                // Sort by priority first
                const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;

                // Then by creation time (FIFO within priority)
                return a.created_at.getTime() - b.created_at.getTime();
            });

        const tasks = pendingTasks.slice(0, limit);
        const has_more = pendingTasks.length > limit;

        console.log(`[TaskQueue:${this.instanceId}] 🔍 POLL by agent ${agentId}: ${tasks.length} tasks returned (${has_more ? 'more available' : 'all'})`);
        console.log(`[TaskQueue:${this.instanceId}] Total tasks in memory: ${this.tasks.size}, Pending for this agent: ${pendingTasks.length}`);

        return { tasks, has_more };
    }

    /**
     * Acknowledge tasks (mark as seen)
     */
    acknowledge(taskIds: string[]): number {
        let acknowledged = 0;

        for (const taskId of taskIds) {
            const task = this.tasks.get(taskId);
            if (task && !task.acknowledged) {
                task.acknowledged = true;
                task.acknowledged_at = new Date();
                acknowledged++;
            }
        }

        if (acknowledged > 0) {
            this.save();
            console.log(`[TaskQueue] Acknowledged ${acknowledged} tasks`);
        }

        return acknowledged;
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): DispatchTask | null {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Cleanup expired and old acknowledged tasks
     */
    cleanup(): { expired: number; old_ack: number } {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let expired = 0;
        let old_ack = 0;

        for (const [id, task] of this.tasks.entries()) {
            // Remove expired tasks
            if (now > task.expires_at) {
                this.tasks.delete(id);
                expired++;
                continue;
            }

            // Remove old acknowledged tasks (>7 days)
            if (task.acknowledged && task.acknowledged_at && task.acknowledged_at < sevenDaysAgo) {
                this.tasks.delete(id);
                old_ack++;
            }
        }

        if (expired > 0 || old_ack > 0) {
            this.save();
            console.log(`[TaskQueue] Cleanup: ${expired} expired, ${old_ack} old acknowledged`);
        }

        return { expired, old_ack };
    }

    /**
     * Get task statistics
     */
    getStats(): {
        total_tasks: number;
        pending_tasks: number;
        acknowledged_tasks: number;
        expired_tasks: number;
        by_type: Record<DispatchTaskType, number>;
        by_priority: Record<DispatchTaskPriority, number>;
    } {
        const tasks = Array.from(this.tasks.values());
        const now = new Date();

        const by_priority: Record<DispatchTaskPriority, number> = {
            urgent: 0,
            high: 0,
            normal: 0,
            low: 0
        };

        const by_type: Record<DispatchTaskType, number> = {
            mission_assigned: 0,
            mission_reminder: 0,
            verification_required: 0,
            payment_received: 0,
            bond_slashed: 0,
            mission_failed: 0,
            crew_task_available: 0,
            crew_task_assigned: 0,
            revision_required: 0
        };

        let expired_tasks = 0;
        let pending_tasks = 0;
        let acknowledged_tasks = 0;

        for (const task of tasks) {
            by_priority[task.priority]++;
            by_type[task.type]++;

            if (now > task.expires_at) {
                expired_tasks++;
            } else if (!task.acknowledged) {
                pending_tasks++;
            } else {
                acknowledged_tasks++;
            }
        }

        return {
            total_tasks: tasks.length,
            pending_tasks,
            acknowledged_tasks,
            expired_tasks,
            by_type,
            by_priority
        };
    }

    /**
     * Generate deduplication key
     */
    private getDedupeKey(agentId: string, type: DispatchTaskType, missionId?: string): string {
        return `${agentId}:${type}:${missionId || 'none'}`;
    }

    /**
     * Find task by deduplication key
     */
    private findTaskByDedupeKey(dedupeKey: string): DispatchTask | null {
        for (const task of this.tasks.values()) {
            const taskDedupeKey = this.getDedupeKey(
                task.agent_id,
                task.type,
                task.payload.mission_id
            );
            if (taskDedupeKey === dedupeKey) {
                return task;
            }
        }
        return null;
    }

    /**
     * Save tasks to disk
     */
    private save(): void {
        if (!this.config.persist_to_disk) return;

        try {
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const data = Array.from(this.tasks.values());
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`[TaskQueue:${this.instanceId}] Failed to save tasks:`, error);
        }
    }

    /**
     * Load tasks from disk
     */
    private load(): void {
        try {
            const dataDir = path.dirname(this.dataPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            if (!fs.existsSync(this.dataPath)) {
                console.log(`[TaskQueue:${this.instanceId}] No existing tasks file, starting fresh`);
                return;
            }

            const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
            this.tasks = new Map(
                data.map((t: any) => [
                    t.id,
                    {
                        ...t,
                        created_at: new Date(t.created_at),
                        expires_at: new Date(t.expires_at),
                        acknowledged_at: t.acknowledged_at ? new Date(t.acknowledged_at) : undefined
                    }
                ])
            );

            console.log(`[TaskQueue:${this.instanceId}] Loaded ${this.tasks.size} tasks from disk`);
        } catch (error) {
            console.error('[TaskQueue] Failed to load tasks:', error);
        }
    }
}
