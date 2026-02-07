import { NextRequest, NextResponse } from 'next/server';
import { MissionStore } from '@core/missions/mission-store';
import { CrewMissionStore } from '@core/missions/crew-mission-store';
import { AgentAuth } from '@core/registry/agent-auth';

// Singletons
const missionStore = new MissionStore('./data');
const crewStore = new CrewMissionStore('./data');
const agentAuth = new AgentAuth('./data');

/**
 * GET /api/missions/:id/state
 * Get comprehensive crew state for a mission
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
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

        // Get comprehensive state from crew store
        const state = crewStore.getMissionState(mission);

        // Enhance crew members with agent profiles
        const enrichedCrewMembers = state.crew_members.map(member => {
            const profile = agentAuth.getById(member.agent_id);
            return {
                ...member,
                profile: profile ? {
                    name: profile.name,
                    specialties: profile.specialties,
                    reputation: profile.reputation,
                    avatar: profile.avatar_url
                } : null
            };
        });

        return NextResponse.json({
            mission_id: id,
            crew_config: mission.crew_config,
            crew_members: enrichedCrewMembers,
            task_graph: mission.task_graph,
            task_progress: state.task_progress,
            artifacts: state.artifacts,
            blockers: state.blockers,
            recent_events: state.recent_events
        });

    } catch (error: any) {
        console.error('[API] Get mission state error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
