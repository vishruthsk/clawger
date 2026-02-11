
import { AgentAuth, AgentProfile } from '../core/registry/agent-auth';
import { MissionStore } from '../core/missions/mission-store';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { ReputationEngine } from '../core/agents/reputation-engine';
import { AssignmentEngine } from '../core/missions/assignment-engine';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import * as fs from 'fs';
import * as path from 'path';

// Helper to clear test data
const TEST_DIR = './data-test-reputation';
if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEST_DIR);

async function runDemo() {
    console.log("=== Reputation Assignment Verification ===");

    // 1. Setup Dependencies
    const agentAuth = new AgentAuth();
    const missionStore = new MissionStore();
    const historyTracker = new AssignmentHistoryTracker();

    // Use test directory for reputation and history
    const reputationEngine = new ReputationEngine(TEST_DIR);
    const jobHistoryWriter = new JobHistoryManager(TEST_DIR);

    // Inject dependencies
    const assignmentEngine = new AssignmentEngine(
        agentAuth,
        historyTracker,
        missionStore,
        reputationEngine,
        {
            weights: {
                reputation: 0.5,
                bond: 0.2,
                rate: 0.1,
                latency: 0.2
            }
        }
    );

    // 2. Setup Agents with different reputations
    // We need to manually inject reputation into AgentProfile since AgentAuth usually reads it? 
    // Or we rely on AssignmentEngine reading it from AgentProfile.
    // In our implementation, AssignmentEngine reads agent.reputation.
    // So we just mock the profiles in AgentAuth.

    console.log("\n--- Setting up Agents ---");
    const agents = [
        { id: 'agent-high-rep', name: 'HighRep Agent', specialty: 'coding', hourly_rate: 100, reputation: 90 }, // Multiplier: 0.8 + 90/200 = 1.25
        { id: 'agent-mid-rep', name: 'MidRep Agent', specialty: 'coding', hourly_rate: 100, reputation: 50 },  // Multiplier: 0.8 + 50/200 = 1.05
        { id: 'agent-low-rep', name: 'LowRep Agent', specialty: 'coding', hourly_rate: 100, reputation: 10 },  // Multiplier: 0.8 + 10/200 = 0.85
        { id: 'agent-sus-rep', name: 'Sus Agent', specialty: 'coding', hourly_rate: 100, reputation: 0 }       // Multiplier: 0.8 + 0/200 = 0.80
    ];

    for (const a of agents) {
        const profile: AgentProfile = {
            id: a.id,
            name: a.name,
            specialties: [a.specialty],
            hourly_rate: a.hourly_rate,
            reputation: a.reputation,
            status: 'active', // 'active' is likely the correct string enum
            available: true,
            capabilities: [a.specialty],
            lastActive: new Date()
        };
        // @ts-ignore - Accessing private map
        agentAuth['creds'].set(`mock-key-${a.id}`, profile);
        console.log(`Registered ${a.name} with Rep: ${a.reputation}`);
    }

    // 3. Create a Mission
    console.log("\n--- Scenario 1: Basic Assignment (High Rep Advantage) ---");
    const mission = missionStore.create({
        requester_id: 'user1',
        title: 'Important Coding Task',
        description: 'Do complex stuff',
        reward: 100,
        specialties: ['coding'],
        requirements: [],
        deliverables: [],
        assignment_mode: 'autopilot',
        tags: [],
        escrow: { locked: false, amount: 0 }
    });

    const result = await assignmentEngine.assignAgent(mission);

    if (result.success && result.scores) {
        console.log("Assignment Successful!");
        console.log(`Winner: ${result.assigned_agent?.agent_name}`);

        console.log("\nScores:");
        result.scores.forEach(s => {
            console.log(`${s.agent_name.padEnd(15)} | Base: ${s.base_score.toFixed(3)} | RepMult: ${s.reputation_multiplier?.toFixed(2)} | Final: ${s.final_score.toFixed(3)}`);
        });

        // Verify Multipliers
        const highRepScore = result.scores.find(s => s.agent_id === 'agent-high-rep');
        if (highRepScore && Math.abs((highRepScore.reputation_multiplier || 0) - 1.25) < 0.01) {
            console.log("✅ High Rep Multiplier Correct (1.25)");
        } else {
            console.error(`❌ High Rep Multiplier Incorrect: ${highRepScore?.reputation_multiplier}`);
        }
    } else {
        console.error("Assignment Failed:", result.reason);
    }

    // 4. Test Anti-Farming (Repeat Assignments)
    console.log("\n--- Scenario 2: Anti-Farming (Repeat Assignments) ---");
    // Force HighRep to win multiple times
    historyTracker.recordAssignment('agent-high-rep', 'mission-1');
    historyTracker.recordAssignment('agent-high-rep', 'mission-2');
    historyTracker.recordAssignment('agent-high-rep', 'mission-3');

    console.log("Recorded 3 wins for HighRep Agent.");

    const mission2 = missionStore.create({
        requester_id: 'user1',
        title: 'Another Task',
        description: '...',
        reward: 100,
        specialties: ['coding'],
        requirements: [],
        deliverables: [],
        assignment_mode: 'autopilot',
        tags: [],
        escrow: { locked: false, amount: 0 }
    });

    const result2 = await assignmentEngine.assignAgent(mission2);

    if (result2.success && result2.scores) {
        console.log(`Winner: ${result2.assigned_agent?.agent_name}`);
        result2.scores.forEach(s => {
            console.log(`${s.agent_name.padEnd(15)} | Base: ${s.base_score.toFixed(3)} | AntiMonopoly: ${s.anti_monopoly_multiplier.toFixed(2)} | Final: ${s.final_score.toFixed(3)}`);
        });

        const highRepScore = result2.scores.find(s => s.agent_id === 'agent-high-rep');

        if (highRepScore && highRepScore.anti_monopoly_multiplier < 0.8) {
            console.log(`✅ Anti-Monopoly Multiplier Correct (${highRepScore.anti_monopoly_multiplier.toFixed(3)} < 0.8)`);
        } else {
            console.error("❌ Anti-Monopoly Logic Failed (Multiplier too high)");
        }
    }

    // 5. Test Reputation Logic directly (Low Value vs High Value)
    console.log("\n--- Scenario 3: Farming Penalty Detection ---");
    const testAgent = 'agent-growth-test';

    // Write 1 low value job
    jobHistoryWriter.recordJobOutcome(testAgent, {
        mission_id: 'm-low',
        mission_title: 'Low Value',
        reward: 15,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'PASS',
        requester_id: 'req1'
    });

    const lowValueRep = reputationEngine.calculateReputation(testAgent);
    console.log(`Reputation after 1 low value job (15 CLAWGER): ${lowValueRep}`);
    // Base 50 + (5 * 0.2) = 51

    // Clear and write 1 high value job
    const jobHistoryWriter2 = new JobHistoryManager(TEST_DIR);
    // Actually we need to delete the entry or use a different agent
    const testAgentHigh = 'agent-growth-test-high';
    jobHistoryWriter.recordJobOutcome(testAgentHigh, {
        mission_id: 'm-high',
        mission_title: 'High Value',
        reward: 100,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'PASS',
        requester_id: 'req1'
    });

    const highValueRep = reputationEngine.calculateReputation(testAgentHigh);
    console.log(`Reputation after 1 high value job (100 CLAWGER): ${highValueRep}`);
    // Base 50 + 5 = 55

    if (Math.abs(lowValueRep - 51) < 0.1 && Math.abs(highValueRep - 55) < 0.1) {
        console.log("✅ Low Value Penalty Verified (51 vs 55)");
    } else {
        console.error(`❌ Low Value Penalty Check Failed. Low: ${lowValueRep}, High: ${highValueRep}`);
    }

    // Cleanup
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

runDemo().catch(console.error);
