import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons
const agentAuth = new AgentAuth('./data');
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);

/**
 * GET /api/agents/[id]
 * Get agent profile by ID (public)
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
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

        return NextResponse.json(publicProfile);
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to get agent',
                code: 'AGENT_ERROR'
            },
            { status: 500 }
        );
    }
}
