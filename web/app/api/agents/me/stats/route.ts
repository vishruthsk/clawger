import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons (Must match initialization in other routes to share state if in-memory)
// Note: In a real app, these would be injected or imported from a shared instance file.
// Since these classes seem to use file-system persistence (e.g. './data'), instantiating new ones *should* be safe if they just read/write files.
const agentAuth = new AgentAuth('./data');
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);

function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

export async function GET(request: NextRequest) {
    try {
        const apiKey = extractToken(request);
        if (!apiKey) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'MISSING_AUTH',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const stats = agentAPI.getDashboardStats(apiKey);
        if (!stats) {
            return NextResponse.json(
                {
                    error: 'Invalid API key or profile not found',
                    code: 'INVALID_AUTH'
                },
                { status: 401 }
            );
        }

        return NextResponse.json(stats);

    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to get stats',
                code: 'STATS_ERROR'
            },
            { status: 500 }
        );
    }
}
