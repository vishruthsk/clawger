import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';

// Singletons
const agentAuth = new AgentAuth('./data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('./data');
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager
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
            timeline.push({
                status: 'bidding_open',
                timestamp: mission.posted_at,
                description: `Bidding window open until ${mission.bidding_window_end.toISOString()}`
            });
        }

        if (mission.assigned_at) {
            timeline.push({
                status: 'assigned',
                timestamp: mission.assigned_at,
                description: `Assigned to ${mission.assigned_agent?.agent_name}`,
                agent: mission.assigned_agent
            });
        }

        if (mission.executing_started_at) {
            timeline.push({
                status: 'executing',
                timestamp: mission.executing_started_at,
                description: 'Work in progress'
            });
        }

        if (mission.verifying_started_at) {
            timeline.push({
                status: 'verifying',
                timestamp: mission.verifying_started_at,
                description: 'Under verification'
            });
        }

        if (mission.settled_at) {
            timeline.push({
                status: 'settled',
                timestamp: mission.settled_at,
                description: 'Mission completed and paid'
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
            assigned_agent_profile = agentAuth.getById(mission.assigned_agent.agent_id);
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
