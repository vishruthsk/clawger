/**
 * Crew Mission Store
 * 
 * Manages crew-specific operations for multi-agent missions:
 * - Task graph management
 * - Crew member lifecycle
 * - Artifact storage
 * - Event stream logging
 * - Blocker tracking
 */

import * as fs from 'fs';
import * as path from 'path';
import { Mission } from './mission-store';
import { TaskGraph } from './task-graph';
import {
    SubTask,
    MissionArtifact,
    MissionEvent,
    Blocker,
    CrewAssignment
} from '../types';

export class CrewMissionStore {
    private readonly dataDir: string;
    private readonly artifactsDir: string;

    constructor(dataDir: string = './data') {
        this.dataDir = dataDir;
        this.artifactsDir = path.join(dataDir, 'artifacts');
        this.ensureDirectories();
    }

    private ensureDirectories(): void {
        if (!fs.existsSync(this.artifactsDir)) {
            fs.mkdirSync(this.artifactsDir, { recursive: true });
        }
    }

    /**
     * Initialize crew for a mission
     */
    initializeCrew(mission: Mission, crewConfig: {
        min_agents: number;
        max_agents: number;
        required_roles: string[];
        coordination_mode: 'sequential' | 'parallel' | 'hybrid';
    }): void {
        mission.crew_config = crewConfig;
        mission.crew_assignments = [];
        mission.mission_artifacts = [];
        mission.event_stream = [];
        mission.blockers = [];
    }

    /**
     * Add crew member to mission
     */
    addCrewMember(mission: Mission, agentId: string, agentName: string, role: string): CrewAssignment {
        if (!mission.crew_required) {
            throw new Error('Mission is not a crew mission');
        }

        if (!mission.crew_assignments) {
            mission.crew_assignments = [];
        }

        // Check if agent already in crew
        const existing = mission.crew_assignments.find(c => c.agent_id === agentId);
        if (existing) {
            throw new Error(`Agent ${agentId} already in crew`);
        }

        // Check crew size limits
        if (mission.crew_config && mission.crew_assignments.length >= mission.crew_config.max_agents) {
            throw new Error('Crew is full');
        }

        const assignment: CrewAssignment = {
            agent_id: agentId,
            agent_name: agentName,
            role,
            current_tasks: [],
            joined_at: new Date(),
            status: 'idle'
        };

        mission.crew_assignments.push(assignment);

        // Log event
        this.addEvent(mission, {
            type: 'crew_joined',
            agent_id: agentId,
            details: { role }
        });

        return assignment;
    }

    /**
     * Remove crew member (drop out)
     */
    removeCrewMember(mission: Mission, agentId: string, reason: string): void {
        if (!mission.crew_assignments) return;

        const index = mission.crew_assignments.findIndex(c => c.agent_id === agentId);
        if (index === -1) {
            throw new Error(`Agent ${agentId} not in crew`);
        }

        const assignment = mission.crew_assignments[index];
        assignment.status = 'dropped';

        // Log event
        this.addEvent(mission, {
            type: 'crew_left',
            agent_id: agentId,
            details: { reason }
        });

        // Handle reassignment of current tasks
        if (assignment.current_tasks.length > 0 && mission.task_graph) {
            const graph = TaskGraph.fromJSON(mission.task_graph);
            assignment.current_tasks.forEach(taskId => {
                graph.updateTaskStatus(taskId, 'available');
            });
            mission.task_graph = graph.toJSON();
        }
    }

    /**
     * Claim a subtask
     */
    claimSubTask(
        mission: Mission,
        taskId: string,
        agentId: string,
        expectedStatus: string = 'available'
    ): { success: boolean; reason?: string } {
        if (!mission.task_graph) {
            return { success: false, reason: 'No task graph found' };
        }

        const graph = TaskGraph.fromJSON(mission.task_graph);
        const task = graph.getTask(taskId);

        if (!task) {
            return { success: false, reason: 'Task not found' };
        }

        // Optimistic locking check
        if (task.status !== expectedStatus) {
            return {
                success: false,
                reason: `Task status changed (expected: ${expectedStatus}, actual: ${task.status})`
            };
        }

        // Check if agent can claim
        const canClaim = graph.canClaimTask(taskId);
        if (!canClaim.canClaim) {
            return { success: false, reason: canClaim.reason };
        }

        // Check if agent is in crew
        if (!mission.crew_assignments?.find(c => c.agent_id === agentId)) {
            return { success: false, reason: 'Agent not in crew' };
        }

        // Claim the task
        graph.updateTaskStatus(taskId, 'claimed', agentId);
        mission.task_graph = graph.toJSON();

        // Update crew assignment
        const assignment = mission.crew_assignments.find(c => c.agent_id === agentId);
        if (assignment) {
            assignment.current_tasks.push(taskId);
            assignment.status = 'active';
        }

        // Log event
        this.addEvent(mission, {
            type: 'task_claimed',
            agent_id: agentId,
            subtask_id: taskId,
            details: { task_description: task.description }
        });

        return { success: true };
    }

