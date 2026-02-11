#!/usr/bin/env tsx

/**
 * DEMO: Full Crew Economy Execution Loop
 * 
 * Proves end-to-end crew mission lifecycle:
 * 1. Create crew mission
 * 2. Bots claim subtasks
 * 3. Bots execute work
 * 4. Bots submit work
 * 5. Subtasks settle
 * 6. Job history updates
 * 7. Reputation increases
 * 8. Mission settles
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { MissionRegistry } from '../core/missions/mission-registry';
import { MissionStore } from '../core/missions/mission-store';
import { AgentNotificationQueue } from '../core/tasks/agent-notification-queue';
import { TaskQueue } from '../core/dispatch/task-queue';
import { HeartbeatManager } from '../core/dispatch/heartbeat-manager';
import { TokenLedger } from '../core/ledger/token-ledger';
import { EscrowEngine } from '../core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '../core/missions/assignment-history';
import { BondManager } from '../core/bonds/bond-manager';
import { SettlementEngine } from '../core/settlement/settlement-engine';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import { ReputationEngine } from '../core/agents/reputation-engine';
import fetch from 'node-fetch';

// Configuration
const API_BASE = 'http://localhost:3000';
const CANONICAL_AGENTS = {
    research: 'ResearchBot',
    implementation: 'CodeWizard',
    design: 'DesignMaster'
};

// Initialize core systems
const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const notifications = new AgentNotificationQueue();
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('./data');
const bondManager = new BondManager(tokenLedger, './data');
const jobHistory = new JobHistoryManager('./data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, './data');
const reputationEngine = new ReputationEngine('./data');

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

interface Agent {
    id: string;
    name: string;
    specialty: string;
    apiKey: string;
}

async function loadAgents(): Promise<Agent[]> {
    console.log('\n📋 Loading canonical workforce...');

    const agents: Agent[] = [];
    const allAgents = agentAuth.listAgents();

    for (const [specialty, agentName] of Object.entries(CANONICAL_AGENTS)) {
        const agent = allAgents.find(a => a.name === agentName);
        if (!agent) {
            throw new Error(`Agent ${agentName} not found in agent-auth.json`);
        }

        agents.push({
            id: agent.id,
            name: agent.name,
            specialty,
            apiKey: agent.apiKey
        });

        console.log(`  ✅ ${agent.name} (${specialty})`);
    }

    return agents;
}

async function createCrewMission(): Promise<string> {
    console.log('\n🚀 Creating crew mission...');

    // Fund the requester
    const requesterId = 'demo-requester';
    tokenLedger.mint(requesterId, 10000);
    console.log(`  💰 Funded ${requesterId} with 10000 $CLAWGER`);

    const result = await missionRegistry.createMission({
        title: 'DEMO: Full Crew Execution Loop',
        description: 'End-to-end test of crew economy: claim → execute → submit → settle',
        reward: 600,
        crew_enabled: true,
        requester_id: requesterId,
        specialties: ['research', 'implementation', 'design'],
        requirements: ['Complete all subtasks', 'High quality work'],
        deliverables: ['Research report', 'Implementation code', 'Design assets']
    });

    console.log(`  ✅ Mission created: ${result.mission.id}`);

    // Wait for mission to persist to disk and API routes to reload
    await new Promise(resolve => setTimeout(resolve, 2000));

    return result.mission.id;
}

async function claimSubtask(missionId: string, subtaskId: string, agent: Agent): Promise<void> {
    console.log(`\n🤝 ${agent.name} claiming ${subtaskId}...`);

    const response = await fetch(`${API_BASE}/api/missions/${missionId}/subtasks/${subtaskId}/claim`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': agent.apiKey
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to claim subtask: ${error}`);
    }

    const result: any = await response.json();
    console.log(`  ✅ ${agent.name} claimed ${subtaskId}`);
    console.log(`     Operator: ${result.subtask.claimed_by_name}`);
}

async function executeAndSubmit(missionId: string, subtaskId: string, agent: Agent): Promise<boolean> {
    console.log(`\n🚀 ${agent.name} executing ${subtaskId}...`);

    // Simulate work (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`  📤 ${agent.name} submitting ${subtaskId}...`);

    const response = await fetch(`${API_BASE}/api/missions/${missionId}/subtasks/${subtaskId}/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': agent.apiKey
        },
        body: JSON.stringify({
            work_output: `Completed ${subtaskId} work`,
            artifacts: []
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to submit subtask: ${error}`);
    }

    const result: any = await response.json();
    console.log(`  ✅ ${subtaskId} submitted + settled`);
    console.log(`     Earned: ${result.earned} $CLAWGER`);
    console.log(`     All settled: ${result.all_settled ? 'YES' : 'NO'}`);

    return result.all_settled;
}

async function verifyOutcomes(missionId: string, agents: Agent[]): Promise<void> {
    console.log('\n\n🔍 VERIFICATION RESULTS\n');
    console.log('═'.repeat(60));

    // Reload state from disk to catch API updates as the script process is separate from API process
    const missionStore = new MissionStore('./data');
    const jobHistory = new JobHistoryManager('./data');
    const reputationEngine = new ReputationEngine('./data');
    const tokenLedger = new TokenLedger('./data');

    // Check mission status
    const mission = missionStore.get(missionId);
    console.log('\n📋 Mission Status:');
    console.log(`  Status: ${mission?.status?.toUpperCase()}`);
    console.log(`  Settled: ${mission?.settled_at ? 'YES' : 'NO'}`);

    // Check subtask operators
    console.log('\n👥 Subtask Operator Assignments:');
    if (mission?.task_graph?.nodes) {
        for (const [subtaskId, subtask] of Object.entries(mission.task_graph.nodes)) {
            const operator = (subtask as any).claimed_by_name || 'Pending';
            const status = (subtask as any).status || 'unknown';
            console.log(`  ${subtaskId.padEnd(20)} → ${operator.padEnd(15)} [${status}]`);
        }
    }

    // Check job history
    console.log('\n📊 Job History:');
    for (const agent of agents) {
        const history = jobHistory.getHistory(agent.id);
        const totalEarned = jobHistory.getTotalEarnings(agent.id);
        const jobCount = jobHistory.getJobCount(agent.id);
        console.log(`  ${agent.name.padEnd(15)} → ${jobCount} job(s), ${totalEarned} $CLAWGER earned`);
    }

    // Check reputation
    console.log('\n⭐ Reputation:');
    for (const agent of agents) {
        const breakdown = reputationEngine.getReputationBreakdown(agent.id);
        console.log(`  ${agent.name.padEnd(15)} → ${breakdown.total} (base: ${breakdown.base}, settlements: +${breakdown.settlements}, ratings: +${breakdown.ratings})`);
    }

    // Check token balances
    console.log('\n💰 Token Balances:');
    for (const agent of agents) {
        const balance = tokenLedger.getBalance(agent.id);
        console.log(`  ${agent.name.padEnd(15)} → ${balance} $CLAWGER`);
    }

    console.log('\n' + '═'.repeat(60));

    // Final validation
    const allSettled = mission?.status === 'settled';
    const allHaveHistory = agents.every(a => jobHistory.getJobCount(a.id) > 0);
    const allHaveReputation = agents.every(a => reputationEngine.calculateReputation(a.id) > 50);

    if (allSettled && allHaveHistory && allHaveReputation) {
        console.log('\n🎉 SUCCESS! Crew economy fully functional!\n');
    } else {
        console.log('\n⚠️  WARNING: Some checks failed:\n');
        if (!allSettled) console.log('  ❌ Mission not settled');
        if (!allHaveHistory) console.log('  ❌ Some agents missing job history');
        if (!allHaveReputation) console.log('  ❌ Some agents still at baseline reputation');
        console.log();
    }
}

async function main() {
    console.log('\n' + '═'.repeat(60));
    console.log('🎯 CREW ECONOMY E2E DEMO');
    console.log('═'.repeat(60));

    try {
        // Step 1: Load agents
        const agents = await loadAgents();

        // Step 2: Create crew mission
        const missionId = await createCrewMission();

        // Step 3: Bots claim subtasks
        console.log('\n📝 Claiming subtasks...');
        await claimSubtask(missionId, 'research', agents[0]);
        await claimSubtask(missionId, 'implementation', agents[1]);
        await claimSubtask(missionId, 'design', agents[2]);

        // Step 4: Bots execute and submit
        console.log('\n⚙️  Executing subtasks...');
        await executeAndSubmit(missionId, 'research', agents[0]);
        await executeAndSubmit(missionId, 'implementation', agents[1]);
        const allSettled = await executeAndSubmit(missionId, 'design', agents[2]);

        if (allSettled) {
            console.log('\n🎉 Crew mission fully settled!');
        }

        // Step 5: Verify outcomes
        await verifyOutcomes(missionId, agents);

    } catch (error) {
        console.error('\n❌ Demo failed:', error);
        process.exit(1);
    }
}

main();
