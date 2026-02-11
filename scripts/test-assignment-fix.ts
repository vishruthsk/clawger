/**
 * Test Assignment Engine Fix
 * 
 * Creates a new mission to verify the assignment engine fixes work correctly.
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

async function testAssignmentFix() {
    console.log('\n========== TESTING ASSIGNMENT ENGINE FIX ==========\n');

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

    // Check current state
    const allMissions = missionStore.list();
    const failedMissions = allMissions.filter(m => m.status === 'failed');
    const assignedMissions = allMissions.filter(m => m.status === 'assigned');

    console.log(`Current state:`);
    console.log(`  Total missions: ${allMissions.length}`);
    console.log(`  Failed missions: ${failedMissions.length}`);
    console.log(`  Assigned missions: ${assignedMissions.length}`);

    // Check available coding agents
    const allAgents = agentAuth.listAgents();
    const codingAgents = allAgents.filter(a =>
        a.available && a.specialties?.some(s => s.toLowerCase().includes('coding'))
    );

    console.log(`\nAvailable coding agents: ${codingAgents.length}`);
    codingAgents.forEach(agent => {
        const activeMissions = allMissions.filter(m =>
            m.assigned_agent?.agent_id === agent.id &&
            ['assigned', 'executing', 'verifying'].includes(m.status)
        );
        console.log(`  - ${agent.name}: ${activeMissions.length} active missions`);
    });

    // Create test mission
    console.log(`\n========== CREATING TEST MISSION ==========\n`);

    const result = await missionRegistry.createMission({
        requester_id: '0xTEST_REQUESTER',
        title: 'Test Assignment Fix: Simple Coding Task',
        description: 'This mission tests if the assignment engine fix works correctly',
        reward: 50,
        specialties: ['coding'],
        requirements: ['Test the fix'],
        deliverables: ['Proof it works'],
        tags: ['test']
    });

    console.log(`\n========== RESULT ==========\n`);
    console.log(`Mission ID: ${result.mission.id}`);
    console.log(`Status: ${result.mission.status}`);
    console.log(`Assignment mode: ${result.assignment_mode}`);

    if (result.assigned_agent) {
        console.log(`✅ ASSIGNED to: ${result.assigned_agent.agent_name}`);
        console.log(`Assignment reasoning:`);
        console.log(`  Base score: ${result.assignment_reasoning?.base_score.toFixed(3)}`);
        console.log(`  Recent wins: ${result.assignment_reasoning?.recent_wins}`);
        console.log(`  Adjusted score: ${result.assignment_reasoning?.adjusted_score.toFixed(3)}`);
        console.log(`  Rank: ${result.assignment_reasoning?.rank_in_pool}/${result.assignment_reasoning?.pool_size}`);
    } else {
        console.log(`❌ FAILED: ${result.mission.failure_reason}`);
    }

    // Check if task was dispatched
    const tasks = taskQueue.poll(result.assigned_agent?.agent_id || '', 10);
    console.log(`\nTasks dispatched: ${tasks.tasks.length}`);
    if (tasks.tasks.length > 0) {
        console.log(`✅ Task dispatched successfully`);
        console.log(`  Type: ${tasks.tasks[0].type}`);
        console.log(`  Priority: ${tasks.tasks[0].priority}`);
    }

    console.log(`\n========== TEST COMPLETE ==========\n`);
}

testAssignmentFix().catch(console.error);
