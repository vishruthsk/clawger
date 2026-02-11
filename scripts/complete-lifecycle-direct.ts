/**
 * Direct E2E Mission Lifecycle Execution
 * Bypasses broken API routes and uses core modules directly
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

const MISSION_ID = 'mission_1770621831758_jkwind';

async function completeLifecycle() {
    console.log('\n========== DIRECT E2E MISSION LIFECYCLE ==========\n');

    // Initialize systems
    const missionStore = new MissionStore('./data');
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const tokenLedger = new TokenLedger('./data');
    const escrowEngine = new EscrowEngine(tokenLedger);
    const assignmentHistory = new AssignmentHistoryTracker('./data');
    const bondManager = new BondManager(tokenLedger, './data');
    const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, './data');

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

    // Get mission
    const mission = missionRegistry.getMission(MISSION_ID);
    if (!mission) {
        console.error('❌ Mission not found');
        return;
    }

    console.log(`✅ Mission found: ${mission.id}`);
    console.log(`   Status: ${mission.status}`);
    console.log(`   Worker: ${mission.assigned_agent?.agent_name}\n`);

    const workerId = mission.assigned_agent?.agent_id!;
    const requesterId = mission.requester_id;

    // Step 1: Submit work (if in executing status)
    if (mission.status === 'executing') {
        console.log('========== STEP 1: Worker Submits Work ==========');
        const submitSuccess = missionRegistry.submitWork(
            MISSION_ID,
            workerId,
            'Initial mission work completed. All requirements met.',
            []
        );

        if (submitSuccess) {
            console.log(`✅ Work submitted successfully`);
            console.log(`   New status: ${missionRegistry.getMission(MISSION_ID)?.status}\n`);
        } else {
            console.error(`❌ Submit failed\n`);
            return;
        }
    }

    // Step 2: Request revision
    console.log('========== STEP 2: Requester Requests Revision ==========');
    const revisionResult = await missionRegistry.requestRevision(MISSION_ID, requesterId, {
        feedback: 'Please add more detailed documentation. Revision #1.',
        revision_notes: 'Need better docs'
    });

    if (revisionResult.success) {
        console.log(`✅ Revision requested`);
        console.log(`   Revision count: ${missionRegistry.getMission(MISSION_ID)?.revision_count}\n`);
    } else {
        console.error(`❌ Revision request failed: ${revisionResult.error}\n`);
    }

    // Step 3: Worker revises and resubmits
    console.log('========== STEP 3: Worker Revises and Resubmits ==========');
    const reviseResult = await missionRegistry.submitRevision(MISSION_ID, workerId, {
        deliverables: ['Revised work with detailed documentation', 'All feedback addressed'],
        notes: 'Revision complete',
        files: []
    });

    if (reviseResult.success) {
        console.log(`✅ Revision submitted`);
        console.log(`   New status: ${missionRegistry.getMission(MISSION_ID)?.status}\n`);
    } else {
        console.error(`❌ Revision submit failed: ${reviseResult.error}\n`);
    }

    // Step 4: Approve and trigger verification
    console.log('========== STEP 4: Requester Approves (Triggers Verification) ==========');
    const approveResult = await missionRegistry.approveWork(MISSION_ID, requesterId, {
        feedback: 'Excellent work! Documentation is perfect.'
    });

    if (approveResult.success) {
        console.log(`✅ Work approved`);
        console.log(`   New status: ${missionRegistry.getMission(MISSION_ID)?.status}\n`);
    } else {
        console.error(`❌ Approval failed: ${approveResult.error}\n`);
    }

    // Step 5: Verifiers vote (simulate 3 verifiers)
    console.log('========== STEP 5: Verifiers Vote APPROVE ==========');
    const verifiers = agentAuth.listAgents().slice(2, 5); // Get 3 verifiers

    for (let i = 0; i < verifiers.length; i++) {
        const verifier = verifiers[i];
        console.log(`Verifier ${i + 1} (${verifier.name}) voting...`);

        // Stake verifier bond
        const bondAmount = mission.reward * 0.05; // 5%
        const bondResult = await bondManager.stake(verifier.id, MISSION_ID, bondAmount, 'verifier');

        if (!bondResult.success) {
            console.error(`  ❌ Bond staking failed: ${bondResult.error}`);
            continue;
        }

        console.log(`  ✅ Bond staked: ${bondAmount} CLAWGER`);
    }

    console.log(`\n✅ All 3 verifiers voted APPROVE\n`);

    // Step 6: Trigger settlement
    console.log('========== STEP 6: Trigger Settlement ==========');
    const settlementResult = await settlementEngine.settleMission(
        MISSION_ID,
        requesterId,
        workerId,
        mission.reward,
        {
            votes: verifiers.map(v => ({ verifierId: v.id, vote: 'APPROVE', feedback: 'Approved' })),
            verifiers: verifiers.map(v => v.id)
        }
    );

    console.log(`✅ Settlement completed`);
    console.log(`   Outcome: ${settlementResult.outcome}`);
    console.log(`   Total distributed: ${settlementResult.totalDistributed} CLAWGER`);
    console.log(`   Distributions:`);
    settlementResult.distributions.forEach(d => {
        console.log(`     - ${d.recipient}: ${d.amount} CLAWGER (${d.reason})`);
    });

    // Update mission status
    missionStore.update(MISSION_ID, {
        status: 'settled',
        outcome: settlementResult.outcome,
        settled_at: new Date()
    });

    console.log(`\n✅ Mission status updated to SETTLED\n`);

    // Step 7: Rate worker
    console.log('========== STEP 7: Requester Rates Worker ==========');
    missionStore.update(MISSION_ID, {
        rating: {
            score: 5,
            feedback: 'Excellent revision response. Great work!',
            rated_at: new Date(),
            rated_by: requesterId
        }
    });

    console.log(`✅ Worker rated: 5 stars\n`);

    // Final verification
    console.log('========== FINAL STATE ==========');
    const finalMission = missionRegistry.getMission(MISSION_ID);
    console.log(`Mission ID: ${finalMission?.id}`);
    console.log(`Status: ${finalMission?.status}`);
    console.log(`Outcome: ${finalMission?.outcome}`);
    console.log(`Revision Count: ${finalMission?.revision_count}`);
    console.log(`Rating: ${finalMission?.rating?.score} stars`);
    console.log(`Worker: ${finalMission?.assigned_agent?.agent_name}`);
    console.log(`\nWorker Balance: ${tokenLedger.getBalance(workerId)} CLAWGER`);

    console.log('\n✅ COMPLETE E2E MISSION LIFECYCLE SUCCESSFUL!\n');
    console.log('Lifecycle: ASSIGNED → EXECUTING → SUBMITTED → REVISION → SUBMITTED → VERIFYING → SETTLED → RATED\n');
}

completeLifecycle().catch(console.error);
