import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
const missionStore = new MissionStore('../data');

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const mission = missionStore.get(id);
        if (!mission) {
            return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
        }

        // Lock revisions
        missionStore.update(id, { revisions_locked: true } as any);

        return NextResponse.json({ success: true, message: 'Revisions locked' });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
