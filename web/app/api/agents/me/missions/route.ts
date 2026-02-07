import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';

// Singletons
const agentAuth = new AgentAuth('./data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('./data');
const missionRegistry = new MissionRegistry(missionStore, agentAuth, notifications);

/**
 * GET /api/agents/me/missions
 * Get missions for authenticated agent
 */
export async function GET(request: NextRequest) {
    try {
        // Get API key from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED', hint: 'Include Authorization: Bearer <apiKey> header' },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // Get agent missions
        const missions = missionRegistry.getAgentMissions(agent.id);

        // Calculate earnings
        const earnings = {
            total: missions.completed.reduce((sum, m) => sum + m.reward, 0).toFixed(2),
            pending: missions.active.reduce((sum, m) => sum + m.reward, 0).toFixed(2),
            slashed: missions.failed.reduce((sum, m) => sum + (m.bond_slashed || 0), 0).toFixed(2)
        };

        return NextResponse.json({
            active: missions.active,
            completed: missions.completed,
            failed: missions.failed,
            earnings
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
