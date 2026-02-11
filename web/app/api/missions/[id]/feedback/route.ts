import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { TaskQueue } from '@core/dispatch/task-queue';
import { WalletAuth } from '@core/auth/wallet-auth';

const missionStore = new MissionStore('../data');
const taskQueue = new TaskQueue('../data');
const walletAuth = new WalletAuth('../data');
const agentAuth = new AgentAuth('../data');

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { feedback } = body;

        // ============================================
        // STEP 1: Authenticate requester
        // ============================================
        const authHeader = request.headers.get('Authorization');
        let requesterId: string | null = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            // Try wallet auth first
            const session = walletAuth.validateSession(token);
            if (session) {
                requesterId = session.address;
            } else {
                // Try agent auth
                const agent = agentAuth.validate(token);
                if (agent) {
                    requesterId = agent.wallet_address || agent.id;
                }
            }
        }

        // ============================================
        // STEP 2: Get mission and validate
        // ============================================
        const mission = missionStore.get(id);
        if (!mission) {
            return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
        }

        // Validate requester owns mission (if authenticated)
        if (requesterId && mission.requester_id !== requesterId) {
            return NextResponse.json(
                { error: 'Only the mission requester can submit feedback' },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 3: Validate mission status
        // ============================================
        if (mission.status !== 'submitted' && mission.status !== 'executing' && mission.status !== 'verifying') {
            return NextResponse.json(
                {
                    error: 'Can only request changes on submitted/executing work',
                    current_status: mission.status
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 4: Check revision limit
        // ============================================
        const currentRevisions = (mission as any).revision_count || 0;
        if (currentRevisions >= 5) {
            return NextResponse.json({
                error: 'Revision limit reached (5/5)'
            }, { status: 400 });
        }

        // ============================================
        // STEP 5: Validate feedback
        // ============================================
        if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 10) {
            return NextResponse.json(
                { error: 'Feedback must be at least 10 characters' },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 6: Update mission with feedback
        // ============================================
        const newRevisionCount = currentRevisions + 1;
        const revisionHistory = (mission as any).revision_history || [];
        revisionHistory.push({
            revision_number: newRevisionCount,
            feedback: feedback.trim(),
            requested_by: requesterId || 'requester',
            requested_at: new Date()
        });

        const updates: any = {
            revision_count: newRevisionCount,
            revision_history: revisionHistory,
            status: 'in_revision',
            updated_at: new Date()
        };

        missionStore.update(id, updates);

        console.log(`[Feedback] Mission ${id}: Revision ${newRevisionCount}/5 requested`);

        // ============================================
        // STEP 7: Dispatch revision task to worker
        // ============================================
        if (mission.assigned_agent?.agent_id) {
            taskQueue.enqueue({
                agent_id: mission.assigned_agent.agent_id,
                type: 'revision_required',
                priority: 'urgent',
                payload: {
                    mission_id: id,
                    action: `Revision required (${newRevisionCount}/5): ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
                    revision_number: newRevisionCount,
                    feedback: feedback.trim(),
                    deadline: mission.deadline
                },
                expires_in_hours: 48
            });

            console.log(`[Feedback] Dispatched revision_required task to agent ${mission.assigned_agent.agent_id}`);
        }

        // ============================================
        // STEP 8: Return success
        // ============================================
        return NextResponse.json({
            success: true,
            revision_count: newRevisionCount,
            max_revisions: 5,
            revisions_remaining: 5 - newRevisionCount,
            message: `Revision ${newRevisionCount}/5 requested`,
            mission: missionStore.get(id)
        });

    } catch (error: any) {
        console.error('[POST /api/missions/:id/feedback] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
