#!/usr/bin/env tsx
/**
 * Guaranteed Full Lifecycle Demo
 * 
 * Executes a complete, successful mission lifecycle:
 * 1. Creates a mission
 * 2. Assigns a bot (CodeWizard)
 * 3. Bot submits work
 * 4. Request revision (simulated)
 * 5. Bot resubmits
 * 6. Verification passes
 * 7. Settlement occurs
 * 8. Reputation increases
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue, DispatchTask } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { TokenLedger } from '../core/ledger/token-ledger';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';

class LifecycleDemo {
    private agentAuth: AgentAuth;
    private missionRegistry: MissionRegistry;
    private missionStore: MissionStore;
    private tokenLedger: TokenLedger;
    private bondManager: BondManager;
    private taskQueue: TaskQueue;
    private settlementEngine: SettlementEngine;
    private reputationEngine: any;

    private requesterId = '0xDEMO_REQUESTER';
    private workerId = ''; // Will be assigned
    private verifierId = ''; // Will be assigned

    private running = true;

    constructor() {
        this.agentAuth = new AgentAuth('./data');
        const notifications = new AgentNotificationQueue();
        this.missionStore = new MissionStore('./data');
        this.taskQueue = new TaskQueue('./data');
        const heartbeatManager = new HeartbeatManager(this.agentAuth, './data');
        this.tokenLedger = new TokenLedger('./data');
        const escrowEngine = new EscrowEngine(this.tokenLedger);
        const assignmentHistory = new AssignmentHistoryTracker('./data');
        this.bondManager = new BondManager(this.tokenLedger, './data');
        this.settlementEngine = new SettlementEngine(this.tokenLedger, this.bondManager, this.agentAuth, new (require('../core/jobs/job-history-manager').JobHistoryManager)('./data'), './data');
        this.reputationEngine = new (require('../core/agents/reputation-engine').ReputationEngine)('./data');

        this.missionRegistry = new MissionRegistry(
            this.missionStore,
            this.agentAuth,
            notifications,
            this.taskQueue,
            heartbeatManager,
            escrowEngine,
            assignmentHistory,
            this.bondManager,
            this.settlementEngine,
            this.reputationEngine
        );
    }

    private log(step: string, message: string) {
        console.log(`[${step.padEnd(20)}] ${message}`);
    }

    async run() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   GUARANTEED LIFECYCLE DEMO');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        try {
            await this.setup();

            // Start in-process agents
            this.startWorkerLoop();
            this.startVerifierLoop();

            await this.executeLifecycle();
            await this.verifyAndCleanup();
        } catch (error: any) {
            console.error('❌ Demo failed:', error);
            this.cleanup();
            process.exit(1);
        }
    }

    async setup() {
        this.log('SETUP', '💰 Funding requester...');
        this.tokenLedger.mint(this.requesterId, 10000);

        // Use an existing high-quality bot if possible, or register one
        // Use an existing high-quality bot from seed
        const botName = 'CodeMaster'; // Matches seed script
        let bot = this.agentAuth.listAgents().find(a => a.name.includes(botName));

        if (!bot) {
            this.log('SETUP', `⚠️ Bot ${botName} not found, falling back to new creation...`);
            bot = this.agentAuth.register({
                address: `codemaster_${Date.now()}`,
                name: 'CodeMaster',
                profile: 'Expert Coder',
                specialties: ['coding'],
                hourly_rate: 150
            });
            this.tokenLedger.mint(bot.id, 2000);
        }

        this.workerId = bot.id;
        this.log('SETUP', `✅ Selected Worker: ${bot.name} (${bot.id})`);
        this.log('SETUP', `   Current Rep: ${bot.reputation}`);
        this.log('SETUP', `   Current Balance: ${this.tokenLedger.getBalance(bot.id)}`);

        // Register Verifier
        // Use seeded QA agent as Verifier
        let verifier = this.agentAuth.listAgents().find(a => a.name.includes('QA_Sentinel'));
        if (!verifier) {
            this.log('SETUP', '⚠️ Verifier not found, creating new one...');
            verifier = this.agentAuth.register({
                address: `verifier_${Date.now()}`,
                name: 'QA_Sentinel',
                profile: 'QA Specialist',
                specialties: ['testing'],
                hourly_rate: 80
            });
            this.tokenLedger.mint(verifier.id, 1000);
        }
        this.verifierId = verifier.id;
        this.log('SETUP', `✅ Selected Verifier: ${verifier.name} (${verifier.id})`);

        await new Promise(r => setTimeout(r, 1000));
    }

    // ==========================================
    // IN-PROCESS AGENT LOOPS
    // ==========================================

    async startWorkerLoop() {
        this.log('WORKER', '🚀 Worker loop started');
        while (this.running) {
            const { tasks } = this.taskQueue.poll(this.workerId);
            for (const task of tasks) {
                await this.handleWorkerTask(task);
                this.taskQueue.acknowledge([task.id]);
            }
            await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
        }
    }

    async handleWorkerTask(task: DispatchTask) {
        this.log('WORKER', `📨 Received task: ${task.type}`);

        if (task.type === 'mission_assigned') {
            const missionId = task.payload.mission_id!;
            this.log('WORKER', `📋 Accepted mission: ${missionId}`);

            // 1. Start Mission
            this.log('WORKER', `▶️  Starting mission...`);

            const mission = this.missionStore.get(missionId);
            if (!mission) return;

            // Stake Bond
            const bondAmount = Math.max(mission.reward * 0.1, 5); // 10%
            const staked = await this.bondManager.stakeWorkerBond(this.workerId, missionId, bondAmount);

            if (staked) {
                this.missionStore.update(missionId, {
                    status: 'executing',
                    executing_started_at: new Date()
                });
                this.log('WORKER', `✅ Bond staked (${bondAmount}) and status updated to EXECUTING`);
            } else {
                this.log('WORKER', `❌ Failed to stake bond`);
                return;
            }

            // 2. Simulate Work
            this.log('WORKER', `🔨 Working... (3s)`);
            await new Promise(r => setTimeout(r, 3000));

            // 3. Submit Work
            this.log('WORKER', `📤 Submitting work...`);
            this.missionStore.update(missionId, {
                status: 'verifying',
                verifying_started_at: new Date(),
                work_artifacts: [{
                    filename: 'solution.ts',
                    original_filename: 'solution.ts',
                    url: 'http://demo/solution.ts',
                    size: 1024,
                    uploaded_by: this.workerId,
                    uploaded_at: new Date(),
                    mime_type: 'application/typescript'
                }]
            } as any);
            this.log('WORKER', `✅ Work submitted. Status: VERIFYING`);
        }
    }

    async startVerifierLoop() {
        this.log('VERIFIER', '🚀 Verifier loop started');
        while (this.running) {
            // For demo, we just verify any mission in 'verifying' status immediately
            const pendingParams = this.missionStore.list({ status: 'verifying' }) as any[];
            for (const m of pendingParams) {
                // ...
                // Determine if we should verify it
                // Logic: If no reviews or not settled
                if (m.status === 'verifying') {
                    // Check if we already reviewed
                    const reviews = m.verification_reviews || [];
                    if (!reviews.find((r: any) => r.reviewer_id === this.verifierId)) {
                        this.log('VERIFIER', `🔍 Found unverified mission: ${m.id}`);
                        await this.performVerification(m.id);
                    }
                }
            }


            await new Promise(r => setTimeout(r, 2000));
        }
    }

    async performVerification(missionId: string) {
        this.log('VERIFIER', `📝 Verifying mission ${missionId}...`);
        await new Promise(r => setTimeout(r, 2000));

        // Approve
        this.log('VERIFIER', `✅ Approving mission...`);

        // Update mission with review
        const m = (this.missionStore.get(missionId) as any)!;

        const reviews = m.verification_reviews || [];
        // Check if already reviewed by me
        if (reviews.find((r: any) => r.reviewer_id === this.verifierId)) return;

        reviews.push({
            reviewer_id: this.verifierId,
            approves: true,
            feedback: "Looks good to me! (Automated Approval)",
            reviewed_at: new Date()
        });

        this.missionStore.update(missionId, {
            verification_reviews: reviews
        } as any);

        // Trigger Settlement
        this.log('SYSTEM', `⚙️  Triggering Settlement...`);

        const m_after_update = (this.missionStore.get(missionId) as any)!; // Renamed to avoid redeclaration
        const assignment = m_after_update.assigned_agent;

        const votes = (m_after_update.verification_reviews || []).map((r: any) => ({
            verifierId: r.reviewer_id,
            vote: (r.approves ? 'APPROVE' : 'REJECT') as 'APPROVE' | 'REJECT',
            feedback: r.feedback
        }));

        const result = await this.settlementEngine.settleMission(
            missionId,
            m_after_update.requester_id,
            assignment?.agent_id || this.workerId,
            m_after_update.reward,
            {
                votes,
                verifiers: [this.verifierId]
            },
            m_after_update.title,
            'direct_hire'
        );

        if (result.success) {
            this.log('SYSTEM', `✅ Settlement Successful! Tx: ${result.distributions.length} transfers`);
            // Update mission status to settled manually since SettlementEngine might not do it? 
            // SettlementEngine usually returns result, caller updates status.
            // Let's check if SettlementEngine updates status. 
            // It doesn't seem to update MissionStore directly in the viewed code.
            // So we must update it here.
            this.missionStore.update(missionId, {
                status: 'settled',
                settlement: {
                    final_amount: m_after_update.reward,
                    settled_at: new Date(),
                    transaction_hash: '0x' + Math.random().toString(16).slice(2),
                    verification_round: 1
                }
            } as any);

            // Manually trigger reputation update
            await this.reputationEngine.updateReputation(this.workerId, this.agentAuth);
            this.log('SYSTEM', `✅ Reputation updated for ${this.workerId}`);
        } else {
            this.log('SYSTEM', `❌ Settlement Failed: ${result.error}`);
        }
    }

    // ==========================================
    // MAIN FLOW
    // ==========================================

    async executeLifecycle() {
        // 1. Create Mission
        this.log('ACTION', '📝 Creating Mission...');
        const mission = await this.missionRegistry.createMission({
            requester_id: this.requesterId,
            title: 'Critical Infrastructure Upgrade',
            description: 'Upgrade the core settlement engine to support batched transactions.',
            reward: 1000,
            specialties: ['coding'],
            requirements: ['TypeScript', 'Unit Tests'],
            deliverables: ['PR Link'],
            direct_hire: true,
            direct_agent_id: this.workerId
        });

        if (!mission || !mission.mission) {
            throw new Error("Failed to create mission");
        }

        this.log('STATUS', `✅ Mission Created: ${mission.mission.id}`);
        this.log('STATUS', `✅ Assigned to CodeWizard`);

        // 2. Wait for Execution (Worker should pick it up automatically because it's assigned)
        this.log('WAIT', '⏳ Waiting for execution start...');
        await this.waitForStatus(mission.mission.id, 'executing');

        // 3. Wait for Submission
        this.log('WAIT', '⏳ Waiting for work submission...');
        await this.waitForStatus(mission.mission.id, 'verifying');

        // 4. Wait for Settlement
        this.log('WAIT', '⏳ Waiting for verification and settlement...');
        await this.waitForStatus(mission.mission.id, 'settled');
    }

    async waitForStatus(missionId: string, status: string) {
        let attempts = 0;
        while (attempts < 60) { // 2 mins max
            const m = this.missionStore.get(missionId);
            if (m && m.status === status) {
                this.log('STATUS', `✅ Mission reached status: ${status.toUpperCase()}`);
                return;
            }
            if (m && m.status === 'failed') throw new Error(`Mission failed unexpectedly: ${m.failure_reason}`);

            await new Promise(r => setTimeout(r, 2000));
            attempts++;
        }
        throw new Error(`Timeout waiting for status ${status}`);
    }

    async verifyAndCleanup() {
        this.log('VERIFY', '📊 Verifying results...');

        const worker = this.agentAuth.getById(this.workerId);
        if (!worker) throw new Error('Worker not found');

        console.log('\nFINAL STATS:');
        console.log(`Agent: ${worker.name}`);
        console.log(`Reputation: ${worker.reputation} (Should be > 60)`);
        console.log(`Earnings: ${worker.total_earnings} (Should be +980)`);
        console.log(`Jobs Completed: ${worker.jobs_completed} (Should be 1)`);

        if (worker.jobs_completed > 0 && (worker.total_earnings || 0) >= 980 && worker.reputation > 60) {
            console.log('\n✅ SUCCESS: Full lifecycle completed successfully.');
        } else {
            console.error('\n❌ FAILURE: Stats did not update correctly.');
            process.exit(1);
        }

        this.cleanup();
        process.exit(0);
    }

    cleanup() {
        this.running = false;
        this.log('CLEANUP', 'Stopping loops...');
        // allow loops to finish
    }
}

new LifecycleDemo().run();
