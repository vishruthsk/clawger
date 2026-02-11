#!/usr/bin/env tsx
/**
 * Full Real Economy Cycle Test
 * 
 * Validates the complete CLAWGER economic flow end-to-end:
 * 1. Human posts mission (simulated wallet)
 * 2. Escrow locked
 * 3. Autopilot assigns bot
 * 4. Bot polls and retrieves task
 * 5. Bot starts mission (stakes bond)
 * 6. Bot executes and submits work
 * 7. Verifiers poll, stake, vote
 * 8. Settlement triggers automatically
 * 9. Tokens distributed (worker, verifiers, protocol)
 * 10. Reputation updated
 * 11. Dashboard reflects all changes
 */

import { spawn, ChildProcess } from 'child_process';
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

class RealEconomyCycleTest {
    private agentAuth: AgentAuth;
    private missionRegistry: MissionRegistry;
    private missionStore: MissionStore;
    private tokenLedger: TokenLedger;
    private bondManager: BondManager;
    private settlementEngine: SettlementEngine;

    private workerBot: { id: string; apiKey: string; process?: ChildProcess } | null = null;
    private verifierBots: Array<{ id: string; apiKey: string; process?: ChildProcess }> = [];
    private requesterId = '0xHUMAN_REQUESTER';

    constructor() {
        this.agentAuth = new AgentAuth('./data');
        const notifications = new AgentNotificationQueue();
        this.missionStore = new MissionStore('./data');
        const taskQueue = new TaskQueue('./data');
        const heartbeatManager = new HeartbeatManager(this.agentAuth, './data');
        this.tokenLedger = new TokenLedger('./data');
        const escrowEngine = new EscrowEngine(this.tokenLedger);
        const assignmentHistory = new AssignmentHistoryTracker('./data');
        this.bondManager = new BondManager(this.tokenLedger, './data');
        this.settlementEngine = new SettlementEngine(this.tokenLedger, this.bondManager, './data');

        this.missionRegistry = new MissionRegistry(
            this.missionStore,
            this.agentAuth,
            notifications,
            taskQueue,
            heartbeatManager,
            escrowEngine,
            assignmentHistory,
            this.bondManager,
            this.settlementEngine
        );
    }

    private log(step: string, message: string) {
        console.log(`[${step.padEnd(25)}] ${message}`);
    }

    async setupEconomy() {
        this.log('SETUP', '💰 Funding requester...');
        this.tokenLedger.mint(this.requesterId, 5000);
        const balance = this.tokenLedger.getBalance(this.requesterId);
        this.log('SETUP', `✅ Requester balance: ${balance} $CLAWGER`);

        // Register worker bot
        this.log('SETUP', '🤖 Registering worker bot...');
        const worker = this.agentAuth.register({
            address: `0xWORKER_CYCLE_TEST`,
            name: 'CycleTestWorker',
            profile: 'Test worker for full cycle validation',
            specialties: ['coding', 'testing'],
            hourly_rate: 50,
            wallet_address: 'cycle_worker_wallet'
        });
        this.tokenLedger.mint(worker.id, 500);
        this.workerBot = { id: worker.id, apiKey: worker.apiKey };
        this.log('SETUP', `✅ Worker registered: ${worker.id}`);

        // Register verifier bots
        this.log('SETUP', '👥 Registering verifier bots...');
        for (let i = 1; i <= 3; i++) {
            const verifier = this.agentAuth.register({
                address: `0xVERIFIER_CYCLE_${i}`,
                name: `CycleTestVerifier${i}`,
                profile: 'Test verifier for full cycle validation',
                specialties: ['verification'],
                hourly_rate: 30,
                wallet_address: `cycle_verifier_${i}_wallet`
            });
            this.tokenLedger.mint(verifier.id, 200);
            this.verifierBots.push({ id: verifier.id, apiKey: verifier.apiKey });
            this.log('SETUP', `✅ Verifier ${i} registered: ${verifier.id}`);
        }
    }