    /**
     * Complete a subtask
     */
    completeSubTask(mission: Mission, taskId: string, agentId: string): { success: boolean; reason?: string } {
        if (!mission.task_graph) {
            return { success: false, reason: 'No task graph found' };
        }

        const graph = TaskGraph.fromJSON(mission.task_graph);
        const task = graph.getTask(taskId);

        if (!task) {
            return { success: false, reason: 'Task not found' };
        }

        if (task.assigned_agent !== agentId) {
            return { success: false, reason: 'Task not assigned to this agent' };
        }

        if (task.status !== 'in_progress' && task.status !== 'claimed') {
            return { success: false, reason: `Cannot complete task with status: ${task.status}` };
        }

        // Mark as completed
        graph.updateTaskStatus(taskId, 'completed');
        mission.task_graph = graph.toJSON();

        // Update crew assignment
        const assignment = mission.crew_assignments?.find(c => c.agent_id === agentId);
        if (assignment) {
            assignment.current_tasks = assignment.current_tasks.filter(id => id !== taskId);
            if (assignment.current_tasks.length === 0) {
                assignment.status = 'idle';
            }
        }

        // Log event
        this.addEvent(mission, {
            type: 'task_completed',
            agent_id: agentId,
            subtask_id: taskId,
            details: { task_description: task.description }
        });

        return { success: true };
    }

    /**
     * Add artifact to mission
     */
    addArtifact(
        mission: Mission,
        subtaskId: string,
        agentId: string,
        url: string,
        type: string,
        metadata: Record<string, any> = {},
        description?: string
    ): MissionArtifact {
        if (!mission.mission_artifacts) {
            mission.mission_artifacts = [];
        }

        const artifact: MissionArtifact = {
            id: `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            subtask_id: subtaskId,
            agent_id: agentId,
            url,
            type,
            uploaded_at: new Date(),
            metadata,
            description
        };

        mission.mission_artifacts.push(artifact);

        // Update task graph to include artifact
        if (mission.task_graph) {
            const graph = TaskGraph.fromJSON(mission.task_graph);
            const task = graph.getTask(subtaskId);
            if (task) {
                task.artifacts.push(artifact.id);
                mission.task_graph = graph.toJSON();
            }
        }

        // Log event
        this.addEvent(mission, {
            type: 'artifact_uploaded',
            agent_id: agentId,
            subtask_id: subtaskId,
            details: {
                artifact_id: artifact.id,
                type,
                url
            }
        });

        return artifact;
    }

    /**
     * Add blocker
     */
    addBlocker(
        mission: Mission,
        agentId: string,
        subtaskId: string,
        description: string,
        severity: 'low' | 'medium' | 'high'
    ): Blocker {
        if (!mission.blockers) {
            mission.blockers = [];
        }

        const blocker: Blocker = {
            id: `blocker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            agent_id: agentId,
            subtask_id: subtaskId,
            description,
            severity,
            reported_at: new Date(),
            resolved: false
        };

        mission.blockers.push(blocker);

        // Update task status to blocked
        if (mission.task_graph) {
            const graph = TaskGraph.fromJSON(mission.task_graph);
            graph.updateTaskStatus(subtaskId, 'blocked');
            mission.task_graph = graph.toJSON();
        }

        // Log event
        this.addEvent(mission, {
            type: 'blocker_added',
            agent_id: agentId,
            subtask_id: subtaskId,
            details: {
                blocker_id: blocker.id,
                severity,
                description
            }
        });

        return blocker;
    }

    /**
     * Resolve blocker
     */
    resolveBlocker(mission: Mission, blockerId: string, resolution: string): void {
        if (!mission.blockers) return;

        const blocker = mission.blockers.find(b => b.id === blockerId);
        if (!blocker) {
            throw new Error('Blocker not found');
        }

        blocker.resolved = true;
        blocker.resolved_at = new Date();
        blocker.resolution = resolution;

        // Update task status back to available/claimed
        if (mission.task_graph) {
            const graph = TaskGraph.fromJSON(mission.task_graph);
            const task = graph.getTask(blocker.subtask_id);
            if (task && task.assigned_agent) {
                graph.updateTaskStatus(blocker.subtask_id, 'claimed');
            } else if (task) {
                graph.updateTaskStatus(blocker.subtask_id, 'available');
            }
            mission.task_graph = graph.toJSON();
        }

        // Log event
        this.addEvent(mission, {
            type: 'blocker_resolved',
            subtask_id: blocker.subtask_id,
            details: {
                blocker_id: blockerId,
                resolution
            }
        });
    }

    /**
     * Add event to mission event stream
     */
    private addEvent(
        mission: Mission,
        event: {
            type: string;
            agent_id?: string;
            subtask_id?: string;
            details: Record<string, any>;
        }
    ): void {
        if (!mission.event_stream) {
            mission.event_stream = [];
        }

        mission.event_stream.push({
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: event.type,
            timestamp: new Date(),
            agent_id: event.agent_id,
            subtask_id: event.subtask_id,
            details: event.details
        });
    }

    /**
     * Get mission state summary
     */
    getMissionState(mission: Mission): {
        crew_members: CrewAssignment[];
        task_progress: any;
        artifacts: MissionArtifact[];
        blockers: Blocker[];
        recent_events: any[];
    } {
        let taskProgress = null;
        if (mission.task_graph) {
            const graph = TaskGraph.fromJSON(mission.task_graph);
            taskProgress = graph.getProgress();
        }

        return {
            crew_members: mission.crew_assignments || [],
            task_progress: taskProgress,
            artifacts: mission.mission_artifacts || [],
            blockers: mission.blockers?.filter(b => !b.resolved) || [],
            recent_events: (mission.event_stream || []).slice(-20).reverse()
        };
    }
}
