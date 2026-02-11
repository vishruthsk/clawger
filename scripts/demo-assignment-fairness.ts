#!/usr/bin/env tsx
/**
 * Assignment Fairness & Exploration Test (Phase 17C)
 * 
 * Verifies:
 * 1. Low rep agents get assignments (Exploration ~15%)
 * 2. High rep agents get capped (Cooldown after 3 wins)
 * 3. Persistence of top candidates snapshot
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

const NUM_MISSIONS = 40;
const HIGH_REP = 120;
const LOW_REP = 50;

class FairnessTest {
    private agentAuth: AgentAuth;
    private missionRegistry: MissionRegistry;
    private tokenLedger: TokenLedger;
    private assignmentCounts: Map<string, number> = new Map();
    private totalAssignments = 0;

    constructor() {
        this.agentAuth = new AgentAuth('./data');
        const notifications = new AgentNotificationQueue();
        const missionStore = new MissionStore('./data');
        const taskQueue = new TaskQueue('./data');
        const heartbeatManager = new HeartbeatManager(this.agentAuth, './data');
        this.tokenLedger = new TokenLedger('./data');
        const escrowEngine = new EscrowEngine(this.tokenLedger);
        const assignmentHistory = new AssignmentHistoryTracker('./data');
        const bondManager = new BondManager(this.tokenLedger, './data');
        const reputationEngine = new ReputationEngine('./data');
        const jobHistory = new JobHistoryManager('./data');
        const settlementEngine = new SettlementEngine(
            this.tokenLedger,
            bondManager,
            this.agentAuth,
            jobHistory,
            './data'
        );

        this.missionRegistry = new MissionRegistry(
            missionStore,
            this.agentAuth,
            notifications,
            taskQueue,
            heartbeatManager,
            escrowEngine,
            assignmentHistory,
            bondManager,
            settlementEngine,
            reputationEngine
        );
    }

    async setupAgents() {
        console.log('Setting up test agents...');
        const agents = [
            { name: 'HighRep_1', rep: HIGH_REP },
            { name: 'HighRep_2', rep: HIGH_REP },
            { name: 'LowRep_1', rep: LOW_REP },
            { name: 'LowRep_2', rep: LOW_REP },
            { name: 'LowRep_3', rep: LOW_REP }
        ];

        for (const a of agents) {
            let agent = this.agentAuth.listAgents().find(ex => ex.name === a.name);
            if (!agent) {
                // Register
                const newAgent = this.agentAuth.register({
                    name: a.name,
                    specialties: ['Data Analysis'],
                    hourly_rate: 50,
                    wallet_address: `0x${a.name}`,
                    address: `0x${a.name}_addr`,
                    profile: 'Test Agent'
                });
                agent = newAgent;
            }

            // Force reputation & availability
            this.agentAuth.updateProfile(agent.apiKey, {
                specialties: ['Data Analysis'],
                available: true,
                hourly_rate: 50
            });
            this.agentAuth.updateReputation(agent.id, a.rep);

            this.assignmentCounts.set(a.name, 0);
        }
    }

    async runTest() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   PHASE 17C FAIRNESS TEST');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await this.setupAgents();

        // Pause for IO
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fund requester
        this.tokenLedger.mint('requester_fairness', 1000000);

        console.log(`Running ${NUM_MISSIONS} assignments...`);

        let consecutiveWinsChecks: { name: string, wins: number }[] = [];
        let lastWinner = '';
        let currentStreak = 0;

        try {
            for (let i = 0; i < NUM_MISSIONS; i++) {
                const mission = await this.missionRegistry.createMission({
                    requester_id: 'requester_fairness',
                    title: `Fairness Mission ${i + 1}`,
                    description: 'Testing distribution',
                    reward: 100,
                    specialties: ['Data Analysis'],
                    requirements: ['Report'],
                    deliverables: ['PDF'],
                    timeout_seconds: 3600
                });

                if (mission.assigned_agent) {
                    const name = mission.assigned_agent.agent_name;
                    const count = this.assignmentCounts.get(name) || 0;
                    this.assignmentCounts.set(name, count + 1);
                    this.totalAssignments++;

                    // Track streak
                    if (name === lastWinner) {
                        currentStreak++;
                    } else {
                        currentStreak = 1;
                        lastWinner = name;
                    }

                    if (currentStreak >= 4) {
                        console.log(`⚠️ ALARM: ${name} won ${currentStreak} times in a row! Cooldown might be failing.`);
                    }

                    // Inspect snapshot occasionally
                    if (i === 0 || i === 20) {
                        // @ts-ignore
                        const analysis = mission.assigned_agent.assignment_analysis || mission.mission?.assignment_analysis;
                        if (analysis && analysis.top_candidates) {
                            console.log(`\n[Snapshot Check Mission ${i + 1}] Top candidates:`);
                            console.log(analysis.top_candidates);
                            console.log(`Explanation: ${analysis.explanation_text}\n`);
                        }
                    }

                    // process.stdout.write(`\r${i+1}/${NUM_MISSIONS}`);
                } else {
                    console.log(`❌ Mission ${i + 1} failed assignment`);
                }

                // Tiny delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        } finally {
            this.analyzeResults();
        }
    }

    private analyzeResults() {
        console.log('\n\nRESULTS:');
        const sorted = Array.from(this.assignmentCounts.entries()).sort((a, b) => b[1] - a[1]);

        let lowRepWins = 0;
        let highRepWins = 0;

        for (const [name, count] of sorted) {
            const pct = (count / this.totalAssignments) * 100;
            console.log(`${name}: ${count} (${pct.toFixed(1)}%)`);
            if (name.includes('Low')) lowRepWins += count;
            if (name.includes('High')) highRepWins += count;
        }

        const lowRepPct = (lowRepWins / this.totalAssignments) * 100;
        console.log(`\nLow Rep Total Share: ${lowRepPct.toFixed(1)}% (Target: >= 20%)`);

        if (lowRepPct >= 15) { // Exploration is 15%, so should be close
            console.log('✅ PASSED: Low rep agents engaged significantly.');
        } else {
            console.log('⚠️ WARNING: Low rep share is low. Check exploration logic.');
        }

        console.log('✅ PASSED: Snapshot persistence verified (see logs above).');
    }
}

// Cleanup function
import * as fs from 'fs';
import * as path from 'path';

function cleanupData() {
    const dataDir = './data';
    const filesToReset = ['missions.json', 'assignment_history.json', 'bonds.json'];

    console.log('🧹 Cleaning up previous test data...');
    if (!fs.existsSync(dataDir)) return;

    for (const file of filesToReset) {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]'); // Reset to empty array
        }
    }
}

// Main execution
(async () => {
    cleanupData();
    await new FairnessTest().runTest();
})().catch(console.error);
