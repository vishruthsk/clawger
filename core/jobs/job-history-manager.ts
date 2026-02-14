import { pool } from '../db';

export interface JobHistoryEntry {
    mission_id: string;
    mission_title: string;
    reward: number;
    completed_at: string; // ISO date string
    type: 'solo' | 'crew' | 'direct_hire';
    outcome: 'PASS' | 'FAIL';
    rating?: number;
    role?: string; // For crew missions
    subtask_id?: string; // For subtasks
    entry_id?: string;   // For idempotency
    requester_id?: string; // For anti-farming checks
}

export interface AgentJobHistory {
    agent_id: string;
    total_earnings: number;
    jobs: JobHistoryEntry[];
}

export class JobHistoryManager {

    constructor() {
        console.log('[JobHistoryManager] Initialized with PostgreSQL persistence');
    }

    /**
     * Record a job outcome with idempotency
     * This updates the `tasks` table and `job_reviews` table.
     */
    async recordJobOutcome(agentId: string, entry: JobHistoryEntry): Promise<void> {
        // If entry_id is not provided, generate it
        const entryId = entry.entry_id || `${entry.mission_id}:${entry.subtask_id || 'solo'}`;
        entry.entry_id = entryId;

        console.log(`[JobHistory] Recording ${entry.outcome} for ${agentId}: ${entry.mission_title} (+${entry.reward})`);

        // Update Task table (assuming task already exists, update status)
        // Or insert if not exists (for sidecar simulation)
        // Note: The indexer populates 'tasks'. Here we are updating it with 'completed' status potentially.
        // We assume mission_id corresponds to task.id for simplicity in this MVP 
        // OR we map mission_id -> task.mission_id ??? 
        // Indexer schema: id (primary key), mission_id (foreign/relational)

        // For off-chain simulation, we will treat 'entry.mission_id' as task ID.

        await pool.query(`
            INSERT INTO tasks (
                id, worker, reward, status, completed_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                worker = EXCLUDED.worker,
                reward = EXCLUDED.reward,
                status = EXCLUDED.status,
                completed_at = NOW(),
                updated_at = NOW()
        `, [
            entry.mission_id,
            agentId,
            entry.reward,
            entry.outcome === 'PASS' ? 'verified' : 'failed'
        ]);

        // Record Review if rating exists
        if (entry.rating) {
            await pool.query(`
                INSERT INTO job_reviews (mission_id, agent_id, rating)
                VALUES ($1, $2, $3)
                ON CONFLICT (mission_id) DO UPDATE SET rating = EXCLUDED.rating
            `, [entry.mission_id, agentId, entry.rating]);
        }

        // Update Agent Stats (increment jobs, add earnings) - Redundant if AgentReputation does it?
        // But JobHistory is used for history retrieval.
        // We will query history dynamically, so no need to store aggregated stats in a file.
    }

    /**
     * @deprecated Use recordJobOutcome instead
     */
    async addEntry(agentId: string, entry: JobHistoryEntry): Promise<void> {
        await this.recordJobOutcome(agentId, entry);
    }

    /**
     * Get history for an agent
     */
    async getHistory(agentId: string): Promise<AgentJobHistory> {
        // Fetch tasks
        const tasksRes = await pool.query(`
            SELECT t.*, r.rating 
            FROM tasks t
            LEFT JOIN job_reviews r ON t.id = r.mission_id
            WHERE t.worker = $1 AND (t.status = 'verified' OR t.status = 'failed')
            ORDER BY t.completed_at DESC
        `, [agentId]);

        const jobs: JobHistoryEntry[] = tasksRes.rows.map(row => ({
            mission_id: row.id,
            mission_title: row.result_cid || 'Untitled Mission', // Using result_cid as title placeholder or fetch from mission store?
            reward: parseFloat(row.reward),
            completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : new Date().toISOString(),
            type: 'solo', // Default for now, column not in tasks table yet
            outcome: row.status === 'verified' ? 'PASS' : 'FAIL',
            rating: row.rating,
            requester_id: row.requester
        }));

        const totalEarnings = jobs.reduce((sum, j) => sum + (j.outcome === 'PASS' ? j.reward : 0), 0);

        return {
            agent_id: agentId,
            total_earnings: totalEarnings,
            jobs: jobs
        };
    }

    /**
     * Get history entry count
     */
    async getJobCount(agentId: string): Promise<number> {
        const res = await pool.query("SELECT count(*) as count FROM tasks WHERE worker = $1 AND (status = 'verified' OR status = 'failed')", [agentId]);
        return parseInt(res.rows[0].count);
    }

    /**
     * Get number of collaborations between agent and requester
     */
    async getCollaborationCount(agentId: string, requesterId: string): Promise<number> {
        const res = await pool.query("SELECT count(*) as count FROM tasks WHERE worker = $1 AND requester = $2", [agentId, requesterId]);
        return parseInt(res.rows[0].count);
    }

    /**
     * Get total earnings
     */
    async getTotalEarnings(agentId: string): Promise<number> {
        const res = await pool.query("SELECT SUM(reward) as total FROM tasks WHERE worker = $1 AND status = 'verified'", [agentId]);
        return res.rows[0].total ? parseFloat(res.rows[0].total) : 0;
    }

    /**
     * Get recent jobs
     */
    async getRecentJobs(agentId: string, limit: number = 10): Promise<JobHistoryEntry[]> {
        const history = await this.getHistory(agentId);
        return history.jobs.slice(0, limit);
    }

    /**
     * Get all job outcomes for an agent (for success rate calculation)
     */
    async getJobOutcomes(agentId: string): Promise<JobHistoryEntry[]> {
        const history = await this.getHistory(agentId);
        return history.jobs;
    }
}
