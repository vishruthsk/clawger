/**
 * Create Successful Test Mission
 * 
 * Funds the requester and creates a mission to verify end-to-end success.
 */

import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AgentAuth } from '../core/registry/agent-auth';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { TokenLedger } from '../core/ledger/token-ledger';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';

async function createSuccessfulMission() {
    console.log('\n========== CREATING SUCCESSFUL MISSION ==========\n');

    // Initialize core systems
    const missionStore = new MissionStore();
    const agentAuth = new AgentAuth();
    const notifications = new AgentNotificationQueue();
    const taskQueue = new TaskQueue();
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const tokenLedger = new TokenLedger();
    const escrowEngine = new EscrowEngine(tokenLedger);
    const assignmentHistory = new AssignmentHistoryTracker();
    const bondManager = new BondManager(tokenLedger, './data');
    const settlementEngine = new SettlementEngine(
        tokenLedger,
        bondManager,
        agentAuth,
        './data'
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
        settlementEngine
    );

    const requesterId = '0xSUCCESS_TEST';

    // Fund the requester
    console.log(`Funding requester ${requesterId} with 10,000 CLAWGER...`);
    tokenLedger.mint(requesterId, 10000);
    const balance = tokenLedger.getBalance(requesterId);
    console.log(`✅ Requester balance: ${balance} CLAWGER\n`);

    // Create mission
    console.log(`Creating mission with 50 CLAWGER reward...`);
    const result = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'SUCCESS TEST: Simple Coding Task',
        description: 'This mission should assign successfully with proper funding',
        reward: 50,
        specialties: ['coding'],
        requirements: ['Complete the task'],
        deliverables: ['Working code'],
        tags: ['test', 'success']
    });

    console.log(`\n========== RESULT ==========\n`);
    console.log(`Mission ID: ${result.mission.id}`);
    console.log(`Status: ${result.mission.status}`);

    if (result.assigned_agent) {
        console.log(`\n✅✅✅ SUCCESS! MISSION ASSIGNED ✅✅✅`);
        console.log(`\nAssigned to: ${result.assigned_agent.agent_name}`);
        console.log(`Agent ID: ${result.assigned_agent.agent_id}`);

        if (result.assignment_reasoning) {
            console.log(`\nAssignment Reasoning:`);
            console.log(`  Base score: ${result.assignment_reasoning.base_score.toFixed(3)}`);
            console.log(`  Recent wins: ${result.assignment_reasoning.recent_wins}`);
            console.log(`  Diminishing multiplier: ${result.assignment_reasoning.diminishing_multiplier.toFixed(3)}`);
            console.log(`  Adjusted score: ${result.assignment_reasoning.adjusted_score.toFixed(3)}`);
            console.log(`  Rank: ${result.assignment_reasoning.rank_in_pool}/${result.assignment_reasoning.pool_size}`);
        }

        // Check task dispatch
        const tasks = taskQueue.poll(result.assigned_agent.agent_id, 10);
        console.log(`\nTask Dispatch:`);
        console.log(`  Tasks in queue: ${tasks.tasks.length}`);
        if (tasks.tasks.length > 0) {
            const missionTask = tasks.tasks.find(t => t.type === 'mission_assigned');
            if (missionTask) {
                console.log(`  ✅ Mission task dispatched`);
                console.log(`  Type: ${missionTask.type}`);
                console.log(`  Priority: ${missionTask.priority}`);
            }
        }

        // Check escrow
        console.log(`\nEscrow:`);
        console.log(`  Locked: ${result.mission.escrow?.locked}`);
        console.log(`  Amount: ${result.mission.escrow?.amount} CLAWGER`);

        const newBalance = tokenLedger.getBalance(requesterId);
        console.log(`  Requester balance after: ${newBalance} CLAWGER`);

        // Get agent's active missions
        const allMissions = missionStore.list();
        const agentActiveMissions = allMissions.filter(m =>
            m.assigned_agent?.agent_id === result.assigned_agent!.agent_id &&
            ['assigned', 'executing', 'verifying'].includes(m.status)
        );
        console.log(`\nAgent Active Missions: ${agentActiveMissions.length}`);

    } else {
        console.log(`\n❌ FAILED: ${result.mission.failure_reason}`);
    }

    console.log(`\n========== TEST COMPLETE ==========\n`);

    return result;
}

createSuccessfulMission().catch(console.error);
