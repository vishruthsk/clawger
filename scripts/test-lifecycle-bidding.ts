#!/usr/bin/env tsx
/**
 * ✅ CRITICAL: Bidding Mode Lifecycle E2E Test
 * 
 * Tests that bidding missions work correctly through full lifecycle:
 * 1. Create mission (bidding mode)
 * 2. Submit bid
 * 3. Close bidding
 * 4. Verify assignment
 * 5. Run full lifecycle
 * 6. Verify persistence
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { TokenLedger } from '../core/ledger/token-ledger';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { ReputationEngine } from '../core/agents/reputation-engine';
import { JobHistoryManager } from '../core/jobs/job-history-manager';

async function testBiddingLifecycle() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   BIDDING MODE LIFECYCLE E2E TEST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Initialize systems
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const tokenLedger = new TokenLedger('./data');
    const escrowEngine = new EscrowEngine(tokenLedger);
    const assignmentHistory = new AssignmentHistoryTracker('./data');
    const bondManager = new BondManager(tokenLedger, './data');
    const reputationEngine = new ReputationEngine('./data');
    const jobHistory = new JobHistoryManager('./data');
    const settlementEngine = new SettlementEngine(
        tokenLedger,
        bondManager,
        agentAuth,
        jobHistory,
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
        settlementEngine,
        reputationEngine
    );

    // Get available agents
    const agents = agentAuth.listAgents().filter(a => a.available);
    if (agents.length < 2) {
        console.error('❌ Need at least 2 available agents. Please run reset script first.');
        return false;
    }

    console.log(`✅ Found ${agents.length} available agents\n`);

    // Fund requester
    const requesterId = 'test_requester_bidding';
    tokenLedger.mint(requesterId, 50000);

    try {
        // ============================================
        // STEP 1: Create mission in bidding mode
        // ============================================
        console.log('📝 STEP 1: Creating mission in bidding mode\n');

        const result = await missionRegistry.createMission({
            requester_id: requesterId,
            title: 'Test Bidding Mission',
            description: 'Testing bidding lifecycle persistence',
            reward: 1000,  // >= 500 threshold triggers bidding
            specialties: ['coding'],
            requirements: ['Test'],
            deliverables: ['Code']
        });

        const missionId = result.mission.id;
        console.log(`   Created: ${missionId}`);
        console.log(`   Assignment mode: ${result.assignment_mode}`);
        console.log(`   Status: ${result.mission.status}`);

        if (result.assignment_mode !== 'bidding') {
            throw new Error(`Expected bidding mode, got ${result.assignment_mode}`);
        }

        if (result.mission.status !== 'bidding_open') {
            throw new Error(`Expected bidding_open status, got ${result.mission.status}`);
        }

        console.log(`   ✅ Mission in bidding_open state\n`);

        // ============================================
        // STEP 2: Submit bid
        // ============================================
        console.log('💰 STEP 2: Submitting bid\n');

        const bidder = agents[0];
        const bidResult = await missionRegistry.submitBid(missionId, bidder.id, {
            price: 900,
            eta_minutes: 120,
            bond_offered: 100,
            message: 'I can deliver high quality work'
        });

        if (!bidResult.success) {
            throw new Error(`Bid submission failed: ${bidResult.reason}`);
        }

        console.log(`   ✅ Bid submitted by ${bidder.name}\n`);

        // ============================================
        // STEP 3: Close bidding
        // ============================================
        console.log('🔒 STEP 3: Closing bidding window\n');

        // Access private method via any cast (for testing)
        await (missionRegistry as any).closeBiddingAndAssign(missionId);

        const afterBidding = missionStore.get(missionId);
        if (!afterBidding) {
            throw new Error('Mission not found after bidding');
        }

        console.log(`   Status after bidding: ${afterBidding.status}`);
        console.log(`   Assigned to: ${afterBidding.assigned_agent?.agent_name || 'none'}`);

        if (afterBidding.status !== 'assigned') {
            throw new Error(`Expected assigned status, got ${afterBidding.status}`);
        }

        if (!afterBidding.assigned_agent) {
            throw new Error('No agent assigned after bidding');
        }

        console.log(`   ✅ Mission assigned to ${afterBidding.assigned_agent.agent_name}\n`);

        // ============================================
        // STEP 4: Run full lifecycle
        // ============================================
        console.log('🔄 STEP 4: Running full lifecycle\n');

        const agentId = afterBidding.assigned_agent.agent_id;

        // Start mission
        const startResult = await missionRegistry.startMission(missionId, agentId);
        if (!startResult.success) {
            throw new Error(`Start failed: ${startResult.error}`);
        }
        console.log(`   ✅ Started (bond: ${startResult.bondStaked})`);

        // Submit work
        const submitSuccess = missionRegistry.submitWork(
            missionId,
            agentId,
            'Bidding test work completed',
            [
                {
                    filename: 'test.txt',
                    original_filename: 'test.txt',
                    url: '/test.txt',
                    size: 100,
                    mime_type: 'text/plain',
                    uploaded_by: agentId,
                    uploaded_at: new Date()
                }
            ]
        );

        if (!submitSuccess) {
            throw new Error('Submit failed');
        }
        console.log(`   ✅ Work submitted\n`);

        // ============================================
        // STEP 5: Verify persistence
        // ============================================
        console.log('📊 STEP 5: Verifying persistence\n');

        const persisted = missionStore.get(missionId);
        if (!persisted) {
            throw new Error('Mission not found after lifecycle');
        }

        console.log(`   Status: ${persisted.status}`);
        console.log(`   Posted at: ${persisted.posted_at ? '✅' : '❌'}`);
        console.log(`   Assigned at: ${persisted.assigned_at ? '✅' : '❌'}`);
        console.log(`   Executing started: ${persisted.executing_started_at ? '✅' : '❌'}`);
        console.log(`   Verifying started: ${persisted.verifying_started_at ? '✅' : '❌'}`);
        console.log(`   Submission: ${persisted.submission ? '✅' : '❌'}`);
        console.log(`   Work artifacts: ${persisted.work_artifacts?.length || 0} files`);

        if (!persisted.assigned_at) {
            throw new Error('Missing assigned_at timestamp');
        }

        if (!persisted.executing_started_at) {
            throw new Error('Missing executing_started_at timestamp');
        }

        if (!persisted.verifying_started_at) {
            throw new Error('Missing verifying_started_at timestamp');
        }

        if (!persisted.submission) {
            throw new Error('Missing submission data');
        }

        console.log(`\n✅ BIDDING MODE E2E TEST PASSED\n`);
        return true;

    } catch (error: any) {
        console.error(`\n❌ BIDDING MODE E2E TEST FAILED: ${error.message}\n`);
        return false;
    }
}

testBiddingLifecycle().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('CRITICAL TEST FAILURE:', error);
    process.exit(1);
});
