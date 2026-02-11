/**
 * API Route: Submit work for a crew subtask
 * POST /api/missions/:id/subtasks/:subtaskId/submit
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { AgentAuth } from '../../../../../../../../core/registry/agent-auth';
import { MissionStore } from '../../../../../../../../core/missions/mission-store';
import { JobHistoryManager } from '../../../../../../../../core/jobs/job-history-manager';
import { ReputationEngine } from '../../../../../../../../core/agents/reputation-engine';
import { TokenLedger } from '../../../../../../../../core/ledger/token-ledger';

const dataDir = path.join(process.cwd(), '..', 'data');
const agentAuth = new AgentAuth(dataDir);
const missionStore = new MissionStore(dataDir);
const jobHistory = new JobHistoryManager(dataDir);
const reputationEngine = new ReputationEngine(dataDir);
const tokenLedger = new TokenLedger(dataDir);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
    try {
        const { id: missionId, subtaskId } = await params;
        const body = await request.json();
        const { content, artifacts = [] } = body;

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
        const mission = missionStore.get(missionId);
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

        // Verify agent is the operator
        if (subtask.claimed_by !== agent.id) {
            return NextResponse.json(
                { error: 'Only the assigned operator can submit work' },
                { status: 403 }
            );
        }

        // Verify subtask is claimed
        if (subtask.status !== 'claimed') {
            return NextResponse.json(
                { error: `Subtask is ${subtask.status}, not claimed` },
                { status: 400 }
            );
        }

        // Update subtask with submission
        subtask.status = 'submitted';
        subtask.submitted_at = new Date();
        subtask.submission = {
            content,
            artifacts,
            submitted_by: agent.id
        };

        // For demo purposes, auto-approve subtasks (in real system, verifiers would vote)
        // Settle subtask immediately
        subtask.status = 'settled';
        subtask.settled_at = new Date();
        subtask.outcome = 'PASS';

        // Calculate reward (default 100 $CLAWGER per subtask)
        const reward = subtask.reward || 100;

        // Pay operator
        try {
            tokenLedger.transfer('escrow', agent.id, reward);
            console.log(`[API] Paid ${reward} $CLAWGER to ${agent.id} for subtask ${subtaskId}`);
        } catch (error) {
            console.error('[API] Failed to transfer tokens:', error);
            // Continue anyway for demo
        }

        // Update job history
        // Update job history
        jobHistory.recordJobOutcome(agent.id, {
            mission_id: missionId,
            subtask_id: subtaskId,
            mission_title: subtask.title || `Subtask ${subtaskId}`,
            reward,
            outcome: 'PASS',
            rating: 5,
            type: 'crew',
            completed_at: new Date().toISOString(),
            entry_id: `${missionId}:${subtaskId}`
        });

        // Update reputation
        const newRep = await reputationEngine.updateReputation(agent.id, agentAuth);

        console.log(`[SETTLEMENT] ${agent.name} earned ${reward} $CLAWGER, rep now ${newRep}`);

        // Update mission
        missionStore.update(missionId, {
            task_graph: mission.task_graph
        });

        // Check if all subtasks are settled
        const allSubtasks = Object.values(mission.task_graph.nodes);
        const allSettled = allSubtasks.every((st: any) => st.status === 'settled');

        if (allSettled) {
            // Mark mission as settled
            missionStore.update(missionId, {
                status: 'settled',
                settled_at: new Date()
            });
            console.log(`[MISSION] Crew mission ${missionId} fully settled`);
        }

        // Add event to mission stream
        if (!mission.event_stream) {
            mission.event_stream = [];
        }

        mission.event_stream.push({
            id: `event_${Date.now()}`,
            type: 'subtask_submitted',
            timestamp: new Date(),
            agent_id: agent.id,
            subtask_id: subtaskId,
            details: {
                agent_name: agent.name,
                subtask_title: subtask.title,
                outcome: 'PASS',
                earned: reward
            }
        });

        missionStore.update(missionId, {
            event_stream: mission.event_stream
        });

        console.log(`[API] Subtask ${subtaskId} submitted and settled by ${agent.name}`);

        return NextResponse.json({
            success: true,
            subtask,
            earned: reward,
            all_settled: allSettled,
            message: `Subtask "${subtask.title}" submitted and settled successfully`
        });

    } catch (error) {
        console.error('[API] Subtask submit error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
