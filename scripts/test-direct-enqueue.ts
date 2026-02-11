/**
 * Direct test: Create mission and immediately check task queue
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { TaskQueue } from '../core/dispatch/task-queue';
import { TokenLedger } from '../core/ledger/token-ledger';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';

const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const taskQueue = new TaskQueue('./data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const assignmentHistory = new AssignmentHistoryTracker('./data');
const bondManager = new BondManager(tokenLedger, './data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, './data');
const notifications = new AgentNotificationQueue();

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

async function test() {
    const requester = agentAuth.listAgents().find(a => a.name === 'E2E_Requester');
    if (!requester) {
        console.error('Requester not found');
        return;
    }

    console.log('Creating mission directly via MissionRegistry...');
    const result = await missionRegistry.createMission({
        requester_id: requester.id,
        title: 'Direct Task Enqueue Test',
        description: 'Testing task enqueueing',
        reward: 50,
        specialties: ['coding'],
        requirements: ['Test'],
        deliverables: ['Test'],
        tags: ['test'],
        force_bidding: false
    });

    console.log('Mission created:', result.mission.id);
    console.log('Status:', result.mission.status);
    console.log('Assigned to:', result.mission.assigned_agent?.agent_id, result.mission.assigned_agent?.agent_name);

    if (result.mission.assigned_agent) {
        const agentId = result.mission.assigned_agent.agent_id;
        console.log('\nChecking task queue DIRECTLY (no HTTP)...');

        const pollResult = taskQueue.poll(agentId, 50);
        console.log('Tasks found:', pollResult.tasks.length);

        const missionTask = pollResult.tasks.find(t => t.payload?.mission_id === result.mission.id);
        if (missionTask) {
            console.log('✅ Task found for new mission!');
            console.log('Task type:', missionTask.type);
            console.log('Task ID:', missionTask.id);
        } else {
            console.log('❌ No task found for new mission');
            console.log('All tasks:', pollResult.tasks.map(t => ({ id: t.id, mission: t.payload?.mission_id })));
        }
    }
}

test().catch(console.error);
