import * as fs from 'fs';
import * as path from 'path';

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
    private dataDir: string;
    private historyFile: string;
    private histories: Map<string, AgentJobHistory>;

    constructor(dataDir: string = './data') {
        this.dataDir = dataDir;
        this.historyFile = path.join(dataDir, 'job-history.json');
        this.histories = new Map();
        this.load();
    }

    /**
     * Record a job outcome with idempotency
     * This is the SINGLE source of truth for history updates
     */
    recordJobOutcome(agentId: string, entry: JobHistoryEntry): void {
        const history = this.getOrCreateHistory(agentId);

        // Idempotency check
        // If entry_id is not provided, generate it
        const entryId = entry.entry_id || `${entry.mission_id}:${entry.subtask_id || 'solo'}`;
        entry.entry_id = entryId;

        // Check if entry already exists
        const exists = history.jobs.some(j => j.entry_id === entryId);
        if (exists) {
            console.log(`[JobHistory] Skipping duplicate entry for ${agentId}: ${entryId}`);
            return;
        }

        // Add entry
        history.jobs.push(entry);

        // Update total earnings
        history.total_earnings += entry.reward;

        // Sort by date desc
        history.jobs.sort((a, b) =>
            new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        );

        this.histories.set(agentId, history);
        this.save();

        console.log(`[JobHistory] Recorded ${entry.outcome} for ${agentId}: ${entry.mission_title} (+${entry.reward})`);
    }

    /**
     * @deprecated Use recordJobOutcome instead
     */
    addEntry(agentId: string, entry: JobHistoryEntry): void {
        this.recordJobOutcome(agentId, entry);
    }

    /**
     * Get history for an agent
     */
    getHistory(agentId: string): AgentJobHistory {
        this.load(); // Force reload to get latest data from other processes/instances
        return this.getOrCreateHistory(agentId);
    }

    /**
     * Get history entry count
     */
    getJobCount(agentId: string): number {
        return this.getOrCreateHistory(agentId).jobs.length;
    }

    /**
     * Get number of collaborations between agent and requester
     */
    getCollaborationCount(agentId: string, requesterId: string): number {
        const history = this.getOrCreateHistory(agentId);
        return history.jobs.filter(j => j.requester_id === requesterId).length;
    }

    /**
     * Get total earnings
     */
    getTotalEarnings(agentId: string): number {
        return this.getOrCreateHistory(agentId).total_earnings;
    }

    /**
     * Get recent jobs
     */
    getRecentJobs(agentId: string, limit: number = 10): JobHistoryEntry[] {
        const history = this.getOrCreateHistory(agentId);
        // Jobs are already sorted by date desc on insertion
        return history.jobs.slice(0, limit);
    }

    /**
     * Get all job outcomes for an agent (for success rate calculation)
     */
    getJobOutcomes(agentId: string): JobHistoryEntry[] {
        return this.getOrCreateHistory(agentId).jobs;
    }


    private getOrCreateHistory(agentId: string): AgentJobHistory {
        if (!this.histories.has(agentId)) {
            this.histories.set(agentId, {
                agent_id: agentId,
                total_earnings: 0,
                jobs: []
            });
        }
        return this.histories.get(agentId)!;
    }

    private load(): void {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf8');
                const json = JSON.parse(data);

                // Convert array to map
                if (Array.isArray(json)) {
                    json.forEach((h: AgentJobHistory) => {
                        this.histories.set(h.agent_id, h);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load job history:', error);
            // Initialize empty if failed
            this.histories = new Map();
        }
    }

    private save(): void {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            const data = Array.from(this.histories.values());
            fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save job history:', error);
        }
    }
}

