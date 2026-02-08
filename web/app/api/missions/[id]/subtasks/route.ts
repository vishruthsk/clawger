import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';

// Singletons
const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const notifications = new AgentNotificationQueue();
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const bondManager = new BondManager(tokenLedger, './data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, './data');
const assignmentHistory = new AssignmentHistoryTracker('./data');

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine,
    assignmentHistory,
    bondManager,
    settlementEngine
);

/**
 * POST /api/missions/:id/subtasks
 * Create subtasks for bot-to-bot delegation
 * 
 * This allows agents to decompose missions and delegate work to other agents.
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: parentMissionId } = await context.params;

        // ============================================
        // STEP 1: Authenticate agent
        // ============================================
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Get parent mission and validate ownership
        // ============================================
        const parentMission = missionStore.get(parentMissionId);

        if (!parentMission) {
            return NextResponse.json(
                { error: 'Parent mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Verify agent owns or is assigned to parent mission
        const isAssigned = parentMission.assigned_agent?.agent_id === agent.id;
        const isRequester = parentMission.requester_id === agent.id;

        if (!isAssigned && !isRequester) {
            return NextResponse.json(
                {
                    error: 'Not authorized to create subtasks',
                    code: 'FORBIDDEN',
                    hint: 'Only the assigned agent or requester can create subtasks'
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 3: Parse and validate subtasks
        // ============================================
        const body = await request.json();

        if (!body.subtasks || !Array.isArray(body.subtasks) || body.subtasks.length === 0) {
            return NextResponse.json(
                {
                    error: 'Invalid request',
                    code: 'INVALID_REQUEST',
                    hint: 'Provide an array of subtasks with title, description, and reward'
                },
                { status: 400 }
            );
        }

        // Validate each subtask
        const validationErrors = [];
        for (let i = 0; i < body.subtasks.length; i++) {
            const subtask = body.subtasks[i];
            if (!subtask.title || !subtask.description || !subtask.reward) {
                validationErrors.push(`Subtask ${i}: Missing required fields (title, description, reward)`);
            }
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    errors: validationErrors
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 4: Verify agent has sufficient balance for escrow
        // ============================================
        const totalReward = body.subtasks.reduce((sum: number, st: any) => sum + st.reward, 0);
        const agentBalance = tokenLedger.getBalance(agent.id);

        if (agentBalance < totalReward) {
            return NextResponse.json(
                {
                    error: 'Insufficient balance',
                    code: 'INSUFFICIENT_BALANCE',
                    hint: `Total subtask rewards (${totalReward}) exceed your balance (${agentBalance})`,
                    required: totalReward,
                    available: agentBalance
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 5: Create subtask missions
        // ============================================
        const createdSubtasks = [];

        for (const subtaskData of body.subtasks) {
            // Create mission with agent as requester
            const subtaskMission = missionStore.create({
                title: `[SUBTASK] ${subtaskData.title}`,
                description: subtaskData.description,
                reward: subtaskData.reward,
                tags: [...(parentMission.tags || []), 'subtask'],
                specialties: subtaskData.specialties || parentMission.specialties,
                assignment_mode: subtaskData.assignment_mode || 'autopilot',
                requester_id: agent.id, // Agent is the requester
                requirements: subtaskData.requirements || [],
                deliverables: subtaskData.deliverables || [],
                escrow: {
                    locked: false,
                    amount: subtaskData.reward
                }
            });

            // Lock escrow for subtask
            const escrowLocked = escrowEngine.lockEscrow(
                agent.id,
                subtaskMission.id,
                subtaskData.reward
            );

            if (escrowLocked) {
                missionStore.update(subtaskMission.id, {
                    escrow: {
                        locked: true,
                        amount: subtaskData.reward,
                        locked_at: new Date()
                    }
                });

                createdSubtasks.push({
                    id: subtaskMission.id,
                    parent_mission_id: parentMissionId,
                    title: subtaskMission.title,
                    reward: subtaskMission.reward,
                    status: subtaskMission.status,
                    escrow_locked: true
                });

                console.log(`[Subtasks] Created subtask ${subtaskMission.id} for parent ${parentMissionId}`);
            }
        }

        // ============================================
        // STEP 6: Return created subtasks
        // ============================================
        return NextResponse.json({
            success: true,
            parent_mission_id: parentMissionId,
            subtasks_created: createdSubtasks.length,
            subtasks: createdSubtasks,
            total_escrowed: totalReward,
            agent_remaining_balance: tokenLedger.getBalance(agent.id),
            message: `Created ${createdSubtasks.length} subtask missions`
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Subtasks] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
