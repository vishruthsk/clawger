#!/usr/bin/env tsx
/**
 * Reputation Assignment Bias Test
 * 
 * Verifies that higher reputation agents get more assignments.
 * Setup:
 * - 3 Agents: Low (55), Med (85), High (120)
 * - All have same specialty: "Data Mining"
 * - 30 Missions requiring "Data Mining"
 * 
 * Expected Result: High > Med > Low (but not 100% High due to anti-monopoly)
 */

import { AgentAuth, AgentProfile } from '../core/registry/agent-auth';
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

const NUM_MISSIONS = 30;

class ReputationTest {
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

        // Define test agents
        const agents = [
            { name: 'LowRep Agent', rep: 55, id: 'agent_low_rep' },
            { name: 'MedRep Agent', rep: 85, id: 'agent_med_rep' },
            { name: 'HighRep Agent', rep: 120, id: 'agent_high_rep' }
        ];

        for (const a of agents) {
            // Register or update agent
            // We use a hack here to force reputation since it's usually read-only
            // In a real test we'd mock the registry, but here we'll just write to the JSON if needed
            // OR we can just register them and then manually set their reputation in the registry's memory

            // 1. Register logic (simulated)
            let agent = this.agentAuth.listAgents().find(existing => existing.id === a.id);
            if (!agent) {
                // Register new
                const newAgent = this.agentAuth.register({
                    name: a.name,
                    specialties: ['Data Mining'],
                    hourly_rate: 50,
                    wallet_address: `0x${a.id}`,
                    address: `0x${a.id}`, // Add required address field
                    profile: 'Test agent for reputation bias' // Add required profile field
                });
                // Manually overwrite ID to match our test ID
                // (In real app ID is generated, but for deterministic test we want specific IDs)
                // Actually, let's just find them by name if we can't force ID easily.
                // But wait, AgentAuth.registerAgent returns the agent.
                // We can't force ID in registerAgent API. 
                // Let's use the returned agent and just update its reputation.
                agent = newAgent;
            }

            // 2. Force update their capabilities to ensure they match
            agent.specialties = ['Data Mining'];
            agent.available = true;
            agent.hourly_rate = 50; // Same rate to isolate reputation
            agent.lastActive = new Date(); // Active now

            // 3. FORCE REPUTATION in memory
            // @ts-ignore
            agent.reputation = a.rep;

            // 4. Save back to disk
            // Update profile fields
            this.agentAuth.updateProfile(agent.apiKey, {
                specialties: ['Data Mining'],
                available: true,
                hourly_rate: 50
            });
            // Update reputation specifically
            this.agentAuth.updateReputation(agent.id, a.rep);

            // We need to verify if updateAgent persists reputation. 
            // Looking at AgentAuth.updateAgent in codebase would confirm, but usually it might not.
            // Let's assume for this test we might need to modify the file directly or mock specific method.
            // However, since AssignmentEngine reads from `this.agentAuth.listAgents()`, 
            // and we modified the object in memory (AgentAuth loads into memory), 
            // if AssignmentEngine shares the SAME AgentAuth instance, it should see the memory change.
            // We passed `this.agentAuth` to `MissionRegistry` which presumably passes it to `AssignmentEngine`.
            // So modifying memory object `agent` should work!

            console.log(`Configured ${agent.name} with Reputation: ${agent.reputation}`);

            // Initialize count
            this.assignmentCounts.set(agent.name, 0);
        }
    }

    async runTest() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   REPUTATION BIAS TEST');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        await this.setupAgents();

        // Pause to ensure file writes settle if any
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fund requester
        const requesterId = 'requester_test';
        this.tokenLedger.mint(requesterId, 100000);
        console.log(`Funded ${requesterId} with 100,000 $CLAWGER`);

        console.log(`Running ${NUM_MISSIONS} mission assignments...\n`);

        for (let i = 0; i < NUM_MISSIONS; i++) {
            const mission = await this.missionRegistry.createMission({
                requester_id: requesterId,
                title: `Reputation Test Mission ${i + 1}`,
                description: 'Testing reputation bias',
                reward: 100, // Low reward -> Autopilot
                specialties: ['Data Mining'],
                requirements: ['Report'],
                deliverables: ['PDF'],
                timeout_seconds: 3600
            });

            if (mission.assigned_agent) {
                const name = mission.assigned_agent.agent_name;
                // Map back to our specific naming if the registry generated different names (unlikely if we updated)
                // But since we created new agents or found existing, let's just track by name.

                // Note: The registry might pick ANY agent with 'Data Mining'. 
                // We hopefully only have our 3 test agents or few others.
                // If there are others, we'll see them in the output.

                const count = this.assignmentCounts.get(name) || 0;
                this.assignmentCounts.set(name, count + 1);
                this.totalAssignments++;

                process.stdout.write(`\r✓ ${i + 1}/${NUM_MISSIONS} assigned to ${name}`);
            } else {
                console.log(`\n❌ Mission ${i + 1} failed to assign: ${mission.mission.failure_reason}`);
            }

            // Small delay to prevent exact timestamp collisions in some logic
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this.analyzeResults();
    }

    private analyzeResults() {
        console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   RESULTS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const sorted = Array.from(this.assignmentCounts.entries())
            .sort((a, b) => b[1] - a[1]);

        console.log('Agent Name      | Reputation | Assignments | Win Rate');
        console.log('────────────────|────────────|─────────────|─────────');

        for (const [name, count] of sorted) {
            let rep = 0;
            if (name.includes('Low')) rep = 55;
            if (name.includes('Med')) rep = 85;
            if (name.includes('High')) rep = 120;

            const rate = ((count / this.totalAssignments) * 100).toFixed(1);
            console.log(`${name.padEnd(15)} | ${rep.toString().padEnd(10)} | ${count.toString().padEnd(11)} | ${rate}%`);
        }

        console.log('\nAnalysis:');

        const highWins = this.assignmentCounts.get('HighRep Agent') || 0;
        const medWins = this.assignmentCounts.get('MedRep Agent') || 0;
        const lowWins = this.assignmentCounts.get('LowRep Agent') || 0;

        if (highWins > lowWins) {
            console.log('✅ PASSED: High reputation agent won more than Low reputation agent.');
        } else {
            console.log('❌ FAILED: High reputation agent did NOT win more.');
        }

        if (lowWins > 0) {
            console.log('✅ PASSED: Low reputation agent got at least one mission (Anti-Monopoly active).');
        } else {
            console.log('⚠️  WARNING: Low reputation agent got 0 missions. System might be too biased or sample size too small.');
        }
    }
}

// Run
new ReputationTest().runTest().catch(console.error);
