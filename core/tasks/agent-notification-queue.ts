/**
 * Agent Notification Queue
 * Manages notifications and tasks for autonomous agents (separate from assignment queue)
 */

export type AgentTaskType =
    | 'review_submissions'    // New submissions on agent's posted jobs
    | 'mission_available'     // New mission matching agent skills
    | 'checkpoint_review'     // Checkpoint needs Pilot approval
    | 'payout_received'       // Payment completed
    | 'system_message'        // General notifications
    | 'urgent_task';          // High-priority task assigned

export type AgentTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface AgentTask {
    id: string;
    agent_id: string;
    type: AgentTaskType;
    data: Record<string, any>;
    priority: AgentTaskPriority;
    created_at: Date;
    completed_at?: Date;
    status: 'pending' | 'completed';
}

export class AgentNotificationQueue {
    private tasks: Map<string, AgentTask> = new Map();

    /**
     * Create a new task for an agent
     */
    createTask(
        agentId: string,
        type: AgentTaskType,
        data: Record<string, any>,
        priority: AgentTaskPriority = 'normal'
    ): AgentTask {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const task: AgentTask = {
            id: taskId,
            agent_id: agentId,
            type,
            data,
            priority,
            created_at: new Date(),
            status: 'pending'
        };

        this.tasks.set(taskId, task);
        return task;
    }

    /**
     * Get all pending tasks for an agent
     */
    getTasksForAgent(agentId: string): AgentTask[] {
        return Array.from(this.tasks.values())
            .filter(t => t.agent_id === agentId && t.status === 'pending')
            .sort((a, b) => {
                // Sort by priority first
                const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;

                // Then by creation time
                return a.created_at.getTime() - b.created_at.getTime();
            });
    }

    /**
     * Mark a task as completed
     */
    completeTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task) return false;

        task.status = 'completed';
        task.completed_at = new Date();
        return true;
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): AgentTask | null {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Clear completed tasks older than X days
     */
    clearOldTasks(daysOld: number = 7): number {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysOld);

        let cleared = 0;
        for (const [id, task] of this.tasks.entries()) {
            if (task.status === 'completed' && task.completed_at && task.completed_at < cutoff) {
                this.tasks.delete(id);
                cleared++;
            }
        }

        return cleared;
    }

    /**
     * Get task count by priority for an agent
     */
    getTaskStats(agentId: string): Record<AgentTaskPriority, number> {
        const tasks = this.getTasksForAgent(agentId);
        return {
            urgent: tasks.filter(t => t.priority === 'urgent').length,
            high: tasks.filter(t => t.priority === 'high').length,
            normal: tasks.filter(t => t.priority === 'normal').length,
            low: tasks.filter(t => t.priority === 'low').length
        };
    }
}
