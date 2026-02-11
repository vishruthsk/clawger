/**
 * API Route: Claim a subtask in a crew mission
 * POST /api/missions/:id/subtasks/:subtaskId/claim
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { AgentAuth } from '../../../../../../../../core/registry/agent-auth';
import { MissionStore } from '../../../../../../../../core/missions/mission-store';
import { TaskQueue } from '../../../../../../../../core/dispatch/task-queue';

const dataDir = path.join(process.cwd(), '..', 'data');
const agentAuth = new AgentAuth(dataDir);
const missionStore = new MissionStore(dataDir);
const taskQueue = new TaskQueue(dataDir);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
    try {
        const { id: missionId, subtaskId } = await params;

        // Authenticate agent
        const apiKey = request.headers.get('x-api-key');
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing x-api-key header' },
                { status: 401 }
            );
        }

        const agent = agentAuth.validate(apiKey);
        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // Get mission
        const allMissions = missionStore.list();
        console.log(`[CLAIM API] Looking for mission ${missionId}`);
        console.log(`[CLAIM API] Total missions in store:`, allMissions.length);
        console.log(`[CLAIM API] Mission IDs in store:`, allMissions.slice(0, 5).map(m => m.id));

        const mission = missionStore.get(missionId);
        console.log(`[CLAIM API] Found mission:`, mission ? 'YES' : 'NO');

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found' },
                { status: 404 }
            );
        }

        // Verify crew mission
        if (mission.assignment_mode !== 'crew' || !mission.task_graph) {
            return NextResponse.json(
                { error: 'Not a crew mission' },
                { status: 400 }
            );
        }

        // Get subtask
        const subtask = mission.task_graph.nodes[subtaskId];
        if (!subtask) {
            return NextResponse.json(
                { error: 'Subtask not found' },
                { status: 404 }
            );
        }

        // Check if already claimed
        if (subtask.claimed_by) {
            return NextResponse.json(
                { error: `Subtask already claimed by ${subtask.claimed_by_name}` },
                { status: 409 }
            );
        }

        // Verify agent has required specialty
        if (!agent.specialties.includes(subtask.required_specialty)) {
            return NextResponse.json(
                { error: `Agent does not have required specialty: ${subtask.required_specialty}` },
                { status: 403 }
            );
        }

        // Claim subtask
        subtask.claimed_by = agent.id;
        subtask.claimed_by_name = agent.name;
        subtask.claimed_at = new Date();
        subtask.status = 'claimed';

        // Update mission
        missionStore.update(missionId, {
            task_graph: mission.task_graph
        });

        // Enqueue crew_task_assigned to agent
        taskQueue.enqueue({
            agent_id: agent.id,
            type: 'crew_task_assigned',
            priority: 'high',
            payload: {
                mission_id: missionId,
                subtask_id: subtaskId,
                title: subtask.title,
                description: subtask.description,
                action: `Begin work on "${subtask.title}" for mission "${mission.title}"`
            }
        });

        // Add event to mission stream
        if (!mission.event_stream) {
            mission.event_stream = [];
        }

        mission.event_stream.push({
            id: `event_${Date.now()}`,
            type: 'subtask_claimed',
            timestamp: new Date(),
            agent_id: agent.id,
            subtask_id: subtaskId,
            details: {
                agent_name: agent.name,
                subtask_title: subtask.title
            }
        });

        missionStore.update(missionId, {
            event_stream: mission.event_stream
        });

        console.log(`[CREW CLAIM] ${agent.name} claimed ${subtaskId} on ${missionId}`);

        return NextResponse.json({
            success: true,
            subtask,
            message: `Subtask "${subtask.title}" claimed successfully`
        });

    } catch (error) {
        console.error('[API] Subtask claim error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
