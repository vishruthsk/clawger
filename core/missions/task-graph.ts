/**
 * Task Graph
 * 
 * Directed Acyclic Graph (DAG) data structure for crew mission subtasks.
 * Manages task dependencies, validation, and progress tracking.
 */

import { SubTask, SubTaskStatus } from '../types';

export class TaskGraph {
    private nodes: Map<string, SubTask> = new Map();
    private edges: Map<string, string[]> = new Map(); // task_id -> dependent_task_ids

    constructor() { }

    /**
     * Add a subtask node to the graph
     */
    addNode(task: SubTask): void {
        if (this.nodes.has(task.id)) {
            throw new Error(`Task ${task.id} already exists in graph`);
        }
        this.nodes.set(task.id, task);

        // Initialize edges for this node
        if (!this.edges.has(task.id)) {
            this.edges.set(task.id, []);
        }

        // Build reverse edges from dependencies
        task.dependencies.forEach(depId => {
            if (!this.edges.has(depId)) {
                this.edges.set(depId, []);
            }
            const dependents = this.edges.get(depId)!;
            if (!dependents.includes(task.id)) {
                dependents.push(task.id);
            }
        });
    }

    /**
     * Add a dependency edge: taskId depends on dependencyId
     */
    addDependency(taskId: string, dependencyId: string): void {
        if (!this.nodes.has(taskId)) {
            throw new Error(`Task ${taskId} not found`);
        }
        if (!this.nodes.has(dependencyId)) {
            throw new Error(`Dependency task ${dependencyId} not found`);
        }

        const task = this.nodes.get(taskId)!;
        if (!task.dependencies.includes(dependencyId)) {
            task.dependencies.push(dependencyId);
        }

        // Update edges (reverse mapping for efficient queries)
        const dependents = this.edges.get(dependencyId) || [];
        if (!dependents.includes(taskId)) {
            dependents.push(taskId);
            this.edges.set(dependencyId, dependents);
        }
    }

    /**
     * Check if adding a dependency would create a cycle
     */
    wouldCreateCycle(taskId: string, dependencyId: string): boolean {
        // Use DFS to detect cycles
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            if (recursionStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const task = this.nodes.get(nodeId);
            if (task) {
                for (const depId of task.dependencies) {
                    if (hasCycle(depId)) return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        // Temporarily add the edge and check
        const originalDeps = this.nodes.get(taskId)?.dependencies || [];
        const task = this.nodes.get(taskId);
        if (task) {
            task.dependencies = [...originalDeps, dependencyId];
            const result = hasCycle(taskId);
            task.dependencies = originalDeps;
            return result;
        }

        return false;
    }

    /**
     * Validate the entire graph (no cycles, all nodes reachable)
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check for cycles using topological sort (Kahn's algorithm)
        // in-degree = number of dependencies a task has (tasks it must wait for)
        const inDegree = new Map<string, number>();

        // Initialize in-degree for all nodes
        this.nodes.forEach((task, id) => {
            inDegree.set(id, task.dependencies.length);
        });

        // Start with tasks that have no dependencies
        const queue: string[] = [];
        inDegree.forEach((degree, id) => {
            if (degree === 0) queue.push(id);
        });

        const sorted: string[] = [];
        while (queue.length > 0) {
            const id = queue.shift()!;
            sorted.push(id);

            // For each task that depends on this one
            const dependents = this.edges.get(id) || [];
            dependents.forEach((depId) => {
                const newDegree = (inDegree.get(depId) || 0) - 1;
                inDegree.set(depId, newDegree);
                if (newDegree === 0) {
                    queue.push(depId);
                }
            });
        }

        if (sorted.length !== this.nodes.size) {
            errors.push('Graph contains cycles');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get tasks that are ready to be claimed (dependencies completed)
     */
    getAvailableTasks(): SubTask[] {
        const available: SubTask[] = [];

        this.nodes.forEach((task) => {
            if (task.status !== 'available') return;

            // Check if all dependencies are completed
            const depsCompleted = task.dependencies.every((depId) => {
                const dep = this.nodes.get(depId);
                return dep?.status === 'completed';
            });

            if (depsCompleted) {
                available.push(task);
            }
        });

        return available;
    }

    /**
     * Check if a task can be claimed
     */
    canClaimTask(taskId: string): { canClaim: boolean; reason?: string } {
        const task = this.nodes.get(taskId);
        if (!task) {
            return { canClaim: false, reason: 'Task not found' };
        }

        if (task.status !== 'available') {
            return { canClaim: false, reason: `Task is ${task.status}` };
        }

        // Check dependencies
        for (const depId of task.dependencies) {
            const dep = this.nodes.get(depId);
            if (!dep || dep.status !== 'completed') {
                return {
                    canClaim: false,
                    reason: `Dependency task ${depId} not completed`
                };
            }
        }

        return { canClaim: true };
    }

    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: SubTaskStatus, agentId?: string): void {
        const task = this.nodes.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        task.status = status;

        if (status === 'claimed' || status === 'in_progress') {
            task.assigned_agent = agentId;
            task.started_at = task.started_at || new Date();
        }

        if (status === 'completed') {
            task.completed_at = new Date();
        }
    }

    /**
     * Calculate overall progress
     */
    getProgress(): {
        total: number;
        available: number;
        claimed: number;
        in_progress: number;
        completed: number;
        blocked: number;
        percentage: number;
    } {
        const stats = {
            total: this.nodes.size,
            available: 0,
            claimed: 0,
            in_progress: 0,
            completed: 0,
            blocked: 0,
            percentage: 0
        };

        this.nodes.forEach((task) => {
            switch (task.status) {
                case 'available':
                    stats.available++;
                    break;
                case 'claimed':
                    stats.claimed++;
                    break;
                case 'in_progress':
                    stats.in_progress++;
                    break;
                case 'completed':
                    stats.completed++;
                    break;
                case 'blocked':
                    stats.blocked++;
                    break;
            }
        });

        stats.percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

        return stats;
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): SubTask | null {
        return this.nodes.get(taskId) || null;
    }

    /**
     * Get all tasks
     */
    getAllTasks(): SubTask[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Serialize to JSON-compatible format
     */
    toJSON(): { nodes: { [key: string]: any }; edges: { [key: string]: string[] } } {
        const nodes: { [key: string]: any } = {};
        this.nodes.forEach((task, id) => {
            nodes[id] = { ...task };
        });

        const edges: { [key: string]: string[] } = {};
        this.edges.forEach((dependents, id) => {
            edges[id] = [...dependents];
        });

        return { nodes, edges };
    }

    /**
     * Deserialize from JSON
     */
    static fromJSON(data: { nodes: { [key: string]: any }; edges: { [key: string]: string[] } }): TaskGraph {
        const graph = new TaskGraph();

        // Add nodes
        Object.entries(data.nodes).forEach(([id, taskData]) => {
            graph.nodes.set(id, {
                ...taskData,
                started_at: taskData.started_at ? new Date(taskData.started_at) : undefined,
                completed_at: taskData.completed_at ? new Date(taskData.completed_at) : undefined
            });
        });

        // Add edges
        Object.entries(data.edges).forEach(([id, dependents]) => {
            graph.edges.set(id, [...dependents]);
        });

        return graph;
    }
}
