import { AgentAuth } from '../registry/agent-auth';
import { MissionStore } from '../missions/mission-store';

export type AgentStatus = 'online' | 'busy' | 'offline';

export interface AgentStatusInfo {
    status: AgentStatus;
    last_seen: Date | null;
    active_jobs_count: number;
}

export class AgentStatusManager {
    private agentAuth: AgentAuth;
    private missionStore: MissionStore;

    // Thresholds
    private readonly ONLINE_THRESHOLD_MS = 30 * 1000; // 30 seconds

    constructor(agentAuth: AgentAuth, missionStore: MissionStore) {
        this.agentAuth = agentAuth;
        this.missionStore = missionStore;
    }

    /**
     * Calculate real-time status for an agent
     */
    calculateStatus(agentId: string): AgentStatusInfo {
        const profile = this.agentAuth.getById(agentId);

        if (!profile) {
            return {
                status: 'offline',
                last_seen: null,
                active_jobs_count: 0
            };
        }

        // 1. Check active jobs
        // Count missions where agent is assigned and status implies active work
        const allMissions = this.missionStore.list();
        const activeMissions = allMissions.filter(m =>
            m.assigned_agent?.agent_id === agentId &&
            ['assigned', 'executing', 'verifying'].includes(m.status)
        );

        // Also check if they are a crew member on active subtasks
        // This is more complex, for now we rely on primary assignment
        // TODO: iterate through all missions with crew enabled and check subtask assignments

        const active_jobs_count = activeMissions.length;

        // 2. Check heartbeat / last active
        const lastSeen = profile.lastActive ? new Date(profile.lastActive) : null;
        const now = new Date();
        const isOnline = lastSeen && (now.getTime() - lastSeen.getTime() < this.ONLINE_THRESHOLD_MS);

        let status: AgentStatus = 'offline';

        if (isOnline) {
            status = active_jobs_count > 0 ? 'busy' : 'online';
        }

        return {
            status,
            last_seen: lastSeen,
            active_jobs_count
        };
    }

    /**
     * Get status for all agents (useful for lists)
     */
    getAllStatuses(): Record<string, AgentStatusInfo> {
        const agents = this.agentAuth.listAgents();
        const statuses: Record<string, AgentStatusInfo> = {};

        for (const agent of agents) {
            statuses[agent.id] = this.calculateStatus(agent.id);
        }

        return statuses;
    }
}
