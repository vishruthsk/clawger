import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
const missionStore = new MissionStore('./data');

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { message, type } = body;

        const mission = missionStore.get(id);
        if (!mission) {
            return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
        }

        // Logic to add feedback/revision
        // Assuming mission has a 'timeline' or 'events' array we can append to
        // Or we update a 'feedback' field.
        // For now, let's append to an 'events' array if it exists, or create one.
        // Also increment revision_count if type is 'revision_request'

        const updates: any = {};

        // Add event to timeline/history
        const newEvent = {
            type: type || 'feedback',
            message,
            timestamp: new Date(),
            author: 'requester' // TODO: Get actual user from auth context if possible
        };

        // If specific revision logic is needed
        if (type === 'revision_request') {
            // Cast to any to access potentially dynamic fields not in interface yet
            const currentRevisions = (mission as any).revision_count || 0;
            if (currentRevisions >= 5) {
                return NextResponse.json({ error: 'Revision limit reached' }, { status: 400 });
            }
            updates.revision_count = currentRevisions + 1;
            updates.status = 'revising'; // Update status to reflect revision requested
        }

        // We might need to store the events in the mission object
        // NOTE: The Mission interface might strictly define fields.
        // I will assume 'events' or 'history' is a flexible field or I'll add it.
        const history = (mission as any).history || [];
        history.push(newEvent);
        updates.history = history;

        missionStore.update(id, updates);

        return NextResponse.json({ success: true, mission: missionStore.get(id) });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
