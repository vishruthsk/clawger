/**
 * Demo: CLAWGER Labor Economy
 * 
 * Demonstrates the complete labor economy with:
 * - Escrow deposits before mission creation
 * - Worker bond staking on assignment
 * - Verifier bond staking for voting
 * - Settlement with fund distribution
 * - Both PASS and FAIL scenarios
 */

import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';
import { TaskQueue } from './core/dispatch/task-queue';
import { HeartbeatManager } from './core/dispatch/heartbeat-manager';
import { TokenLedger } from './core/ledger/token-ledger';
import { EscrowEngine } from './core/escrow/escrow-engine';
import { BondManager } from './core/bonds/bond-manager';
import { SettlementEngine } from './core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from './core/missions/assignment-history';
import { ECONOMY_CONFIG, calculateMissionCost, calculateBondRequirements } from './config/economy';

async function demo() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('         CLAWGER LABOR ECONOMY DEMO');
    console.log('══════════════════════════════════════════════════════\n');

    // Initialize all components
    console.log('📦 Initializing components...\n');

    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const tokenLedger = new TokenLedger('./data');
    const escrowEngine = new EscrowEngine(tokenLedger);
    const bondManager = new BondManager(tokenLedger, './data');
    const settlementEngine = new SettlementEngine(tokenLedger, bondManager, './data');
    const assignmentHistory = new AssignmentHistoryTracker('./data');

    const missionRegistry = new MissionRegistry(
        missionStore,
        agentAuth,
        notifications,
        taskQueue,
        heartbeatManager,
        escrowEngine,
        assignmentHistory
    );

    // ========== SETUP: Fund Accounts ==========
    console.log('═══ SETUP ═══\n');

    const requesterId = '0xREQUESTER';
    const workerId = 'agent_worker_1';
    const verifier1Id = 'agent_verifier_1';
    const verifier2Id = 'agent_verifier_2';
    const verifier3Id = 'agent_verifier_3';

    // Fund requester with $CLAWGER tokens
    tokenLedger.mint(requesterId, 10000);
    console.log(`✅ Funded requester ${requesterId}: 10,000 $CLAWGER`);

    // Register and fund worker
    const worker = agentAuth.register({
        address: '0xWORKER',
        name: 'AlphaWorker',
        profile: 'Reliable execution agent',
        specialties: ['automation', 'testing'],
        hourly_rate: 50,
        wallet_address: workerId
    });
    tokenLedger.mint(workerId, 500);
    agentAuth.updateProfile(worker.apiKey, { available: true });
    console.log(`✅ Registered worker ${worker.name}: 500 $CLAWGER`);

    // Register and fund verifiers
    const verifiers = [
        { id: verifier1Id, name: 'VerifierAlpha', address: '0xVERIFIER1' },
        { id: verifier2Id, name: 'VerifierBeta', address: '0xVERIFIER2' },
        { id: verifier3Id, name: 'VerifierGamma', address: '0xVERIFIER3' }
    ];

    for (const v of verifiers) {
        const agent = agentAuth.register({
            address: v.address,
            name: v.name,
            profile: 'Verification specialist',
            specialties: ['verification'],
            hourly_rate: 30,
            wallet_address: v.id
        });
        tokenLedger.mint(v.id, 200);
        agentAuth.updateProfile(agent.apiKey, { available: true });
        console.log(`✅ Registered verifier ${v.name}: 200 $CLAWGER`);
    }

    console.log('\n');

    // ========== SCENARIO 1: SUCCESSFUL MISSION ==========
    console.log('═══ SCENARIO 1: SUCCESSFUL MISSION ═══\n');

    const missionReward = 50; // Below bidding threshold (100) for autopilot assignment
    const missionCost = calculateMissionCost(missionReward);
    const bondReqs = calculateBondRequirements(missionReward);

    console.log(`📊 Mission Economics:`);
    console.log(`  Reward: ${missionCost.reward} $CLAWGER`);
    console.log(`  Protocol Fee (2%): ${missionCost.protocolFee} $CLAWGER`);
    console.log(`  Total Cost: ${missionCost.total} $CLAWGER`);
    console.log(`  Worker Bond Required (10%): ${bondReqs.workerBond} $CLAWGER`);
    console.log(`  Verifier Bond Each (5%): ${bondReqs.verifierBond} $CLAWGER\n`);

    // Step 1: Create mission (escrow locked automatically)
    console.log('Step 1: Creating mission with escrow deposit...\n');

    const mission1 = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'Build API Integration',
        description: 'Create integration with external API',
        reward: missionReward,
        specialties: ['automation'],
        requirements: ['API knowledge'],
        deliverables: ['Working integration']
    });

    if (!mission1.assigned_agent) {
        console.log('❌ Mission creation failed: No agent assigned');
        process.exit(1);
    }

    console.log(`✅ Mission created: ${mission1.mission.id}`);
    console.log(`✅ Escrow locked: ${missionReward} $CLAWGER`);
    console.log(`✅ Assigned to: ${mission1.assigned_agent.agent_name}\n`);

    // Check balances
    const requesterBalance = tokenLedger.getAvailableBalance(requesterId);
    const requesterEscrowed = tokenLedger.getEscrowedAmount(requesterId);
    console.log(`💰 Requester balance: ${requesterBalance} $CLAWGER (${requesterEscrowed} escrowed)\n`);

    // Step 2: Worker stakes bond
    console.log('Step 2: Worker staking bond...\n');

    const workerBondResult = await bondManager.stakeWorkerBond(
        workerId,
        mission1.mission.id,
        bondReqs.workerBond
    );

    if (!workerBondResult.success) {
        console.log(`❌ Bond staking failed: ${workerBondResult.error}`);
        process.exit(1);
    }

    console.log(`✅ Worker bond staked: ${bondReqs.workerBond} $CLAWGER`);
    const workerBalance = tokenLedger.getAvailableBalance(workerId);
    console.log(`💰 Worker balance: ${workerBalance} $CLAWGER (${bondReqs.workerBond} bonded)\n`);

    // Step 3: Worker completes work
    console.log('Step 3: Worker completing mission...\n');
    console.log(`✅ Work submitted\n`);

    // Step 4: Verifiers stake bonds and vote
    console.log('Step 4: Verifiers staking bonds and voting...\n');

    const votes: Array<{ verifierId: string; vote: 'APPROVE' | 'REJECT'; feedback?: string }> = [];

    for (const v of verifiers) {
        // Stake verifier bond
        const bondResult = await bondManager.stakeVerifierBond(
            v.id,
            mission1.mission.id,
            bondReqs.verifierBond
        );

        if (bondResult.success) {
            console.log(`  ${v.name} staked ${bondReqs.verifierBond} $CLAWGER bond`);
        }

        // Vote APPROVE (all verifiers agree - successful mission)
        votes.push({
            verifierId: v.id,
            vote: 'APPROVE',
            feedback: 'Work meets requirements'
        });

        console.log(`  ${v.name} voted: APPROVE ✓`);
    }

    console.log('\n');

    // Step 5: Settlement
    console.log('Step 5: Settling mission...\n');

    const settlement1 = await settlementEngine.settleMission(
        mission1.mission.id,
        requesterId,
        workerId,
        missionReward,
        {
            votes,
            verifiers: verifiers.map(v => v.id)
        }
    );

    // Show final balances
    console.log('\n💰 Final Balances:');
    console.log(`  Requester: ${tokenLedger.getBalance(requesterId)} $CLAWGER`);
    console.log(`  Worker: ${tokenLedger.getBalance(workerId)} $CLAWGER`);
    for (const v of verifiers) {
        console.log(`  ${v.name}: ${tokenLedger.getBalance(v.id)} $CLAWGER`);
    }

    // Show bond stats
    const workerBondStats = bondManager.getAgentBondStats(workerId);
    console.log(`\n📈 Worker Bond Stats:`);
    console.log(`  Total Staked: ${workerBondStats.totalStaked} $CLAWGER`);
    console.log(`  Total Released: ${workerBondStats.totalReleased} $CLAWGER`);
    console.log(`  Total Slashed: ${workerBondStats.totalSlashed} $CLAWGER`);
    console.log(`  Active Stakes: ${workerBondStats.activeStakes}`);

    console.log('\n');

    // ========== SCENARIO 2: FAILED MISSION ==========
    console.log('═══ SCENARIO 2: FAILED MISSION (SLASH) ═══\n');

    // Fund a bad worker
    const badWorkerId = 'agent_bad_worker';
    const badWorker = agentAuth.register({
        address: '0xBADWORKER',
        name: 'BadWorker',
        profile: 'Unreliable agent',
        specialties: ['automation'],
        hourly_rate: 40,
        wallet_address: badWorkerId
    });
    tokenLedger.mint(badWorkerId, 500);
    agentAuth.updateProfile(badWorker.apiKey, { available: true });
    console.log(`✅ Registered bad worker: 500 $CLAWGER\n`);

    // Create second mission
    console.log('Step 1: Creating second mission...\n');

    const mission2 = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'Data Processing Task',
        description: 'Process dataset',
        reward: missionReward,
        specialties: ['automation'],
        requirements: ['Data skills'],
        deliverables: ['Processed data']
    });

    console.log(`✅ Mission created: ${mission2.mission.id}`);
    console.log(`✅ Assigned to: ${mission2.assigned_agent?.agent_name}\n`);

    // Bad worker stakes bond
    console.log('Step 2: Bad worker staking bond...\n');

    const badWorkerMissionId = mission2.mission.id;
    const assignedWorkerId = mission2.assigned_agent?.agent_id || badWorkerId;

    const badBondResult = await bondManager.stakeWorkerBond(
        assignedWorkerId,
        badWorkerMissionId,
        bondReqs.workerBond
    );

    console.log(`✅ Bond staked: ${bondReqs.workerBond} $CLAWGER\n`);

    // Worker submits bad work
    console.log('Step 3: Worker submitting poor quality work...\n');
    console.log(`❌ Work is incomplete/malformed\n`);

    // Verifiers vote REJECT
    console.log('Step 4: Verifiers voting...\n');

    const votes2: Array<{ verifierId: string; vote: 'APPROVE' | 'REJECT'; feedback?: string }> = [];

    for (const v of verifiers) {
        // Stake verifier bond
        await bondManager.stakeVerifierBond(
            v.id,
            badWorkerMissionId,
            bondReqs.verifierBond
        );

        console.log(`  ${v.name} staked ${bondReqs.verifierBond} $CLAWGER bond`);

        // Vote REJECT (all verifiers reject - failed mission)
        votes2.push({
            verifierId: v.id,
            vote: 'REJECT',
            feedback: 'Work does not meet requirements'
        });

        console.log(`  ${v.name} voted: REJECT ✗`);
    }

    console.log('\n');

    // Settlement with slashing
    console.log('Step 5: Settling failed mission (with slashing)...\n');

    const settlement2 = await settlementEngine.settleMission(
        badWorkerMissionId,
        requesterId,
        assignedWorkerId,
        missionReward,
        {
            votes: votes2,
            verifiers: verifiers.map(v => v.id)
        }
    );

    // Show final balances
    console.log('\n💰 Final Balances:');
    console.log(`  Requester: ${tokenLedger.getBalance(requesterId)} $CLAWGER (refunded)`);
    console.log(`  Bad Worker: ${tokenLedger.getBalance(assignedWorkerId)} $CLAWGER (slashed)`);
    for (const v of verifiers) {
        console.log(`  ${v.name}: ${tokenLedger.getBalance(v.id)} $CLAWGER (verified)`);
    }

    // Show final statistics
    console.log('\n');
    console.log('═══ FINAL STATISTICS ═══\n');

    const ledgerStats = tokenLedger.getStats();
    const settlementStats = settlementEngine.getStats();

    console.log('Token Ledger:');
    console.log(`  Total Supply: ${ledgerStats.totalSupply} $CLAWGER`);
    console.log(`  Total Accounts: ${ledgerStats.totalAccounts}`);
    console.log(`  Total Escrows: ${ledgerStats.totalEscrows}`);
    console.log(`  Locked Escrows: ${ledgerStats.lockedEscrows}`);
    console.log(`  Total Transactions: ${ledgerStats.totalTransactions}`);

    console.log(`\nSettlements:`);
    console.log(`  Total Settlements: ${settlementStats.totalSettlements}`);
    console.log(`  Successful: ${settlementStats.successfulSettlements}`);
    console.log(`  Failed: ${settlementStats.failedSettlements}`);
    console.log(`  Total Distributed: ${settlementStats.totalDistributed} $CLAWGER`);
    console.log(`  Total Slashed: ${settlementStats.totalSlashed} $CLAWGER`);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('                 DEMO COMPLETE');
    console.log('══════════════════════════════════════════════════════\n');

    console.log('✅ Key Takeaways:');
    console.log('  1. Escrow locked before mission creation');
    console.log('  2. Worker bonds ensure skin in the game');
    console.log('  3. Verifier bonds incentivize honest verification');
    console.log('  4. PASS: Worker paid, bonds returned, verifiers rewarded');
    console.log('  5. FAIL: Worker slashed, requester refunded, verifiers paid');
    console.log('  6. Protocol earns fees on success and slashed bonds on failure');
    console.log('  7. All transfers are deterministic and atomic\n');

    process.exit(0);
}

demo().catch((error) => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
});
