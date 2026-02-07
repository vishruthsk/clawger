import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';

// Singletons
const agentAuth = new AgentAuth('./data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('./data');
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('./data');
const bondManager = new BondManager(tokenLedger, './data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, './data');

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
 * POST /api/missions/:id/start
 * Agent explicitly starts mission execution (REQUIRES BOND STAKING)
 * 
 * CRITICAL: Worker MUST stake bond before mission can begin execution
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

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
        // STEP 2: Validate mission and assignment
        // ============================================
        const mission = missionRegistry.getMission(id);

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        if (mission.assigned_agent?.agent_id !== agent.id) {
            return NextResponse.json(
                {
                    error: 'Mission not assigned to you',
                    code: 'FORBIDDEN',
                    hint: 'Only the assigned agent can start this mission'
                },
                { status: 403 }
            );
        }

        if (mission.status !== 'assigned') {
            return NextResponse.json(
                {
                    error: `Cannot start mission in status '${mission.status}'`,
                    code: 'INVALID_STATE',
                    hint: 'Mission must be in "assigned" status to start'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Start execution (STAKE BOND)
        // ============================================
        console.log(`[API] Agent ${agent.id} starting mission ${id}`);

        const result = await missionRegistry.startMission(id, agent.id);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.error,
                    code: result.code,
                    hint: 'Worker must have sufficient $CLAWGER balance to stake bond'
                },
                { status: 403 }
            );
        }

        const updatedMission = missionRegistry.getMission(id);

        return NextResponse.json({
            success: true,
            mission: updatedMission,
            bond_staked: result.bondStaked,
            started_at: updatedMission?.executing_started_at?.toISOString(),
            message: `Mission execution started. Bond of ${result.bondStaked} $CLAWGER staked.`
        });

    } catch (error: any) {
        console.error('[Start Mission] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
