/**
 * Demo: Real ClawBot Agents
 * 
 * Multi-agent orchestration that spawns real bot processes:
 * - 2 worker bots
 * - 3 verifier bots
 * - 1 requester creating missions
 * 
 * Validates the complete CLAWGER protocol end-to-end with autonomous agents.
 */

import { spawn, ChildProcess } from 'child_process';
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

interface BotProcess {
    name: string;
    process: ChildProcess;
    apiKey: string;
    agentId: string;
}

class RealAgentOrchestrator {
    private agentAuth: AgentAuth;
    private missionRegistry: MissionRegistry;
    private tokenLedger: TokenLedger;
    private missionStore: MissionStore;
    private bondManager: BondManager;
    private settlementEngine: SettlementEngine;

    private workerBots: BotProcess[] = [];
    private verifierBots: BotProcess[] = [];
    private requesterId: string = '0xREQUESTER_REAL';

    constructor() {
        // Initialize all components
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

    private log(message: string) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [ORCHESTRATOR] ${message}`);
    }

    private async seedEconomy() {
        this.log('💰 Seeding economy...');

        // Fund requester
        this.tokenLedger.mint(this.requesterId, 10000);
        this.log(`✅ Funded requester: 10,000 $CLAWGER`);
    }

    private async registerAgents() {
        this.log('📝 Registering agents...');

        // Register 2 worker bots
        for (let i = 1; i <= 2; i++) {
            const agent = this.agentAuth.register({
                address: `0xWORKER_${i}`,
                name: `WorkerBot-${i}`,
                profile: 'Autonomous worker bot',
                specialties: ['automation', 'testing'],
                hourly_rate: 40,
                wallet_address: `worker_${i}_wallet`
            });

            // Fund worker
            this.tokenLedger.mint(agent.id, 500);

            // Set available
            this.agentAuth.updateProfile(agent.apiKey, { available: true });

            this.workerBots.push({
                name: `WorkerBot-${i}`,
                process: null as any, // Will be set when spawned
                apiKey: agent.apiKey,
                agentId: agent.id
            });

            this.log(`✅ Registered ${agent.name} (${agent.id}): 500 $CLAWGER`);
        }

        // Register 3 verifier bots
        for (let i = 1; i <= 3; i++) {
            const agent = this.agentAuth.register({
                address: `0xVERIFIER_${i}`,
                name: `VerifierBot-${i}`,
                profile: 'Autonomous verifier bot',
                specialties: ['verification', 'quality-assurance'],
                hourly_rate: 30,
                wallet_address: `verifier_${i}_wallet`
            });

            // Fund verifier
            this.tokenLedger.mint(agent.id, 200);

            // Set available
            this.agentAuth.updateProfile(agent.apiKey, { available: true });

            // Vary approval rates for diversity
            const approvalRate = i === 1 ? 0.9 : i === 2 ? 0.8 : 0.85;

            this.verifierBots.push({
                name: `VerifierBot-${i}`,
                process: null as any,
                apiKey: agent.apiKey,
                agentId: agent.id
            });

            this.log(`✅ Registered ${agent.name} (${agent.id}): 200 $CLAWGER | Approval: ${(approvalRate * 100).toFixed(0)}%`);
        }
    }

    private spawnBot(scriptPath: string, apiKey: string, botName: string, extraEnv: Record<string, string> = {}): ChildProcess {
        const env = {
            ...process.env,
            ...extraEnv
        };

        const botProcess = spawn('tsx', [scriptPath], {
            env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Pipe output with prefix
        botProcess.stdout?.on('data', (data) => {
            process.stdout.write(data);
        });

        botProcess.stderr?.on('data', (data) => {
            process.stderr.write(data);
        });

        botProcess.on('exit', (code) => {
            this.log(`${botName} exited with code ${code}`);
        });

        return botProcess;
    }

    private async spawnBots() {
        this.log('🤖 Spawning bot processes...');

        // Spawn worker bots
        for (const bot of this.workerBots) {
            bot.process = this.spawnBot(
                './agents/runner/clawbot-runner.ts',
                bot.apiKey,
                bot.name,
                {
                    CLAWBOT_API_KEY: bot.apiKey,
                    CLAWBOT_NAME: bot.name
                }
            );
            this.log(`✅ Spawned ${bot.name}`);
        }

        // Spawn verifier bots
        for (let i = 0; i < this.verifierBots.length; i++) {
            const bot = this.verifierBots[i];
            const approvalRate = i === 0 ? '0.9' : i === 1 ? '0.8' : '0.85';

            bot.process = this.spawnBot(
                './agents/runner/verifier-runner.ts',
                bot.apiKey,
                bot.name,
                {
                    VERIFIER_API_KEY: bot.apiKey,
                    VERIFIER_NAME: bot.name,
                    VERIFIER_APPROVAL_RATE: approvalRate
                }
            );
            this.log(`✅ Spawned ${bot.name}`);
        }

        // Give bots time to start polling
        this.log('⏳ Waiting for bots to initialize...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    private async createMission() {
        this.log('📋 Creating mission...');

        const mission = await this.missionRegistry.createMission({
            requester_id: this.requesterId,
            title: 'Real Agent Test Mission',
            description: 'Testing CLAWGER with real autonomous agents',
            reward: 50,
            specialties: ['automation', 'testing'],
            requirements: ['Execute test workflow'],
            deliverables: ['Test results and logs']
        });

        if (!mission.assigned_agent) {
            throw new Error('Mission creation failed: No agent assigned');
        }

        this.log(`✅ Mission created: ${mission.mission.id}`);
        this.log(`✅ Assigned to: ${mission.assigned_agent.agent_name} (${mission.assigned_agent.agent_id})`);
        this.log(`✅ Escrow locked: ${mission.mission.reward} $CLAWGER`);

        return mission.mission.id;
    }

    private async monitorMission(missionId: string) {
        this.log('👀 Monitoring mission progress...');

        let settled = false;
        let attempts = 0;
        const maxAttempts = 60; // 60 * 2s = 2 minutes max

        while (!settled && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;

            const mission = this.missionStore.get(missionId);
            if (!mission) continue;

            if (mission.status === 'settled' || mission.status === 'failed') {
                settled = true;
                this.log(`✅ Mission ${mission.status.toUpperCase()}`);
            } else if (mission.status === 'executing') {
                this.log(`🔧 Mission executing...`);
            } else if (mission.status === 'verifying') {
                this.log(`🔍 Mission verifying...`);
            }
        }

        if (!settled) {
            throw new Error('Mission did not settle within timeout');
        }

        return this.missionStore.get(missionId);
    }

    private async verifyOutcomes(missionId: string) {
        this.log('✅ Verifying outcomes...');

        const mission = this.missionStore.get(missionId);
        if (!mission) {
            throw new Error('Mission not found');
        }

        const workerId = mission.assigned_agent?.agent_id || '';

        console.log('\n═══ FINAL RESULTS ═══\n');
        console.log(`Mission Status: ${mission.status}`);
        console.log(`\n💰 Token Balances:`);
        console.log(`  Requester: ${this.tokenLedger.getBalance(this.requesterId)} $CLAWGER`);
        console.log(`  Worker (${workerId}): ${this.tokenLedger.getBalance(workerId)} $CLAWGER`);

        for (const bot of this.verifierBots) {
            console.log(`  ${bot.name}: ${this.tokenLedger.getBalance(bot.agentId)} $CLAWGER`);
        }

        console.log(`\n📊 Reputation:`);
        const workerProfile = this.agentAuth.getById(workerId);
        console.log(`  Worker: ${workerProfile?.reputation || 0}`);

        console.log('\n✅ Verification Complete!\n');
    }

    private async cleanup() {
        this.log('🧹 Cleaning up bot processes...');

        const allBots = [...this.workerBots, ...this.verifierBots];

        for (const bot of allBots) {
            if (bot.process && !bot.process.killed) {
                bot.process.kill('SIGTERM');
                this.log(`✅ Terminated ${bot.name}`);
            }
        }

        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    public async run() {
        try {
            console.log('\n══════════════════════════════════════════════════════');
            console.log('         REAL CLAWBOT AGENT TESTING HARNESS');
            console.log('══════════════════════════════════════════════════════\n');

            // Setup
            await this.seedEconomy();
            await this.registerAgents();
            await this.spawnBots();

            // Execute
            const missionId = await this.createMission();
            const finalMission = await this.monitorMission(missionId);

            // Verify
            await this.verifyOutcomes(missionId);

            // Cleanup
            await this.cleanup();

            console.log('══════════════════════════════════════════════════════');
            console.log('           REAL AGENT DEMO COMPLETE ✅');
            console.log('══════════════════════════════════════════════════════\n');

            process.exit(0);

        } catch (error: any) {
            console.error('\n❌ Demo failed:', error.message);
            await this.cleanup();
            process.exit(1);
        }
    }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
    const orchestrator = new RealAgentOrchestrator();

    // Graceful shutdown on Ctrl+C
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Received SIGINT. Shutting down...');
        await orchestrator['cleanup']();
        process.exit(0);
    });

    await orchestrator.run();
}

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
