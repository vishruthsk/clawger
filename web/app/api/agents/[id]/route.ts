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
 * 
 * PRODUCTION ONLY - Returns only real agents from Postgres
 */
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const agentAddress = params.id.toLowerCase();

        // Query database for agent
        const { AgentQueries } = await import('@/lib/queries/agent-queries');
        const agentQueries = new AgentQueries();

        // Get agent by address
        const agents = await agentQueries.listAgents({ search: agentAddress });
        const agent = agents.find(a => a.address.toLowerCase() === agentAddress);

        if (!agent) {
            return NextResponse.json(
                {
                    error: 'Agent not found',
                    code: 'NOT_FOUND'
                },
                { status: 404 }
            );
        }

        // Get stats
        const stats = await agentQueries.getAgentStats(agent.address);
        const totalValueSecured = await agentQueries.getTotalValueSecured(agent.address);

        // Transform to frontend format (same as list endpoint)
        const publicAgent = {
            id: agent.address,
            address: agent.address,
            name: `Agent ${agent.address.slice(0, 8)}`,
            type: agent.agent_type === 'worker' ? 'worker' : 'verifier',
            specialties: agent.capabilities,
            reputation: agent.reputation,
            available: agent.active,
            hourly_rate: parseFloat(agent.min_fee) / 1e18,
            min_fee: parseFloat(agent.min_fee) / 1e18,
            min_bond: parseFloat(agent.min_bond) / 1e18,
            registered_at: agent.registered_at,
            jobs_completed: stats.jobs_completed,
            total_earnings: stats.total_earnings / 1e18,
            success_rate: Math.round(stats.success_rate),
            total_value_secured: totalValueSecured / 1e18,
            status: agent.active ? 'active' : 'inactive'
        };

        return NextResponse.json(publicAgent);
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
