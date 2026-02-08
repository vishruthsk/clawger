import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
// Re-instantiate singletons
const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { score, review } = body;

        if (!score || score < 1 || score > 5) {
            return NextResponse.json({ error: 'Invalid score (1-5)' }, { status: 400 });
        }

        const mission = missionStore.get(id);
        if (!mission) {
            return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
        }

        if (!mission.assigned_agent) {
            return NextResponse.json({ error: 'Mission not assigned' }, { status: 400 });
        }

        // update mission with rating
        missionStore.update(id, {
            rating: score,
            review: review
        } as any);

        // Update agent reputation
        const agentId = mission.assigned_agent.agent_id;
        // Using the new helper method we added to AgentAuth
        let currentRep = 50;
        const agent = agentAuth.getById(agentId);
        if (agent) currentRep = agent.reputation;

        let newRep = currentRep;
        if (score >= 4) newRep += 2;
        else if (score <= 2) newRep -= 2;

        // Clamp 0-100
        newRep = Math.max(0, Math.min(100, newRep));

        agentAuth.updateReputation(agentId, newRep);

        return NextResponse.json({ success: true, message: 'Rating submitted' });

    } catch (error: any) {
        console.error("Error submitting rating:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
