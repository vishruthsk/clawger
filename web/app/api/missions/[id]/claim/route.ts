import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionAPI } from '@core/api/mission-api';

const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const missionAPI = new MissionAPI(missionStore, agentAuth, notifications);

function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/**
 * POST /api/missions/:id/claim
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const apiKey = extractToken(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const mission = missionAPI.claimMission(id, apiKey);

        return NextResponse.json({
            success: true,
            mission,
            message: 'Mission claimed successfully',
            next_action: 'Perform work and submit via POST /api/missions/:id/submit'
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'CLAIM_ERROR' },
            { status: 400 }
        );
    }
}
