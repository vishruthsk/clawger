import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons
import { getDataPath } from '@/lib/data-path';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { TVSCalculator } from '@core/economy/tvs-calculator';
import { BondTracker } from '@core/economy/bond-tracker';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { ReputationEngine } from '@core/agents/reputation-engine';

const dataPath = getDataPath();
const agentAuth = new AgentAuth(dataPath);
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);
const jobHistory = new JobHistoryManager(dataPath);
const reputationEngine = new ReputationEngine(dataPath);
const missionStore = new MissionStore(dataPath);
const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notificationQueue,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any
);

/**
 * GET /api/agents/[id]
 * Get agent profile by ID (public)
 */
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const agentId = params.id;
        const agent = agentAPI.getAgentById(agentId);

        if (!agent) {
            return NextResponse.json(
                {
                    error: 'Agent not found',
                    code: 'NOT_FOUND'
                },
                { status: 404 }
            );
        }

        // Remove sensitive fields
        const { apiKey, address, ...publicProfile } = agent;

        // Get real-time stats
        const realEarnings = jobHistory.getTotalEarnings(agentId);
        const realJobCount = jobHistory.getJobCount(agentId);

        // Get TVS and bond data
        const tvsCalculator = new TVSCalculator(missionStore);
        const bondTracker = new BondTracker(dataPath);
        const totalValueSecured = tvsCalculator.getTotalValueSecured(agentId);
        const activeBond = bondTracker.getActiveBond(agentId);


        // Calculate success rate
        const jobOutcomes = jobHistory.getJobOutcomes(agentId);
        const passedJobs = jobOutcomes.filter(j => j.outcome === 'PASS').length;
        const totalJobs = jobOutcomes.length;
        const successRate = totalJobs > 0 ? (passedJobs / totalJobs) * 100 : 100;

        // Get reputation breakdown (source of truth for reputation)
        const reputationBreakdown = reputationEngine.getReputationBreakdown(agentId);

        // Get job history for profile
        const jobHistoryData = jobHistory.getHistory(agentId);

        // Inject computed fields for UI
        const enhancedProfile = {
            ...publicProfile,
            total_earnings: realEarnings || 0,
            jobs_completed: Math.max(realJobCount, publicProfile.jobs_completed || 0),
            total_value_secured: totalValueSecured,
            active_bond: activeBond > 0 ? activeBond : null,
            success_rate: Math.round(successRate),
            hourly_rate: publicProfile.hourly_rate || 0,
            reputation: reputationBreakdown.total, // Use calculated reputation, not stored value
            reputation_breakdown: reputationBreakdown,
            job_history: jobHistoryData.jobs
        };

        return NextResponse.json(enhancedProfile);
    } catch (error: any) {
        console.error('[API /agents/[id]] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to get agent',
                code: 'AGENT_ERROR'
            },
            { status: 500 }
        );
    }
}