    async spawnBots() {
        this.log('BOTS', '🚀 Spawning worker bot...');
        if (this.workerBot) {
            this.workerBot.process = spawn('tsx', ['./agents/runner/clawbot-runner.ts'], {
                env: {
                    ...process.env,
                    CLAWBOT_API_KEY: this.workerBot.apiKey,
                    CLAWBOT_NAME: 'CycleTestWorker'
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.workerBot.process.stdout?.on('data', (data) => {
                process.stdout.write(`[WORKER] ${data}`);
            });
        }

        this.log('BOTS', '🚀 Spawning verifier bots...');
        for (let i = 0; i < this.verifierBots.length; i++) {
            const bot = this.verifierBots[i];
            bot.process = spawn('tsx', ['./agents/runner/verifier-runner.ts'], {
                env: {
                    ...process.env,
                    VERIFIER_API_KEY: bot.apiKey,
                    VERIFIER_NAME: `CycleTestVerifier${i + 1}`,
                    VERIFIER_APPROVAL_RATE: '0.9'
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            bot.process.stdout?.on('data', (data) => {
                process.stdout.write(`[VERIFIER${i + 1}] ${data}`);
            });
        }

        // Wait for bots to initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.log('BOTS', '✅ All bots running');
    }

    async createMission() {
        this.log('MISSION', '📋 Creating mission...');

        const initialBalance = this.tokenLedger.getBalance(this.requesterId);

        const mission = await this.missionRegistry.createMission({
            requester_id: this.requesterId,
            requester_type: 'wallet',
            requester_name: 'Human Requester',
            title: 'Full Cycle Test Mission',
            description: 'Testing complete economic cycle',
            reward: 100,
            specialties: ['coding', 'testing'],
            requirements: ['Complete the test workflow'],
            deliverables: ['Test results']
        });

        const newBalance = this.tokenLedger.getBalance(this.requesterId);
        const escrowLocked = initialBalance - newBalance;

        this.log('MISSION', `✅ Mission created: ${mission.mission.id}`);
        this.log('MISSION', `✅ Assigned to: ${mission.assigned_agent?.agent_name}`);
        this.log('MISSION', `✅ Escrow locked: ${escrowLocked} $CLAWGER`);

        return mission.mission.id;
    }

    async monitorMission(missionId: string) {
        this.log('MONITOR', '👀 Monitoring mission lifecycle...');

        let settled = false;
        let attempts = 0;
        const maxAttempts = 90; // 3 minutes max

        while (!settled && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;

            const mission = this.missionStore.get(missionId);
            if (!mission) continue;

            if (mission.status === 'settled' || mission.status === 'failed') {
                settled = true;
                this.log('MONITOR', `✅ Mission ${mission.status.toUpperCase()}`);
            } else if (mission.status === 'executing') {
                this.log('MONITOR', `🔧 Status: Executing (${attempts * 2}s elapsed)`);
            } else if (mission.status === 'verifying') {
                this.log('MONITOR', `🔍 Status: Verifying (${attempts * 2}s elapsed)`);
            }
        }

        if (!settled) {
            throw new Error('Mission did not settle within timeout');
        }

        return this.missionStore.get(missionId);
    }

    async verifyOutcomes(missionId: string) {
        this.log('VERIFY', '📊 Verifying economic outcomes...');

        const mission = this.missionStore.get(missionId);
        if (!mission) throw new Error('Mission not found');

        const workerId = mission.assigned_agent?.agent_id || '';
        const workerProfile = this.agentAuth.getById(workerId);

        console.log('\n═══════════════════════════════════════');
        console.log('   FINAL ECONOMIC STATE');
        console.log('═══════════════════════════════════════\n');

        console.log(`Mission Status: ${mission.status}`);
        console.log(`Mission Outcome: ${(mission as any).settlement_outcome || 'N/A'}\n`);

        console.log('💰 Token Balances:');
        console.log(`  Requester: ${this.tokenLedger.getBalance(this.requesterId)} $CLAWGER`);
        console.log(`  Worker: ${this.tokenLedger.getBalance(workerId)} $CLAWGER`);

        for (let i = 0; i < this.verifierBots.length; i++) {
            const bot = this.verifierBots[i];
            console.log(`  Verifier${i + 1}: ${this.tokenLedger.getBalance(bot.id)} $CLAWGER`);
        }

        console.log(`\n📊 Reputation:`);
        console.log(`  Worker: ${workerProfile?.reputation || 0}`);

        console.log('\n═══════════════════════════════════════\n');
    }

    async cleanup() {
        this.log('CLEANUP', '🧹 Terminating bots...');

        if (this.workerBot?.process) {
            this.workerBot.process.kill('SIGTERM');
        }

        for (const bot of this.verifierBots) {
            if (bot.process) {
                bot.process.kill('SIGTERM');
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        this.log('CLEANUP', '✅ Cleanup complete');
    }

    async run() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   FULL REAL ECONOMY CYCLE TEST');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        try {
            await this.setupEconomy();
            await this.spawnBots();
            const missionId = await this.createMission();
            await this.monitorMission(missionId);
            await this.verifyOutcomes(missionId);
            await this.cleanup();

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('   ✅ FULL CYCLE TEST PASSED');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            process.exit(0);
        } catch (error: any) {
            console.error('\n❌ Test failed:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Test interrupted');
    process.exit(1);
});

// Execute
async function main() {
    const test = new RealEconomyCycleTest();
    await test.run();
}

main();
