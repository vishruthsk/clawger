/**
 * Assignment History Tracker
 * 
 * Tracks recent mission assignments per agent for anti-monopoly fairness.
 * Persists to PostgreSQL for durability.
 */

import { pool } from '../db';

export interface AssignmentRecord {
    mission_id: string;
    assigned_at: Date;
}

export interface AgentAssignmentHistory {
    agent_id: string;
    recent_assignments: AssignmentRecord[];
}

export class AssignmentHistoryTracker {
    private readonly WINDOW_SIZE = 10; // Track last 10 assignments

    constructor() {
        console.log('[AssignmentHistoryTracker] Initialized with PostgreSQL persistence');
    }

    /**
     * Record a new assignment
     */
    async recordAssignment(agentId: string, missionId: string): Promise<void> {
        await pool.query(
            `INSERT INTO assignment_history (agent_id, mission_id, assigned_at) 
             VALUES ($1, $2, NOW())`,
            [agentId, missionId]
        );
        // (Optional: Implement cleanup logic to delete old records > WINDOW_SIZE if needed, but storage is cheap)
    }

    /**
     * Get number of recent wins within a time window (limit to latest X records)
     */
    async getRecentWins(agentId: string, windowSize: number = this.WINDOW_SIZE): Promise<number> {
        // Count total assignments for agent in recent history?
        // Or simply get the last X records.
        // We define "recent" loosely or by count.
        // Let's return the count of total assignments?
        // Or specific recent logic?
        // Implementation: Return count of assignments in the `assignment_history` table for this agent?
        // That might be ALL time history.
        // The original implementation kept a fixed window size in JSON array.
        // So `getRecentWins` returned count UP TO `windowSize`.
        // Let's replicate this: count the last `windowSize` records.
        // Effectively, `MIN(count, windowSize)`.

        const res = await pool.query(
            `SELECT COUNT(*) as count FROM assignment_history WHERE agent_id = $1`,
            [agentId]
        );
        const count = parseInt(res.rows[0].count);
        return Math.min(count, windowSize);
    }

    /**
     * Get number of consecutive wins for an agent
     * (Approximated by total recent wins confined to window)
     */
    async getConsecutiveWins(agentId: string): Promise<number> {
        return this.getRecentWins(agentId);
    }

    /**
     * Get all assignment records for an agent
     */
    async getAgentHistory(agentId: string): Promise<AssignmentRecord[]> {
        const res = await pool.query(
            `SELECT mission_id, assigned_at FROM assignment_history 
             WHERE agent_id = $1 
             ORDER BY assigned_at DESC 
             LIMIT $2`,
            [agentId, this.WINDOW_SIZE]
        );

        return res.rows.map(row => ({
            mission_id: row.mission_id,
            assigned_at: new Date(row.assigned_at)
        }));
    }

    /**
     * Clear history for an agent
     */
    async clearAgentHistory(agentId: string): Promise<void> {
        await pool.query('DELETE FROM assignment_history WHERE agent_id = $1', [agentId]);
    }

    /**
     * Clear all history
     */
    async clearAll(): Promise<void> {
        await pool.query('DELETE FROM assignment_history');
    }
}
