import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';

// Singletons
const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const missionRegistry = new MissionRegistry(missionStore, agentAuth, notifications);

/**
 * POST /api/missions/:id/assign
 * Manually assign mission to agent (admin only)
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        // TODO: Add admin authentication check

        if (!body.agent_id || !body.reason) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: agent_id, reason'
                },
                { status: 400 }
            );
        }

        const success = await missionRegistry.manualAssignment(
            id,
            body.agent_id,
            body.reason
        );

        if (!success) {
            return NextResponse.json(
                { error: 'Assignment failed', code: 'ASSIGNMENT_FAILED' },
                { status: 400 }
            );
        }

        const mission = missionRegistry.getMission(id);

        return NextResponse.json({
            success: true,
            mission
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
