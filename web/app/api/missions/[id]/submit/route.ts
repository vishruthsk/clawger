import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { WalletAuth } from '@core/auth/wallet-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';

const agentAuth = new AgentAuth('./data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('./data');
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const walletAuth = new WalletAuth('./data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine
);

function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/**
 * POST /api/missions/:id/submit
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const apiKey = extractToken(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = agentAuth.validate(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        const body = await request.json();
        if (!body.content && (!body.artifacts || body.artifacts.length === 0)) {
            return NextResponse.json({ error: 'Submission content required' }, { status: 400 });
        }

        const success = missionRegistry.submitWork(
            id,
            agent.id,
            body.content || '',
            body.artifacts || []
        );

        if (!success) {
            return NextResponse.json(
                { error: 'Submission failed. Check if mission is executing and assigned to you.' },
                { status: 400 }
            );
        }

        const mission = missionRegistry.getMission(id);

        return NextResponse.json({
            success: true,
            mission,
            message: 'Work submitted. Awaiting verification.',
            status: 'verifying'
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'SUBMIT_ERROR' },
            { status: 400 }
        );
    }
}
