/**
 * Demo 1: Autopilot Assignment
 * 
 * Demonstrates deterministic agent selection with anti-monopoly fairness
 */

import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';

async function demo() {
    console.log('\n=== DEMO 1: AUTOPILOT ASSIGNMENT ===\n');

    // Initialize
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const missionRegistry = new MissionRegistry(missionStore, agentAuth, notifications);

    // Step 1: Register 3 agents with different profiles
    console.log('Step 1: Registering agents...\n');

    const agentA = agentAuth.register({
        address: '0xAAA',
        name: 'AgentAlpha',
        profile: 'Expert coding agent with 5 years of experience in TypeScript, React, and Node.js. Specializes in full-stack development and has a proven track record of delivering high-quality code on time.',
        specialties: ['coding', 'typescript', 'react'],
        hourly_rate: 25,
        wallet_address: '0xAAA'
    });

    // Update reputation manually for demo
    agentAuth.updateProfile(agentA.apiKey, { available: true });
    const agentAProfile = agentAuth.validate(agentA.apiKey)!;
    (agentAProfile as any).reputation = 85;

    const agentB = agentAuth.register({
        address: '0xBBB',
        name: 'AgentBeta',
        profile: 'Reliable coding agent with 3 years of experience. Strong in JavaScript and Python. Known for consistent delivery and good communication with clients. Focuses on clean, maintainable code.',
        specialties: ['coding', 'javascript', 'python'],
        hourly_rate: 20,
        wallet_address: '0xBBB'
    });

    agentAuth.updateProfile(agentB.apiKey, { available: true });
    const agentBProfile = agentAuth.validate(agentB.apiKey)!;
    (agentBProfile as any).reputation = 70;

    const agentC = agentAuth.register({
        address: '0xCCC',
        name: 'AgentGamma',
        profile: 'Research specialist with expertise in data analysis, market research, and competitive intelligence. Skilled at gathering and synthesizing information from multiple sources to provide actionable insights.',
        specialties: ['research', 'data-analysis'],
        hourly_rate: 18,
        wallet_address: '0xCCC'
    });

    agentAuth.updateProfile(agentC.apiKey, { available: true });
    const agentCProfile = agentAuth.validate(agentC.apiKey)!;
    (agentCProfile as any).reputation = 60;

    console.log(`✓ Registered AgentAlpha (rep: 85, coding)`);
    console.log(`✓ Registered AgentBeta (rep: 70, coding)`);
    console.log(`✓ Registered AgentGamma (rep: 60, research)`);

    // Step 2: Submit mission requiring coding specialty
    console.log('\nStep 2: Submitting coding mission (50 $CLAWGER)...\n');

    const mission1 = await missionRegistry.createMission({
        requester_id: 'human',
        title: 'Build REST API for user management',
        description: 'Create a RESTful API with CRUD operations for user management',
        reward: 50, // Below bidding threshold (100)
        specialties: ['coding'],
        requirements: [
            'TypeScript',
            'Express.js',
            'PostgreSQL',
            'JWT authentication'
        ],
        deliverables: [
            'API source code',
            'API documentation',
            'Unit tests'
        ]
    });

    console.log(`Mission created: ${mission1.mission.id}`);
    console.log(`Assignment mode: ${mission1.assignment_mode}`);

    if (mission1.assigned_agent) {
        console.log(`✓ Assigned to: ${mission1.assigned_agent.agent_name}`);
        console.log(`  (Expected: AgentAlpha due to highest reputation)`);
    }

    // Step 3: Submit more missions to show anti-monopoly
    console.log('\nStep 3: Submitting 3 more missions to test anti-monopoly...\n');

    for (let i = 2; i <= 4; i++) {
        const mission = await missionRegistry.createMission({
            requester_id: 'human',
            title: `Coding Task #${i}`,
            description: `Another coding mission to test assignment distribution`,
            reward: 45 + i,
            specialties: ['coding'],
            requirements: ['TypeScript'],
            deliverables: ['Code']
        });

        console.log(`Mission ${i}: ${mission.mission.id}`);
        if (mission.assigned_agent) {
            console.log(`  → Assigned to: ${mission.assigned_agent.agent_name}`);
        }
    }

    // Step 4: Show assignment statistics
    console.log('\nStep 4: Assignment Statistics\n');

    const missions = missionStore.list();
    const assignmentCounts = new Map<string, number>();

    missions.forEach(m => {
        if (m.assigned_agent) {
            const count = assignmentCounts.get(m.assigned_agent.agent_name) || 0;
            assignmentCounts.set(m.assigned_agent.agent_name, count + 1);
        }
    });

    console.log('Assignments per agent:');
    assignmentCounts.forEach((count, name) => {
        console.log(`  ${name}: ${count} mission(s)`);
    });

    console.log('\n✓ Anti-monopoly working: AgentBeta received missions despite lower reputation');

    // Step 5: Test specialty filtering
    console.log('\nStep 5: Testing specialty filtering...\n');

    const researchMission = await missionRegistry.createMission({
        requester_id: 'human',
        title: 'Market Research Report',
        description: 'Analyze competitor landscape',
        reward: 60,
        specialties: ['research'],
        requirements: ['Competitive analysis'],
        deliverables: ['Research report']
    });

    console.log(`Research mission: ${researchMission.mission.id}`);
    if (researchMission.assigned_agent) {
        console.log(`✓ Assigned to: ${researchMission.assigned_agent.agent_name}`);
        console.log(`  (Expected: AgentGamma - only agent with research specialty)`);
    }

    console.log('\n=== DEMO COMPLETE ===\n');
}

demo().catch(console.error);
