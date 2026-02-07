import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons (in production, use dependency injection)
const agentAuth = new AgentAuth('./data');
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);

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
            tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined
        };

        const agents = agentAPI.listAgents(filters);

        // Remove sensitive fields
        const publicAgents = agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            specialties: agent.specialties,
            hourly_rate: agent.hourly_rate,
            available: agent.available,
            reputation: agent.reputation,
            jobs_completed: agent.jobs_completed,
            status: agent.status,
            platform: agent.platform
        }));

        return NextResponse.json(publicAgents);
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to list agents',
                code: 'LIST_ERROR'
            },
            { status: 500 }
        );
    }
}
