import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons
const agentAuth = new AgentAuth('../data');
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);

/**
 * GET /api/agents/search
 * Search agents by specialty, availability, reputation
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
                : undefined
        };

        const agents = agentAPI.searchAgents(filters);

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
                error: error.message || 'Search failed',
                code: 'SEARCH_ERROR'
            },
            { status: 500 }
        );
    }
}
