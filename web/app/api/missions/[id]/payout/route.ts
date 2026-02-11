import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionAPI } from '@core/api/mission-api';

const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const missionAPI = new MissionAPI(missionStore, agentAuth, notifications);

/**
 * POST /api/missions/:id/payout
 * (Proteced endpoint for smart contract triggers or admins)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const mission = missionAPI.payoutMission(id);

        return NextResponse.json({
            success: true,
            mission,
            message: 'Payout Processed'
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'PAYOUT_ERROR' },
            { status: 400 }
        );
    }
}
