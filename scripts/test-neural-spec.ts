#!/usr/bin/env ts-node
/**
 * Test Neural Spec Enforcement in Mission Assignment
 * 
 * This script verifies that the assignment engine correctly enforces
 * neural spec limits during mission assignment.
 */

import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AssignmentEngine } from '../core/missions/assignment-engine';
import { BiddingEngine } from '../core/missions/bidding-engine';
import { AgentAuth } from '../core/registry/agent-auth';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { EscrowEngine } from '../escrow/escrow-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { TokenLedger } from '../core/ledger/token-ledger';

async function testNeuralSpecEnforcement() {
    console.log('\n🧪 TESTING NEURAL SPEC ENFORCEMENT\n');
    console.log('='.repeat(80) + '\n');

    // Initialize dependencies
    const agentAuth = new AgentAuth('./data');
    const missionStore = new MissionStore('./data');
    const notifications = new AgentNotificationQueue();
    const taskQueue = new TaskQueue();
    const heartbeatManager = new HeartbeatManager();
    const tokenLedger = new TokenLedger('./data');
    const escrowEngine = new EscrowEngine(tokenLedger);
    const assignmentHistory = new AssignmentHistoryTracker('./data');
    const bondManager = new BondManager(tokenLedger);
    const settlementEngine = new SettlementEngine(tokenLedger, bondManager, missionStore);

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

    // Get seeded agents
    const agents = agentAuth.listAgents();
    const designMaster = agents.find(a => a.name === 'DesignMaster');
    const codeWizard = agents.find(a => a.name === 'CodeWizard');

    if (!designMaster || !codeWizard) {
        console.error('❌ Seeded agents not found. Run npm run reset:economy first.');
        process.exit(1);
    }

    console.log('📋 Seeded Agents:\n');
    console.log(`  DesignMaster (${designMaster.id})`);
    console.log(`    - Max Reward: ${designMaster.neural_spec?.mission_limits.max_reward} CLAWGER`);
    console.log(`    - Max Concurrent: ${designMaster.neural_spec?.mission_limits.max_concurrent}`);
    console.log(`    - Capabilities: ${designMaster.neural_spec?.capabilities.join(', ')}\n`);

    console.log(`  CodeWizard (${codeWizard.id})`);
    console.log(`    - Max Reward: ${codeWizard.neural_spec?.mission_limits.max_reward} CLAWGER`);
    console.log(`    - Max Concurrent: ${codeWizard.neural_spec?.mission_limits.max_concurrent}`);
    console.log(`    - Capabilities: ${codeWizard.neural_spec?.capabilities.join(', ')}\n`);

    console.log('='.repeat(80) + '\n');

    // Test 1: Reward Limit Enforcement
    console.log('TEST 1: Reward Limit Enforcement\n');
    console.log('Creating mission with 600 CLAWGER reward (design specialty)...');
    console.log('Expected: DesignMaster rejected (max: 500), CodeWizard eligible (max: 800)\n');

    try {
        // Mint tokens for requester
        tokenLedger.mint('test_requester', 10000);

        const result1 = await missionRegistry.createMission({
            requester_id: 'test_requester',
            title: 'High-Value Design Mission',
            description: 'Premium UI/UX design work',
            reward: 600,
            specialties: ['design'],
            requirements: ['Premium design skills'],
            deliverables: ['Design mockups']
        });

        console.log(`✅ Mission created: ${result1.mission.id}`);
        console.log(`   Assignment mode: ${result1.assignment_mode}`);
        if (result1.assigned_agent) {
            console.log(`   Assigned to: ${result1.assigned_agent.agent_name}`);
            if (result1.assigned_agent.agent_name === 'CodeWizard') {
                console.log('   ✅ PASS: CodeWizard assigned (DesignMaster correctly rejected due to reward limit)\n');
            } else {
                console.log('   ❌ FAIL: DesignMaster should have been rejected\n');
            }
        } else {
            console.log('   ⚠️  No agent assigned\n');
        }
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}\n`);
    }

    // Test 2: Capability Matching
    console.log('='.repeat(80) + '\n');
    console.log('TEST 2: Capability Matching\n');
    console.log('Creating mission with 400 CLAWGER reward (coding specialty)...');
    console.log('Expected: DesignMaster rejected (no coding capability), CodeWizard eligible\n');

    try {
        const result2 = await missionRegistry.createMission({
            requester_id: 'test_requester',
            title: 'Backend Development',
            description: 'Build REST API',
            reward: 400,
            specialties: ['coding'],
            requirements: ['Backend expertise'],
            deliverables: ['Working API']
        });

        console.log(`✅ Mission created: ${result2.mission.id}`);
        console.log(`   Assignment mode: ${result2.assignment_mode}`);
        if (result2.assigned_agent) {
            console.log(`   Assigned to: ${result2.assigned_agent.agent_name}`);
            if (result2.assigned_agent.agent_name === 'CodeWizard') {
                console.log('   ✅ PASS: CodeWizard assigned (DesignMaster correctly rejected due to capability mismatch)\n');
            } else {
                console.log('   ❌ FAIL: CodeWizard should have been assigned\n');
            }
        } else {
            console.log('   ⚠️  No agent assigned\n');
        }
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}\n`);
    }

    // Test 3: Design mission within DesignMaster's limits
    console.log('='.repeat(80) + '\n');
    console.log('TEST 3: Design Mission Within Limits\n');
    console.log('Creating mission with 400 CLAWGER reward (design specialty)...');
    console.log('Expected: DesignMaster eligible and assigned\n');

    try {
        const result3 = await missionRegistry.createMission({
            requester_id: 'test_requester',
            title: 'UI Design',
            description: 'Design landing page',
            reward: 400,
            specialties: ['design'],
            requirements: ['UI/UX skills'],
            deliverables: ['Design files']
        });

        console.log(`✅ Mission created: ${result3.mission.id}`);
        console.log(`   Assignment mode: ${result3.assignment_mode}`);
        if (result3.assigned_agent) {
            console.log(`   Assigned to: ${result3.assigned_agent.agent_name}`);
            if (result3.assigned_agent.agent_name === 'DesignMaster') {
                console.log('   ✅ PASS: DesignMaster assigned (within reward and capability limits)\n');
            } else {
                console.log('   ⚠️  Assigned to different agent\n');
            }
        } else {
            console.log('   ❌ FAIL: Should have assigned an agent\n');
        }
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}\n`);
    }

    console.log('='.repeat(80) + '\n');
    console.log('✅ NEURAL SPEC ENFORCEMENT TESTS COMPLETE\n');
}

testNeuralSpecEnforcement().catch(console.error);
