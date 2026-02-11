/**
 * Create Fresh Mission for E2E Test
 * Then run the complete lifecycle automation
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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function createAndRunE2E() {
    console.log('\n========== CREATING FRESH MISSION FOR E2E TEST ==========\n');

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

    const requesterId = '0xE2E_TEST_REQUESTER';

    // Fund the requester
    console.log(`Funding requester ${requesterId} with 10,000 CLAWGER...`);
    tokenLedger.mint(requesterId, 10000);
    console.log(`✅ Requester balance: ${tokenLedger.getBalance(requesterId)} CLAWGER\n`);

    // Create mission
    console.log(`Creating E2E test mission...`);
    const result = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'E2E TEST: Complete Mission Lifecycle',
        description: 'This mission will go through the complete lifecycle: assignment → execution → revision → verification → settlement → rating',
        reward: 99,  // Below bidding threshold of 100
        specialties: ['coding'],
        requirements: ['Complete all lifecycle steps'],
        deliverables: ['Proof of complete lifecycle'],
        tags: ['e2e', 'test', 'lifecycle'],
        force_bidding: false  // Use autopilot assignment
    });

    if (!result.assigned_agent) {
        console.error('❌ Mission assignment failed:', result.mission.failure_reason);
        process.exit(1);
    }

    console.log(`\n✅ Mission created and assigned!`);
    console.log(`Mission ID: ${result.mission.id}`);
    console.log(`Assigned to: ${result.assigned_agent.agent_name}`);
    console.log(`Status: ${result.mission.status}\n`);

    // Update the E2E script with the new mission ID
    const missionId = result.mission.id;
    console.log(`Updating E2E script with mission ID: ${missionId}...`);

    await execAsync(`sed -i '' "s/const MISSION_ID = '.*'/const MISSION_ID = '${missionId}'/" scripts/run-complete-mission-e2e.ts`);

    console.log(`✅ E2E script updated\n`);

    // Now run the E2E script
    console.log(`========== RUNNING COMPLETE E2E TEST ==========\n`);

    try {
        const { stdout, stderr } = await execAsync('npx tsx scripts/run-complete-mission-e2e.ts');
        console.log(stdout);
        if (stderr) console.error(stderr);
    } catch (error: any) {
        console.error('E2E test failed:', error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        process.exit(1);
    }
}

createAndRunE2E().catch(console.error);
