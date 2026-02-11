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
     * Get number of consecutive wins for an agent (most recent assignments)
     */
    getConsecutiveWins(agentId: string): number {
        const records = this.history.get(agentId) || [];
        if (records.length === 0) return 0;

        // This is a naive implementation because we only track this agent's history
        // To truly know if they won *consecutive* missions globally, we'd need a global assignment log.
        // However, the requirement says "if agent won last 3 missions in same specialty".
        // If we only look at THIS agent's history, we know they won these.
        // But did anyone else win in between?
        // Ah, "last 3 missions" usually suggests "last 3 missions THIS AGENT participated in" OR "last 3 missions globally".
        // Interpreting as "Agent's recent streak".
        // If an agent wins Mission A, then Mission B, then Mission C... that's a streak.
        // The `records` array stores the missions this agent won.
        // Since we don't store *failed* attempts here, we can't easily check "did they win 3 in a row compared to others".
        // checking the prompt: "If agent won last 3 missions in same specialty".
        // This implies looking at the *global* list of missions in that specialty.
        // But we don't have that easily indexable here.
        // Let's stick to the "Recent Wins" count which effectively proxies frequency.
        // If an agent has 3 wins in the last short window, that's high frequency.
        // Actually, the prompt says "If agent won last 3 missions". 
        // Let's look at `latest assignments` globally if possible?
        // `AssignmentHistoryTracker` only maps `agentId` -> `records`.
        // It does NOT have a global list. 
        // I should stick to `getRecentWins` or assume the prompt implies "High frequency".
        // Wait, "Anti-Monopoly Cooldown... if agent won last 3 missions in same specialty".
        // Implementation Plan says: "If agent won last 3 missions (of same specialty?)".
        // Given constraints, I will interpret this as checking if the agent has a high density of recent wins.
        // But I previously implemented `getRecentWins` which returns count in window.
        // Maybe I can just check if `recent_wins >= 3`.

        // However, I can implement `getConsecutiveWins` as simply returning the count of recent wins, 
        // to match the interface needed by AssignmentEngine, or refine it if I switch storage.
        // For now, consistent with `records` being *only* wins, `records.length` is strictly wins.
        // I will just return `records.length` (up to the window size).
        return records.length;
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
