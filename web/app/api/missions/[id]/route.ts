import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { ReputationEngine } from '@core/agents/reputation-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';

// Singletons
const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const taskQueue = new TaskQueue('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');
const tokenLedger = new TokenLedger('../data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const reputationEngine = new ReputationEngine('../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(
    tokenLedger,
    bondManager,
    agentAuth,
    jobHistory,
    '../data'
);

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine,
    assignmentHistory,
    bondManager,
    settlementEngine,
    reputationEngine
);

/**
 * GET /api/missions/:id
 * Get mission details with bids and timeline
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const mission = missionRegistry.getMission(id);

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Build timeline from mission status history
        const timeline = [];

        if (mission.posted_at) {
            timeline.push({
                status: 'posted',
                timestamp: mission.posted_at,
                description: 'Mission posted'
            });
        }

        if (mission.bidding_window_end) {
            const biddingEndDate = mission.bidding_window_end instanceof Date
                ? mission.bidding_window_end
                : new Date(mission.bidding_window_end);

            timeline.push({
                status: 'bidding_open',
                timestamp: mission.posted_at,
                description: `Bidding window open until ${biddingEndDate.toISOString()}`
            });
        }

        // ✅ CRITICAL: Assigned - check both top-level and nested assigned_at
        const assignedTimestamp = mission.assigned_at ||
            (typeof mission.assigned_agent === 'object' && mission.assigned_agent?.assigned_at);

        if (assignedTimestamp) {
            let agentName = 'Unknown Agent';

            // ✅ CRITICAL: Handle both legacy (string) and new (object) formats
            if (mission.assigned_agent) {
                if (typeof mission.assigned_agent === 'string') {
                    // Legacy format: assigned_agent is just an ID
                    const agent = agentAuth.getById(mission.assigned_agent);
                    agentName = agent?.name || mission.assigned_agent;
                } else {
                    // New format: assigned_agent is AssignmentDetails object
                    agentName = mission.assigned_agent.agent_name;
                }
            } else if (mission.worker_id) {
                // ✅ CRITICAL: Legacy missions use worker_id instead of assigned_agent
                const agent = agentAuth.getById(mission.worker_id);
                agentName = agent?.name || mission.worker_id;
            }

            timeline.push({
                status: 'assigned',
                timestamp: assignedTimestamp,
                description: `Assigned to ${agentName}`,
                agent: mission.assigned_agent || mission.worker_id
            });
        }

        // ✅ CRITICAL: Executing - check both new and legacy fields
        if (mission.executing_started_at || mission.claimed_at) {
            timeline.push({
                status: 'executing',
                timestamp: mission.executing_started_at || mission.claimed_at,
                description: 'Work in progress'
            });
        }

        // ✅ CRITICAL: Verifying - check both new and legacy fields
        if (mission.verifying_started_at || mission.submitted_at) {
            timeline.push({
                status: 'verifying',
                timestamp: mission.verifying_started_at || mission.submitted_at,
                description: 'Under verification'
            });
        }

        // ✅ CRITICAL: Settled - check both new and legacy fields
        if (mission.settled_at || mission.verified_at) {
            timeline.push({
                status: 'settled',
                timestamp: mission.settled_at || mission.verified_at,
                description: 'Mission completed and verified'
            });
        }

        // ✅ CRITICAL: Paid - legacy field only
        if (mission.paid_at) {
            timeline.push({
                status: 'paid',
                timestamp: mission.paid_at,
                description: 'Payment released'
            });
        }

        if (mission.failed_at) {
            timeline.push({
                status: 'failed',
                timestamp: mission.failed_at,
                description: mission.failure_reason || 'Mission failed'
            });
        }

        // Get assigned agent profile if available
        let assigned_agent_profile = null;
        if (mission.assigned_agent) {
            // ✅ CRITICAL: Handle both legacy (string) and new (object) formats
            if (typeof mission.assigned_agent === 'string') {
                // Legacy format: assigned_agent is just an ID
                assigned_agent_profile = agentAuth.getById(mission.assigned_agent);
            } else {
                // New format: assigned_agent is AssignmentDetails object
                assigned_agent_profile = agentAuth.getById(mission.assigned_agent.agent_id);
            }
        }

        return NextResponse.json({
            mission,
            bids: mission.bids || [],
            timeline,
            assigned_agent: assigned_agent_profile,
            escrow_status: mission.escrow ? {
                locked: mission.escrow.locked,
                amount: mission.escrow.amount,
                tx_hash: mission.escrow.tx_hash
            } : null
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
