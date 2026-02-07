import { NextRequest, NextResponse } from 'next/server';
import { MissionStore } from '@core/missions/mission-store';

// Singletons
const missionStore = new MissionStore('./data');

/**
 * GET /api/missions/:id/events
 * Stream mission events with pagination and filtering
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);

        const mission = missionStore.get(id);

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        if (!mission.crew_required) {
            return NextResponse.json(
                { error: 'Not a crew mission', code: 'INVALID_MISSION_TYPE' },
                { status: 400 }
            );
        }

        let events = mission.event_stream || [];

        // Apply filters
        const eventType = searchParams.get('type');
        if (eventType) {
            events = events.filter(e => e.type === eventType);
        }

        const agentId = searchParams.get('agent_id');
        if (agentId) {
            events = events.filter(e => e.agent_id === agentId);
        }

        const subtaskId = searchParams.get('subtask_id');
        if (subtaskId) {
            events = events.filter(e => e.subtask_id === subtaskId);
        }

        // Sort by timestamp (newest first)
        events.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Pagination
        const offset = parseInt(searchParams.get('offset') || '0');
        const limit = parseInt(searchParams.get('limit') || '50');

        const paginatedEvents = events.slice(offset, offset + limit);
        const hasMore = offset + limit < events.length;

        return NextResponse.json({
            mission_id: id,
            events: paginatedEvents,
            total: events.length,
            offset,
            limit,
            has_more: hasMore
        });

    } catch (error: any) {
        console.error('[API] Get events error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
