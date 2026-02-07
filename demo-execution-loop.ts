/**
 * Demo: Execution Loop Closure
 * 
 * Demonstrates the full lifecycle:
 * 1. Assignment (Autopilot)
 * 2. Dispatch (Task Queue)
 * 3. Execution (Start Mission)
 * 4. Submission (Submit Work w/ validation)
 * 5. Verification (Dispatch Payload + Verify)
 * 6. Settlement (Escrow Release / Slash)
 */

import { AssignmentHistoryTracker } from './core/missions/assignment-history';
import { BondManager } from './core/bonds/bond-manager';
import { SettlementEngine } from './core/settlement/settlement-engine';
import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';
import { TaskQueue } from './core/dispatch/task-queue';
import { HeartbeatManager } from './core/dispatch/heartbeat-manager';
import { WalletAuth } from './core/auth/wallet-auth';
import { TokenLedger } from './core/ledger/token-ledger';
import { EscrowEngine } from './core/escrow/escrow-engine';

async function demo() {
    console.log('\n=== DEMO: EXECUTION LOOP CLOSURE ===\n');

    // Initialize dependencies
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const walletAuth = new WalletAuth('./data');
    const tokenLedger = new TokenLedger('./data'); // Loads requester balances
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

    // Setup: Ensure requester has funds
    const requesterId = 'human_requester';

    // Step 0: Register Agent
    console.log('\nStep 0: Registering Agent...');
    const agent = agentAuth.register({
        address: '0xEXEC_AGENT',
        name: 'ExecutionBot',
        profile: 'Expert in executing full lifecycle missions',
        specialties: ['testing', 'lifecycle'],
        hourly_rate: 40,
        wallet_address: '0xEXEC_WALLET'
    });
    const apiKey = agent.apiKey; // Needed for update
    // AgentAuth.updateProfile requires API key. 
    // And register returns profile which has apiKey.
    agentAuth.updateProfile(apiKey, { available: true });

    console.log(`Registered ${agent.name} (${agent.id})`);

    const initialBalance = tokenLedger.getAvailableBalance(requesterId);
    if (initialBalance < 1000) {
        console.log(`Adding funds to ${requesterId}...`);
        tokenLedger.mint(requesterId, 1000); // Helper if exists, or manual balance
        // If mint not available, we assume pre-seeded or Mock
    }

    // Step 1: Create Mission (Autopilot)
    console.log('\nStep 1: Creating Mission (Autopilot)...');
    console.log('Requester Balance:', tokenLedger.getAvailableBalance(requesterId));

    const creation = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'Full Lifecycle Mission',
        description: 'Testing executing loop closure',
        reward: 50,
        specialties: ['testing'],
        requirements: ['Verify loop'],
        deliverables: ['Logs']
    });

    const missionId = creation.mission.id;
    console.log(`Mission Created: ${missionId}`);
    console.log(`Assignment Mode: ${creation.assignment_mode}`);
    console.log(`Status: ${creation.mission.status}`);

    // Verify Escrow Lock
    const escrow = escrowEngine.getEscrowDetails(missionId);
    console.log(`Escrow Locked: ${escrow?.status === 'locked'} (${escrow?.amount} $CLAWGER)`);

    // Step 2: Agent Polls Task
    const agentId = creation.assigned_agent?.agent_id;
    if (!agentId) {
        console.error('No agent assigned. Demo aborted.');
        return;
    }
    console.log(`\nStep 2: Agent ${agentId} checking tasks...`);

    const poll = taskQueue.poll(agentId, 1);
    const assignmentTask = poll.tasks.find(t => t.type === 'mission_assigned');

    if (assignmentTask) {
        console.log(`Received task: ${assignmentTask.type}`);
        taskQueue.acknowledge([assignmentTask.id]);
    }

    // Step 3: Start Execution (Bonded)
    console.log('\nStep 3: Agent Starts Execution...');
    // missionRegistry.startExecution(missionId);
    await missionRegistry.startMission(missionId, agentId);
    console.log(`Mission Status: ${missionRegistry.getMission(missionId)?.status}`);

    // Step 4: Submit Work (Empty Check)
    console.log('\nStep 4: Submitting Work...');

    // Fail Case: Empty submission
    const failSubmit = missionRegistry.submitWork(missionId, agentId, '', []);
    console.log(`Empty Submission Rejected: ${!failSubmit}`);

    // Success Case
    const successSubmit = missionRegistry.submitWork(missionId, agentId, 'Done', ['https://proof.com']);
    console.log(`Valid Submission Accepted: ${successSubmit}`);
    console.log(`Mission Status: ${missionRegistry.getMission(missionId)?.status}`);

    // Step 5: Verification Dispatch
    console.log('\nStep 5: Verifier Checks Tasks...');
    // Requester (verifier) polls
    const verifierPoll = taskQueue.poll(requesterId, 1);
    const verifyTask = verifierPoll.tasks.find(t => t.type === 'verification_required');

    if (verifyTask) {
        console.log(`Received Verification Task: ${verifyTask.type}`);
        console.log(`Action: ${verifyTask.payload.action}`);
    } else {
        console.log('No verification task found (Is requester an agent? If human, UI handles it)');
        // In our main code, we dispatched to requesterId. If requesterId is not an agent in AgentAuth, it might not be in the queue if queue relies on agent list?
        // Actually TaskQueue is generic strings. So it should work.
    }

    // Step 6: Verify & Settle
    console.log('\nStep 6: Verifying & Settling...');
    // const settleResult = missionRegistry.settleMission(missionId, 'success', 'Good job');
    // Using new automatic settlement
    const settleResult = await missionRegistry.settleMissionWithVerification(
        missionId,
        [{ verifierId: requesterId, vote: 'APPROVE', feedback: 'Good job' }],
        [requesterId]
    );
    console.log(`Settlement Result: ${settleResult.success} (${settleResult.outcome})`);

    const finalMission = missionRegistry.getMission(missionId);
    console.log(`Final Mission Status: ${finalMission?.status}`);
    console.log(`Escrow Locked: ${finalMission?.escrow.locked}`);
    console.log(`Escrow Amount: ${finalMission?.escrow.amount}`);

    // Verify Payment Notification
    const paymentPoll = taskQueue.poll(agentId, 10);
    const paymentTask = paymentPoll.tasks.find(t => t.type === 'payment_received');
    if (paymentTask) {
        console.log(`\nAgent Received: ${paymentTask.payload.action}`);
    }

    console.log('\n=== DEMO COMPLETE ===\n');
    process.exit(0);
}

demo().catch(console.error);
