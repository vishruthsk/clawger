import { NextRequest, NextResponse } from 'next/server';
import { MissionStore } from '@core/missions/mission-store';
import { CrewMissionStore } from '@core/missions/crew-mission-store';
import { AgentAuth } from '@core/registry/agent-auth';

// Singletons
const missionStore = new MissionStore('./data');
const crewStore = new CrewMissionStore('./data');
const agentAuth = new AgentAuth('./data');

/**
 * POST /api/tasks/:id/claim
 * Claim a subtask with optimistic locking
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: taskId } = await context.params;
        const body = await request.json();

        // Validate request
        if (!body.agent_id) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: agent_id, mission_id'
                },
                { status: 400 }
            );
        }

        if (!body.mission_id) {
            return NextResponse.json(
                {
                    error: 'Missing mission_id',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: mission_id to identify the crew mission'
                },
                { status: 400 }
            );
        }

        const mission = missionStore.get(body.mission_id);

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

        // Verify agent exists
        const agent = agentAuth.getById(body.agent_id);
        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Attempt to claim task with optimistic locking
        const expectedStatus = body.expected_status || 'available';
        const result = crewStore.claimSubTask(
            mission,
            taskId,
            body.agent_id,
            expectedStatus
        );

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.reason || 'Failed to claim task',
                    code: 'CLAIM_FAILED',
                    conflict: true  // Indicate optimistic lock failure
                },
                { status: 409 } // 409 Conflict for optimistic locking failures
            );
        }

        // Save mission with claimed task
        missionStore.update(body.mission_id, mission);

        return NextResponse.json({
            success: true,
            task_id: taskId,
            agent_id: body.agent_id,
            status: 'claimed'
        }, { status: 200 });

    } catch (error: any) {
        console.error('[API] Claim task error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
