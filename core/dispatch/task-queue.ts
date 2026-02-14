/**
 * Task Queue System
 * 
 * Centralized queue for dispatching tasks to agents with priority handling,
 * deduplication, and expiration.
 */

import { pool } from '../db';

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
}

const DEFAULT_CONFIG: TaskQueueConfig = {
    expiration_hours: 24,
    max_tasks_per_agent: 100
};

export class TaskQueue {
    private config: TaskQueueConfig;

    constructor(config?: Partial<TaskQueueConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[TaskQueue] Initialized with PostgreSQL persistence');
    }

    /**
     * Enqueue a new task with deduplication
     */
    async enqueue(params: {
        agent_id: string;
        type: DispatchTaskType;
        priority: DispatchTaskPriority;
        payload: DispatchTask['payload'];
        expires_in_hours?: number;
    }): Promise<DispatchTask> {
        // Deduplication: Check if similar unacknowledged task exists
        // We can do this with a query logic on payload->mission_id if exists/relevant
        // or just rely on manual unique checks if strict strictness needed.
        // For now, let's implement the dedupe check:
        // "Find task for same agent, same type, same mission_id, not acknowledged"

        const missionId = params.payload.mission_id;
        if (missionId) {
            const res = await pool.query(
                `SELECT id FROM dispatch_tasks 
                 WHERE agent_id = $1 AND type = $2 AND payload->>'mission_id' = $3 AND acknowledged = false`,
                [params.agent_id, params.type, missionId]
            );

            if (res.rows.length > 0) {
                console.log(`[TaskQueue] Duplicate task detected, skipping: ${params.agent_id}:${params.type}:${missionId}`);
                // Should ideally return the existing task, fetching full row
                const existing = await this.getTask(res.rows[0].id);
                return existing!;
            }
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

        await pool.query(
            `INSERT INTO dispatch_tasks (
                id, agent_id, type, priority, payload, created_at, expires_at, acknowledged
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [taskId, task.agent_id, task.type, task.priority, JSON.stringify(task.payload), task.created_at, task.expires_at, false]
        );

        console.log(`[TaskQueue] ✅ ENQUEUED ${params.type} for agent ${params.agent_id}`);

        return task;
    }

    /**
     * Poll for pending tasks for an agent
     */
    async poll(agentId: string, limit: number = 10): Promise<{
        tasks: DispatchTask[];
        has_more: boolean;
    }> {
        // Priority ordering: urgent < high < normal < low
        // We can use CASE or just map to numbers in application code.
        // SQL sorting: 
        // ORDER BY 
        //   CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
        //   created_at ASC

        const res = await pool.query(
            `SELECT * FROM dispatch_tasks 
             WHERE agent_id = $1 AND acknowledged = false AND expires_at > NOW()
             ORDER BY 
               CASE priority 
                 WHEN 'urgent' THEN 1 
                 WHEN 'high' THEN 2 
                 WHEN 'normal' THEN 3 
                 WHEN 'low' THEN 4 
                 ELSE 5 
               END,
               created_at ASC
             LIMIT $2`,
            [agentId, limit + 1] // Fetch one extra to check has_more
        );

        const tasks = res.rows.slice(0, limit).map(row => this.hydrate(row));
        const has_more = res.rows.length > limit;

        return { tasks, has_more };
    }

    /**
     * Acknowledge tasks (mark as seen)
     */
    async acknowledge(taskIds: string[]): Promise<number> {
        if (taskIds.length === 0) return 0;

        const res = await pool.query(
            `UPDATE dispatch_tasks 
             SET acknowledged = true, acknowledged_at = NOW() 
             WHERE id = ANY($1) AND acknowledged = false`,
            [taskIds]
        );

        return res.rowCount || 0;
    }

    /**
     * Get task by ID
     */
    async getTask(taskId: string): Promise<DispatchTask | null> {
        const res = await pool.query('SELECT * FROM dispatch_tasks WHERE id = $1', [taskId]);
        if (res.rows.length === 0) return null;
        return this.hydrate(res.rows[0]);
    }

    /**
     * Cleanup expired tasks (Run periodically)
     * Returns count of deleted tasks
     */
    async cleanup(): Promise<{ deleted: number }> {
        const res = await pool.query(
            `DELETE FROM dispatch_tasks 
             WHERE expires_at < NOW() 
             OR (acknowledged = true AND acknowledged_at < NOW() - INTERVAL '7 days')`
        );

        return { deleted: res.rowCount || 0 };
    }

    private hydrate(row: any): DispatchTask {
        return {
            id: row.id,
            agent_id: row.agent_id,
            type: row.type,
            priority: row.priority,
            payload: row.payload, // JSONB is parsed automatically
            created_at: new Date(row.created_at),
            expires_at: new Date(row.expires_at),
            acknowledged: row.acknowledged,
            acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined
        };
    }
}
