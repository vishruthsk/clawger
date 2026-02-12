import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons (in production, use dependency injection)
import { getDataPath } from '@/lib/data-path';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { TVSCalculator } from '@core/economy/tvs-calculator';
import { BondTracker } from '@core/economy/bond-tracker';
import { MissionRegistry } from '@core/missions/mission-registry';
import { MissionStore } from '@core/missions/mission-store';

const dataPath = getDataPath();
const agentAuth = new AgentAuth(dataPath);
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);
const jobHistory = new JobHistoryManager(dataPath);
const missionStore = new MissionStore(dataPath);
const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notificationQueue,
    null as any, // taskQueue
    null as any, // heartbeatManager
    null as any, // escrowEngine
    null as any, // assignmentHistory
    null as any, // bondManager
    null as any, // settlementEngine
    null as any  // reputationEngine
);

/**
 * POST /api/agents/register
 * Register a new agent with full profile
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.profile || !body.specialties || !body.address) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    code: 'INVALID_REQUEST',
                    hint: 'Required fields: name (min 2 chars), profile (min 100 chars), specialties (array), address'
                },
                { status: 400 }
            );
        }

        // Register agent
        const response = agentAPI.register({
            address: body.address,
            name: body.name,
            profile: body.profile,
            specialties: body.specialties,
            description: body.description,
            platform: body.platform,
            hourly_rate: body.hourly_rate,
            wallet_address: body.wallet_address
        });

        return NextResponse.json(response, { status: 201 });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Registration failed',
                code: 'REGISTRATION_ERROR',
                hint: 'Check your request parameters and try again'
            },
            { status: 400 }
        );
    }
}

/**
 * GET /api/agents
 * List all agents (public)
 * 
 * PRODUCTION ONLY - Returns only real agents from Postgres
 * Demo data is served via /api/demo/agents
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse filters from query params
        const filters: any = {};

        const type = searchParams.get('type');
        if (type === 'worker' || type === 'verifier') {
            filters.type = type;
        }

        const capability = searchParams.get('capability');
        if (capability) {
            filters.capability = capability;
        }

        const minRep = searchParams.get('min_reputation') || searchParams.get('minRep');
        if (minRep) {
            filters.min_reputation = parseInt(minRep);
        }

        const active = searchParams.get('active');
        if (active !== null) {
            filters.active = active === 'true';
        }

        const search = searchParams.get('search');
        if (search) {
            filters.search = search;
        }

        // Query database for agents
        const { AgentQueries } = await import('@/lib/queries/agent-queries');
        const agentQueries = new AgentQueries();
        const agents = await agentQueries.listAgents(filters);

        // Transform to frontend format with stats
        const publicAgents = await Promise.all(
            agents.map(async (agent) => {
                const stats = await agentQueries.getAgentStats(agent.address);
                const totalValueSecured = await agentQueries.getTotalValueSecured(agent.address);

                return {
                    id: agent.address,
                    address: agent.address,
                    name: `Agent ${agent.address.slice(0, 8)}`,
                    type: agent.agent_type === '0' ? 'worker' : 'verifier',
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
            })
        );

        return NextResponse.json(publicAgents);
    } catch (error: any) {
        console.error('[API /agents] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to list agents',
                code: 'DATABASE_ERROR'
            },
            { status: 500 }
        );
    }
}
