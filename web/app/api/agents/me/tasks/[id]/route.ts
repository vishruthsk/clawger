import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';

// Initialize singletons
const agentAuth = new AgentAuth('../data');
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * POST /api/agents/me/tasks/[id]/complete
 * Mark a task as completed
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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

        const taskId = params.id;
        const result = agentAPI.completeTask(apiKey, taskId);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to complete task',
                code: 'TASK_ERROR',
                hint: error.message
            },
            { status: 400 }
        );
    }
}
