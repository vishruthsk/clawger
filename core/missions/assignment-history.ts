/**
 * Assignment History Tracker
 * 
 * Tracks recent mission assignments per agent for anti-monopoly fairness.
 * Persists to disk for durability across restarts.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AssignmentRecord {
    mission_id: string;
    assigned_at: Date;
}

export interface AgentAssignmentHistory {
    agent_id: string;
    recent_assignments: AssignmentRecord[];
}

export class AssignmentHistoryTracker {
    private history: Map<string, AssignmentRecord[]> = new Map();
    private persistencePath: string;
    private readonly WINDOW_SIZE = 10; // Track last 10 assignments

    constructor(persistenceDir: string = './data') {
        this.persistencePath = path.join(persistenceDir, 'assignment-history.json');
        this.load();
    }

    /**
     * Record a new assignment
     */
    recordAssignment(agentId: string, missionId: string): void {
        const records = this.history.get(agentId) || [];

        records.push({
            mission_id: missionId,
            assigned_at: new Date()
        });

        // Keep only last WINDOW_SIZE assignments
        if (records.length > this.WINDOW_SIZE) {
            records.shift();
        }

        this.history.set(agentId, records);
        this.save();
    }

    /**
     * Get number of recent wins within a time window
     */
    getRecentWins(agentId: string, windowSize: number = this.WINDOW_SIZE): number {
        const records = this.history.get(agentId) || [];

        // Return count of assignments within window
        return Math.min(records.length, windowSize);
    }

    /**
     * Get all assignment records for an agent
     */
    getAgentHistory(agentId: string): AssignmentRecord[] {
        return this.history.get(agentId) || [];
    }

    /**
     * Get assignment statistics
     */
    getStats(): {
        total_agents: number;
        total_assignments: number;
        assignments_by_agent: Map<string, number>;
    } {
        const assignments_by_agent = new Map<string, number>();

        for (const [agentId, records] of this.history.entries()) {
            assignments_by_agent.set(agentId, records.length);
        }

        const total_assignments = Array.from(assignments_by_agent.values())
            .reduce((sum, count) => sum + count, 0);

        return {
            total_agents: this.history.size,
            total_assignments,
            assignments_by_agent
        };
    }

    /**
     * Clear history for an agent
     */
    clearAgentHistory(agentId: string): void {
        this.history.delete(agentId);
        this.save();
    }

    /**
     * Clear all history
     */
    clearAll(): void {
        this.history.clear();
        this.save();
    }

    /**
     * Persistence
     */
    private save(): void {
        if (!fs.existsSync(path.dirname(this.persistencePath))) {
            fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
        }

        const data = Array.from(this.history.entries()).map(([agentId, records]) => ({
            agent_id: agentId,
            recent_assignments: records
        }));

        fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    }

    private load(): void {
        if (fs.existsSync(this.persistencePath)) {
            try {
                const raw = fs.readFileSync(this.persistencePath, 'utf8');
                const data: AgentAssignmentHistory[] = JSON.parse(raw);

                for (const agentHistory of data) {
                    // Convert date strings back to Date objects
                    const records = agentHistory.recent_assignments.map(r => ({
                        mission_id: r.mission_id,
                        assigned_at: new Date(r.assigned_at)
                    }));
                    this.history.set(agentHistory.agent_id, records);
                }

                console.log(`[AssignmentHistory] Loaded ${this.history.size} agent histories from disk`);
            } catch (e) {
                console.error('[AssignmentHistory] Failed to load history from disk', e);
            }
        }
    }
}
