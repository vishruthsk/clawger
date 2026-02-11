#!/usr/bin/env tsx
/**
 * Complete Mission Lifecycle Demo
 * 
 * Creates missions and takes them through the FULL lifecycle:
 * 1. Create mission (sets posted_at)
 * 2. Assign to agent (sets assigned_at)
 * 3. Start execution (sets executing_started_at)
 * 4. Submit work with deliverables (sets verifying_started_at, submission, work_artifacts)
 * 5. Verify and settle (sets settled_at)
 * 
 * This ensures all timeline events and deliverables are properly recorded.
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

async function runFullLifecycleDemo() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FULL LIFECYCLE DEMO');
    console.log('   Creating missions with complete timeline');
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
        console.error('❌ No available agents found. Please register agents first.');
        return;
    }

    console.log(`✅ Found ${agents.length} available agents\n`);

    // Fund requester
    const requesterId = 'demo_requester';
    tokenLedger.mint(requesterId, 100000);
    console.log(`✅ Funded requester with 100,000 CLAWGER\n`);

    // Create 3 missions with different states
    const missions = [
        {
            title: 'Deploy CLAWGER Protocol V1',
            description: 'Initial deployment and verification of the core protocol contracts.',
            reward: 5000,
            specialties: ['Smart Contracts', 'Protocol'],
            requirements: ['Solidity', 'Security Audit'],
            deliverables: ['Deployed Address', 'Verification Proof'],
            tags: ['critical', 'protocol']
        },
        {
            title: 'UI Polish and Refinements',
            description: 'Polish UI based on user feedback',
            reward: 400,
            specialties: ['Design'],
            requirements: ['Address feedback'],
            deliverables: ['Updated UI'],
            tags: ['design']
        },
        {
            title: 'Monitor Competitor DEX Volume',
            description: 'Real-time monitoring of volume spikes on Uniswap V3 pools for the next 24 hours.',
            reward: 800,
            specialties: ['Data Analysis', 'Monitoring', 'DeFi'],
            requirements: ['Real-time data'],
            deliverables: ['Volume report', 'Alert system'],
            tags: ['data', 'monitoring', 'defi']
        }
    ];

    for (let i = 0; i < missions.length; i++) {
        const missionSpec = missions[i];
        console.log(`\n📝 Creating Mission ${i + 1}: ${missionSpec.title}`);

        try {
            // Step 1: Create mission (sets posted_at)
            const result = await missionRegistry.createMission({
                requester_id: requesterId,
                ...missionSpec,
                timeout_seconds: 3600
            });

            const missionId = result.mission.id;
            console.log(`✅ Mission created: ${missionId}`);
            console.log(`   Status: ${result.mission.status}`);
            console.log(`   Posted at: ${result.mission.posted_at}`);

            // Step 2: Mission is auto-assigned (sets assigned_at)
            if (result.mission.assigned_agent) {
                console.log(`✅ Auto-assigned to: ${result.mission.assigned_agent.agent_name}`);
                console.log(`   Assigned at: ${result.mission.assigned_at}`);

                const agentId = result.mission.assigned_agent.agent_id;

                // Wait a bit for realism
                await new Promise(resolve => setTimeout(resolve, 100));

                // Step 3: Start execution (sets executing_started_at)
                console.log(`🏃 Starting execution...`);
                const startResult = await missionRegistry.startMission(missionId, agentId);

                if (startResult.success) {
                    console.log(`✅ Execution started`);
                    console.log(`   Bond staked: ${startResult.bondStaked} CLAWGER`);

                    const updatedMission = missionStore.get(missionId);
                    if (updatedMission) {
                        console.log(`   Executing started at: ${updatedMission.executing_started_at}`);
                    }

                    // Wait a bit for realism
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // Step 4: Submit work with deliverables (sets verifying_started_at, submission, work_artifacts)
                    console.log(`📤 Submitting work...`);

                    const workContent = `Completed: ${missionSpec.title}\n\nDeliverables:\n${missionSpec.deliverables.map(d => `- ${d}`).join('\n')}\n\nAll requirements met successfully.`;

                    const artifacts = missionSpec.deliverables.map((deliverable, idx) => ({
                        filename: `${Date.now()}_${deliverable.toLowerCase().replace(/\s+/g, '_')}.pdf`,
                        original_filename: `${deliverable}.pdf`,
                        url: `/uploads/${missionId}/${deliverable.toLowerCase().replace(/\s+/g, '_')}.pdf`,
                        size: 1024 * (idx + 1),
                        mime_type: 'application/pdf',
                        uploaded_by: agentId,
                        uploaded_at: new Date()
                    }));

                    const submitSuccess = missionRegistry.submitWork(
                        missionId,
                        agentId,
                        workContent,
                        artifacts
                    );

                    if (submitSuccess) {
                        console.log(`✅ Work submitted`);
                        console.log(`   Artifacts: ${artifacts.length} files`);

                        const verifyingMission = missionStore.get(missionId);
                        if (verifyingMission) {
                            console.log(`   Verifying started at: ${verifyingMission.verifying_started_at}`);
                            console.log(`   Submission content: ${workContent.substring(0, 50)}...`);
                        }

                        // For missions 1 and 2, complete the settlement
                        if (i < 2) {
                            await new Promise(resolve => setTimeout(resolve, 100));

                            // Step 5: Settle mission (sets settled_at)
                            console.log(`💰 Settling mission...`);

                            const settleResult = await settlementEngine.settleMission(
                                missionId,
                                true, // approved
                                'Excellent work, all deliverables met expectations'
                            );

                            if (settleResult.success) {
                                console.log(`✅ Mission settled`);
                                console.log(`   Worker paid: ${settleResult.worker_payout} CLAWGER`);

                                const settledMission = missionStore.get(missionId);
                                if (settledMission) {
                                    console.log(`   Settled at: ${settledMission.settled_at}`);
                                    console.log(`   Final status: ${settledMission.status}`);
                                }
                            }
                        } else {
                            console.log(`⏳ Mission ${i + 1} left in verifying state`);
                        }
                    }
                }
            }

        } catch (error: any) {
            console.error(`❌ Error processing mission ${i + 1}:`, error.message);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   DEMO COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Created 3 missions with full lifecycle:');
    console.log('   • Mission 1: PAID (complete timeline)');
    console.log('   • Mission 2: PAID (complete timeline)');
    console.log('   • Mission 3: VERIFYING (has deliverables)');
    console.log('\n📊 Timeline events recorded:');
    console.log('   ✓ Posted');
    console.log('   ✓ Assigned');
    console.log('   ✓ Executing');
    console.log('   ✓ Verifying');
    console.log('   ✓ Paid (for settled missions)');
    console.log('\n📦 Deliverables recorded:');
    console.log('   ✓ Submission content');
    console.log('   ✓ Work artifacts (files)');
    console.log('\n🎉 All missions now have complete data!\n');
}

runFullLifecycleDemo().catch(console.error);
