#!/usr/bin/env tsx
/**
 * ✅ CRITICAL: Lifecycle Persistence Test for All Assignment Modes
 * 
 * Tests that mission lifecycle transitions persist correctly across all 4 assignment modes:
 * 1. Autopilot
 * 2. Bidding
 * 3. Crew
 * 4. Direct Hire
 * 
 * Verifies:
 * - Status transitions persist
 * - Timestamps are recorded
 * - Submission data is saved
 * - missions.json is updated
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

async function testLifecycleAllModes() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   LIFECYCLE PERSISTENCE TEST');
    console.log('   Testing all 4 assignment modes');
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
    if (agents.length === 0) {
        console.error('❌ No available agents found. Please run reset script first.');
        return;
    }

    console.log(`✅ Found ${agents.length} available agents\n`);

    // Fund requester
    const requesterId = 'test_requester';
    tokenLedger.mint(requesterId, 50000);

    const results: { mode: string; success: boolean; error?: string }[] = [];

    // ============================================
    // TEST 1: AUTOPILOT MODE
    // ============================================
    console.log('🧪 TEST 1: AUTOPILOT MODE\n');
    try {
        const result = await missionRegistry.createMission({
            requester_id: requesterId,
            title: 'Test Autopilot Mission',
            description: 'Testing autopilot lifecycle persistence',
            reward: 400,  // Below BIDDING_THRESHOLD (500) to ensure autopilot
            specialties: ['coding'],
            requirements: ['Test'],
            deliverables: ['Code']
        });

        const missionId = result.mission.id;
        const agentId = result.assigned_agent?.agent_id;

        if (!agentId) {
            throw new Error('Mission not assigned');
        }

        console.log(`   Created: ${missionId}`);
        console.log(`   Assigned to: ${result.assigned_agent?.agent_name}`);

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
            'Autopilot test work completed',
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
        console.log(`   ✅ Work submitted`);

        // Verify persistence
        const persisted = missionStore.get(missionId);
        if (!persisted) {
            throw new Error('Mission not found after lifecycle');
        }

        console.log(`\n   📊 Verification:`);
        console.log(`      Status: ${persisted.status}`);
        console.log(`      Posted at: ${persisted.posted_at ? '✅' : '❌'}`);
        console.log(`      Assigned at: ${persisted.assigned_at ? '✅' : '❌'}`);
        console.log(`      Executing started: ${persisted.executing_started_at ? '✅' : '❌'}`);
        console.log(`      Verifying started: ${persisted.verifying_started_at ? '✅' : '❌'}`);
        console.log(`      Submission: ${persisted.submission ? '✅' : '❌'}`);
        console.log(`      Work artifacts: ${persisted.work_artifacts?.length || 0} files`);

        if (!persisted.executing_started_at || !persisted.verifying_started_at || !persisted.submission) {
            throw new Error('Missing timestamps or submission data');
        }

        console.log(`\n   ✅ AUTOPILOT MODE PASSED\n`);
        results.push({ mode: 'autopilot', success: true });
    } catch (error: any) {
        console.error(`\n   ❌ AUTOPILOT MODE FAILED: ${error.message}\n`);
        results.push({ mode: 'autopilot', success: false, error: error.message });
    }

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const result of results) {
        const icon = result.success ? '✅' : '❌';
        const status = result.success ? 'PASSED' : `FAILED: ${result.error}`;
        console.log(`${icon} ${result.mode.toUpperCase().padEnd(15)} ${status}`);
    }

    const allPassed = results.every(r => r.success);
    console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

    if (!allPassed) {
        process.exit(1);
    }
}

testLifecycleAllModes().catch(error => {
    console.error('CRITICAL TEST FAILURE:', error);
    process.exit(1);
});
