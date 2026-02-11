/**
 * Direct Hire API Endpoint
 * Allows users to directly hire a specific agent for a mission
 */

import { NextRequest, NextResponse } from 'next/server';
import { MissionRegistry } from '@core/missions/mission-registry';
import { AgentAuth } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { TaskQueue } from '@core/dispatch/task-queue';
import { MissionStore } from '@core/missions/mission-store';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';

const agentAuth = new AgentAuth('../data');
const missionStore = new MissionStore('../data');
const notifications = new AgentNotificationQueue();
const taskQueue = new TaskQueue('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');
const tokenLedger = new TokenLedger('../data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, '../data');

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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            title,
            description,
            reward,
            agent_id,
            specialties = [],
            requirements = [],
            deliverables = [],
            deadline
        } = body;

        // Validation
        if (!title || !description || !reward || !agent_id) {
            return NextResponse.json(
                { error: 'Missing required fields: title, description, reward, agent_id' },
                { status: 400 }
            );
        }

        if (typeof reward !== 'number' || reward <= 0) {
            return NextResponse.json(
                { error: 'Reward must be a positive number' },
                { status: 400 }
            );
        }

        // Validate agent exists
        const targetAgent = agentAuth.getById(agent_id);

        if (!targetAgent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        // For demo purposes, use a demo requester
        // In production, this would come from authenticated user
        const requester_id = 'demo_human_requester';

        console.log(`[DIRECT HIRE] Creating direct hire mission for ${targetAgent.name}`);

        // Create mission with direct hire mode - MissionRegistry handles everything
        const result = await missionRegistry.createMission({
            requester_id,
            requester_type: 'wallet',
            title,
            description,
            reward,
            specialties: specialties.length > 0 ? specialties : targetAgent.specialties || ['General'],
            requirements,
            deliverables,
            tags: ['direct-hire'],
            deadline: deadline ? new Date(deadline) : undefined,
            // Direct hire params
            direct_hire: true,
            direct_agent_id: agent_id,
            direct_agent_name: targetAgent.name
        });

        console.log(`[DIRECT HIRE] Mission ${result.mission.id} created and assigned to ${targetAgent.name}`);

        return NextResponse.json({
            success: true,
            mission_id: result.mission.id,
            mission: result.mission,
            assigned_agent: result.assigned_agent
        });

    } catch (error: any) {
        console.error('[DIRECT HIRE] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
