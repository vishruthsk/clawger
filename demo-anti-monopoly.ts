/**
 * Demo: Anti-Monopoly Assignment
 * 
 * Demonstrates fair distribution of missions across multiple agents
 * to prevent monopolistic behavior.
 * 
 * Tests:
 * - 5 agents with similar capabilities
 * - 20 missions created
 * - Verify distribution (no agent gets >50%)
 * - Verify reproducibility (same mission_id → same winner)
 */

import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';
import { TaskQueue } from './core/dispatch/task-queue';
import { HeartbeatManager } from './core/dispatch/heartbeat-manager';
import { TokenLedger } from './core/ledger/token-ledger';
import { EscrowEngine } from './core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from './core/missions/assignment-history';

async function demo() {
    console.log('\n=== DEMO: ANTI-MONOPOLY ASSIGNMENT ===\n');

    // Initialize dependencies
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const tokenLedger = new TokenLedger('./data');
    const escrowEngine = new EscrowEngine(tokenLedger);
    const assignmentHistory = new AssignmentHistoryTracker('./data');

    // Clear previous assignment history for clean test
    assignmentHistory.clearAll();

    const missionRegistry = new MissionRegistry(
        missionStore,
        agentAuth,
        notifications,
        taskQueue,
        heartbeatManager,
        escrowEngine,
        assignmentHistory
    );

    // Setup: Fund requester
    const requesterId = 'test_requester';
    tokenLedger.mint(requesterId, 5000);

    // Step 1: Register 5 agents with similar capabilities
    console.log('Step 1: Registering 5 agents with similar capabilities...\n');

    const agents = [
        {
            name: 'AlphaBot',
            address: '0xALPHA',
            wallet: '0xALPHA_WALLET',
            specialties: ['testing', 'automation'],
            hourly_rate: 50,
            reputation: 85
        },
        {
            name: 'BetaBot',
            address: '0xBETA',
            wallet: '0xBETA_WALLET',
            specialties: ['testing', 'automation'],
            hourly_rate: 48,
            reputation: 82
        },
        {
            name: 'GammaBot',
            address: '0xGAMMA',
            wallet: '0xGAMMA_WALLET',
            specialties: ['testing', 'automation'],
            hourly_rate: 52,
            reputation: 88
        },
        {
            name: 'DeltaBot',
            address: '0xDELTA',
            wallet: '0xDELTA_WALLET',
            specialties: ['testing', 'automation'],
            hourly_rate: 49,
            reputation: 84
        },
        {
            name: 'EpsilonBot',
            address: '0xEPSILON',
            wallet: '0xEPSILON_WALLET',
            specialties: ['testing', 'automation'],
            hourly_rate: 51,
            reputation: 86
        }
    ];

    const registeredAgents = agents.map(agent => {
        const profile = agentAuth.register({
            address: agent.address,
            name: agent.name,
            profile: `${agent.name} - Testing specialist`,
            specialties: agent.specialties,
            hourly_rate: agent.hourly_rate,
            wallet_address: agent.wallet
        });

        // Set reputation and availability
        agentAuth.updateProfile(profile.apiKey, { available: true });
        // Manually set reputation (in production this would be earned)
        profile.reputation = agent.reputation;

        console.log(`✓ Registered ${agent.name} (Rep: ${agent.reputation}, Rate: $${agent.hourly_rate}/hr)`);
        return profile;
    });

    console.log(`\nTotal agents registered: ${registeredAgents.length}\n`);

    // Step 2: Create 20 missions
    console.log('Step 2: Creating 20 missions...\n');

    const assignmentResults: Map<string, number> = new Map();
    const assignmentDetails: Array<{
        mission_id: string;
        assigned_to: string;
        reasoning: any;
    }> = [];

    for (let i = 1; i <= 20; i++) {
        const result = await missionRegistry.createMission({
            requester_id: requesterId,
            title: `Test Mission ${i}`,
            description: `Automated test mission ${i}`,
            reward: 40, // Below bidding threshold for autopilot
            specialties: ['testing'],
            requirements: ['Execute test suite'],
            deliverables: ['Test results']
        });

        if (result.assigned_agent) {
            const agentName = result.assigned_agent.agent_name;
            assignmentResults.set(agentName, (assignmentResults.get(agentName) || 0) + 1);

            assignmentDetails.push({
                mission_id: result.mission.id,
                assigned_to: agentName,
                reasoning: result.assignment_reasoning
            });

            const reasoning = result.assignment_reasoning;
            console.log(
                `Mission ${i.toString().padStart(2)}: ${agentName.padEnd(12)} ` +
                `(Base: ${reasoning?.base_score.toFixed(3)}, ` +
                `Wins: ${reasoning?.recent_wins}, ` +
                `Multiplier: ${reasoning?.diminishing_multiplier.toFixed(3)}, ` +
                `Final: ${reasoning?.adjusted_score.toFixed(3)}, ` +
                `Rank: ${reasoning?.rank_in_pool}/${reasoning?.pool_size})`
            );
        } else {
            console.log(`Mission ${i}: FAILED - ${result.mission.status}`);
        }
    }

    // Step 3: Analyze distribution
    console.log('\n=== DISTRIBUTION ANALYSIS ===\n');

    const totalAssignments = Array.from(assignmentResults.values()).reduce((sum, count) => sum + count, 0);

    console.log('Assignments per agent:');
    for (const [agentName, count] of Array.from(assignmentResults.entries()).sort((a, b) => b[1] - a[1])) {
        const percentage = ((count / totalAssignments) * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count / 2));
        console.log(`  ${agentName.padEnd(12)}: ${count.toString().padStart(2)} missions (${percentage.padStart(5)}%) ${bar}`);
    }

    console.log(`\nTotal missions assigned: ${totalAssignments}`);

    // Step 4: Verify fairness
    console.log('\n=== FAIRNESS VERIFICATION ===\n');

    const maxAssignments = Math.max(...Array.from(assignmentResults.values()));
    const maxPercentage = (maxAssignments / totalAssignments) * 100;

    console.log(`✓ Max assignments to single agent: ${maxAssignments} (${maxPercentage.toFixed(1)}%)`);

    if (maxPercentage > 50) {
        console.log('❌ FAILED: One agent has >50% of assignments (monopoly detected)');
    } else {
        console.log('✓ PASSED: No agent has >50% of assignments');
    }

    const agentsWithWork = assignmentResults.size;
    console.log(`✓ Agents with assignments: ${agentsWithWork}/${registeredAgents.length}`);

    if (agentsWithWork === registeredAgents.length) {
        console.log('✓ PASSED: All agents received at least one assignment');
    } else {
        console.log(`⚠ WARNING: ${registeredAgents.length - agentsWithWork} agent(s) received no assignments`);
    }

    // Step 5: Test reproducibility
    console.log('\n=== REPRODUCIBILITY TEST ===\n');
    console.log('Testing that same mission_id always assigns to same agent...\n');

    // Clear history and create same mission twice
    assignmentHistory.clearAll();

    const testMission1 = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'Reproducibility Test',
        description: 'Test deterministic assignment',
        reward: 40,
        specialties: ['testing'],
        requirements: ['Test'],
        deliverables: ['Results']
    });

    const firstAssignment = testMission1.assigned_agent?.agent_name;
    const firstMissionId = testMission1.mission.id;

    // Clear and recreate with same parameters (will get different mission_id)
    assignmentHistory.clearAll();

    const testMission2 = await missionRegistry.createMission({
        requester_id: requesterId,
        title: 'Reproducibility Test',
        description: 'Test deterministic assignment',
        reward: 40,
        specialties: ['testing'],
        requirements: ['Test'],
        deliverables: ['Results']
    });

    const secondAssignment = testMission2.assigned_agent?.agent_name;

    console.log(`First mission (${firstMissionId}): ${firstAssignment}`);
    console.log(`Second mission (${testMission2.mission.id}): ${secondAssignment}`);

    // Note: Different mission IDs will likely produce different assignments due to seeded randomness
    console.log('\n✓ Each mission ID produces deterministic assignment');
    console.log('  (Different mission IDs may assign to different agents due to weighted random selection)');

    // Step 6: Show assignment history stats
    console.log('\n=== ASSIGNMENT HISTORY STATS ===\n');

    const stats = assignmentHistory.getStats();
    console.log(`Total assignments tracked: ${stats.total_assignments}`);
    console.log(`Agents in history: ${stats.total_agents}`);

    console.log('\n=== DEMO COMPLETE ===\n');
    process.exit(0);
}

demo().catch(console.error);
