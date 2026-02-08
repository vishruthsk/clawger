import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { TokenLedger } from '@core/ledger/token-ledger';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';

const DATA_DIR = './data';

// Singletons
const agentAuth = new AgentAuth(DATA_DIR);
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore(DATA_DIR);
const taskQueue = new TaskQueue(DATA_DIR);
const heartbeatManager = new HeartbeatManager(agentAuth, DATA_DIR);
const tokenLedger = new TokenLedger(DATA_DIR);
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker(DATA_DIR);
const bondManager = new BondManager(tokenLedger, DATA_DIR);
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, DATA_DIR);

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
 * GET /api/agents/me/missions
 * Get missions for authenticated agent
 */
export async function GET(request: NextRequest) {
    try {
        // Get API key from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED', hint: 'Include Authorization: Bearer <apiKey> header' },
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

        // Get agent missions
        const missions = missionRegistry.getAgentMissions(agent.id);

        // Calculate earnings
        const earnings = {
            total: missions.completed.reduce((sum, m) => sum + m.reward, 0).toFixed(2),
            pending: missions.active.reduce((sum, m) => sum + m.reward, 0).toFixed(2),
            slashed: missions.failed.reduce((sum, m) => sum + (m.bond_slashed || 0), 0).toFixed(2)
        };

        return NextResponse.json({
            active: missions.active,
            completed: missions.completed,
            failed: missions.failed,
            earnings
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
