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
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const filters = {
            specialty: searchParams.get('specialty') || undefined,
            available: searchParams.get('available') === 'true' ? true :
                searchParams.get('available') === 'false' ? false : undefined,
            min_reputation: searchParams.get('min_reputation')
                ? parseInt(searchParams.get('min_reputation')!)
                : undefined,
            search: searchParams.get('search') || undefined,
            tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined,
            // New filters for Phase 17
            capability: searchParams.get('capability') || undefined,
            status: searchParams.get('status') || undefined,
            minRep: searchParams.get('minRep') ? parseInt(searchParams.get('minRep')!) : undefined,
            maxRate: searchParams.get('maxRate') ? parseInt(searchParams.get('maxRate')!) : undefined
        };

        const agents = agentAPI.listAgents(filters);

        // Initialize economic modules
        const tvsCalculator = new TVSCalculator(missionStore);
        const bondTracker = new BondTracker(dataPath);

        // Remove sensitive fields and inject real-time stats
        const publicAgents = agents.map(agent => {
            const realEarnings = jobHistory.getTotalEarnings(agent.id);
            const realJobCount = jobHistory.getJobCount(agent.id);
            const totalValueSecured = tvsCalculator.getTotalValueSecured(agent.id);
            const activeBond = bondTracker.getActiveBond(agent.id);

            // Calculate success rate
            const jobOutcomes = jobHistory.getJobOutcomes(agent.id);
            const passedJobs = jobOutcomes.filter(j => j.outcome === 'PASS').length;
            const totalJobs = jobOutcomes.length;
            const successRate = totalJobs > 0 ? (passedJobs / totalJobs) * 100 : 100;

            // Apply filters
            if (filters.capability && !agent.specialties.some(s =>
                s.toLowerCase().includes(filters.capability!.toLowerCase())
            )) {
                return null;
            }

            if (filters.maxRate && agent.hourly_rate && agent.hourly_rate > filters.maxRate) {
                return null;
            }

            if (filters.minRep && agent.reputation < filters.minRep) {
                return null;
            }

            return {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                specialties: agent.specialties,
                hourly_rate: agent.hourly_rate || 0,
                available: agent.available,
                reputation: agent.reputation || 50,
                jobs_completed: Math.max(realJobCount, agent.jobs_completed || 0),
                total_earnings: realEarnings || 0,
                total_value_secured: totalValueSecured,
                active_bond: activeBond > 0 ? activeBond : null,
                success_rate: Math.round(successRate),
                status: agent.status || 'active',
                platform: agent.platform,
                neural_spec: agent.neural_spec,
                type: agent.type || 'worker'
            };
        }).filter(agent => agent !== null); // Remove filtered out agents

        return NextResponse.json(publicAgents);
    } catch (error: any) {
        console.error('[API /agents] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to list agents',
                code: 'LIST_ERROR'
            },
            { status: 500 }
        );
    }
}
