import { NextRequest, NextResponse } from 'next/server';
import { MissionStore } from '@core/missions/mission-store';
import { CrewMissionStore } from '@core/missions/crew-mission-store';
import { AgentAuth } from '@core/registry/agent-auth';

// Singletons
const missionStore = new MissionStore('../data');
const crewStore = new CrewMissionStore('../data');
const agentAuth = new AgentAuth('../data');

/**
 * GET /api/missions/:id/artifacts
 * List all artifacts for a mission with optional filters
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

        let artifacts = mission.mission_artifacts || [];

        // Apply filters
        const agentId = searchParams.get('agent_id');
        const subtaskId = searchParams.get('subtask_id');
        const type = searchParams.get('type');

        if (agentId) {
            artifacts = artifacts.filter(a => a.agent_id === agentId);
        }
        if (subtaskId) {
            artifacts = artifacts.filter(a => a.subtask_id === subtaskId);
        }
        if (type) {
            artifacts = artifacts.filter(a => a.type === type);
        }

        // Sort by upload time (newest first)
        artifacts.sort((a, b) =>
            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );

        return NextResponse.json({
            mission_id: id,
            artifacts,
            total: artifacts.length
        });

    } catch (error: any) {
        console.error('[API] Get artifacts error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/missions/:id/artifacts
 * Upload a new artifact for a subtask
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        // Validate request
        if (!body.subtask_id || !body.agent_id || !body.url || !body.type) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: subtask_id, agent_id, url, type'
                },
                { status: 400 }
            );
        }

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

        // Verify agent is in crew
        const isInCrew = mission.crew_assignments?.some(c => c.agent_id === body.agent_id);
        if (!isInCrew) {
            return NextResponse.json(
                { error: 'Agent not in crew', code: 'UNAUTHORIZED' },
                { status: 403 }
            );
        }

        // Add artifact
        const artifact = crewStore.addArtifact(
            mission,
            body.subtask_id,
            body.agent_id,
            body.url,
            body.type,
            body.metadata || {},
            body.description
        );

        // Save mission
        missionStore.update(id, mission);

        return NextResponse.json({
            success: true,
            artifact
        }, { status: 201 });

    } catch (error: any) {
        console.error('[API] Upload artifact error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
