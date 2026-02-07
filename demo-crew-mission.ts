/**
 * Demo: Crew Missions
 * 
 * Demonstrates multi-agent coordination through shared mission state:
 * 1. Create crew mission with subtask DAG
 * 2. Multiple agents join crew
 * 3. Agents claim tasks based on dependencies
 * 4. Upload artifacts per subtask
 * 5. Monitor event stream and progress
 * 6. Complete mission when all tasks done
 */

import { MissionStore } from './core/missions/mission-store';
import { CrewMissionStore } from './core/missions/crew-mission-store';
import { TaskGraph } from './core/missions/task-graph';
import { AgentAuth } from './core/registry/agent-auth';
import { SubTask } from './core/types';

async function demo() {
    console.log('\n=== DEMO: CREW MISSIONS ===\n');

    // Initialize stores
    const missionStore = new MissionStore('./data');
    const crewStore = new CrewMissionStore('./data');
    const agentAuth = new AgentAuth('./data');

    // Step 1: Register 3 agents with different specialties
    console.log('Step 1: Registering Crew Members...\n');

    const frontend = agentAuth.register({
        address: '0xFRONTEND_DEV',
        name: 'ReactBot',
        profile: 'Expert frontend developer specializing in React and NextJS',
        specialties: ['Frontend', 'UI/UX'],
        hourly_rate: 45,
        wallet_address: '0xFRONTEND_WALLET'
    });

    const backend = agentAuth.register({
        address: '0xBACKEND_DEV',
        name: 'NodeMaster',
        profile: 'Backend specialist with expertise in Node.js and databases',
        specialties: ['Backend', 'API Development'],
        hourly_rate: 50,
        wallet_address: '0xBACKEND_WALLET'
    });

    const tester = agentAuth.register({
        address: '0xTESTER',
        name: 'QualityBot',
        profile: 'QA engineer focused on automated testing',
        specialties: ['Testing', 'QA'],
        hourly_rate: 40,
        wallet_address: '0xTESTER_WALLET'
    });

    console.log(`✓ Registered: ${frontend.name} (${frontend.id})`);
    console.log(`✓ Registered: ${backend.name} (${backend.id})`);
    console.log(`✓ Registered: ${tester.name} (${tester.id})\n`);

    // Step 2: Create crew mission
    console.log('Step 2: Creating Crew Mission...\n');

    const mission = missionStore.create({
        requester_id: 'human_team_lead',
        title: 'Build User Dashboard Feature',
        description: 'Implement a comprehensive user dashboard with analytics',
        reward: 500,
        tags: ['feature', 'fullstack'],
        specialties: ['Frontend', 'Backend', 'Testing'],
        requirements: [
            'API endpoints for user data',
            'React dashboard components',
            'E2E test coverage'
        ],
        deliverables: [
            'Working API',
            'UI Components',
            'Test Suite'
        ],
        assignment_mode: 'autopilot',
        crew_required: true,
        escrow: { locked: true, amount: 500 }
    });

    console.log(`✓ Mission Created: ${mission.id}`);
    console.log(`  Title: ${mission.title}`);
    console.log(`  Reward: ${mission.reward} $CLAWGER\n`);

    // Step 3: Initialize crew
    console.log('Step 3: Initializing Crew...\n');

    crewStore.initializeCrew(mission, {
        min_agents: 3,
        max_agents: 3,
        required_roles: ['frontend', 'backend', 'tester'],
        coordination_mode: 'hybrid'
    });

    // Add crew members
    crewStore.addCrewMember(mission, frontend.id, frontend.name, 'frontend');
    crewStore.addCrewMember(mission, backend.id, backend.name, 'backend');
    crewStore.addCrewMember(mission, tester.id, tester.name, 'tester');

    console.log(`✓ Crew Assembled: ${mission.crew_assignments?.length} members`);
    mission.crew_assignments?.forEach(member => {
        console.log(`  - ${member.agent_name} (${member.role})`);
    });
    console.log();

    // Step 4: Create task graph
    console.log('Step 4: Creating Task Graph (DAG)...\n');

    const graph = new TaskGraph();

    // Define subtasks
    const task1: SubTask = {
        id: 'task_1_api_design',
        description: 'Design API endpoints for user data',
        role: 'backend',
        dependencies: [],
        status: 'available',
        estimated_duration_minutes: 60,
        artifacts: []
    };

    const task2: SubTask = {
        id: 'task_2_api_impl',
        description: 'Implement API endpoints',
        role: 'backend',
        dependencies: ['task_1_api_design'],
        status: 'available',
        estimated_duration_minutes: 120,
        artifacts: []
    };

    const task3: SubTask = {
        id: 'task_3_ui_design',
        description: 'Design dashboard components',
        role: 'frontend',
        dependencies: [],
        status: 'available',
        estimated_duration_minutes: 90,
        artifacts: []
    };

    const task4: SubTask = {
        id: 'task_4_ui_impl',
        description: 'Implement dashboard UI',
        role: 'frontend',
        dependencies: ['task_3_ui_design', 'task_2_api_impl'],
        status: 'available',
        estimated_duration_minutes: 150,
        artifacts: []
    };

    const task5: SubTask = {
        id: 'task_5_testing',
        description: 'Write and run E2E tests',
        role: 'tester',
        dependencies: ['task_4_ui_impl'],
        status: 'available',
        estimated_duration_minutes: 90,
        artifacts: []
    };

    // Add tasks to graph
    [task1, task2, task3, task4, task5].forEach(task => graph.addNode(task));

    // Validate graph
    const validation = graph.validate();
    if (!validation.valid) {
        console.error('❌ Task graph validation failed:', validation.errors);
        return;
    }

    console.log('✓ Task Graph Validated (No Cycles)');
    console.log(`  Total Tasks: ${graph.getAllTasks().length}`);
    console.log(`  Available Tasks: ${graph.getAvailableTasks().length}\n`);

    // Save graph to mission
    mission.task_graph = graph.toJSON();
    missionStore.update(mission.id, mission);

    // Step 5: Agents claim and complete tasks
    console.log('Step 5: Task Execution...\n');

    // Backend claims task 1
    console.log(`[Backend] Claiming: ${task1.description}`);
    let result = crewStore.claimSubTask(mission, task1.id, backend.id);
    console.log(`  Result: ${result.success ? '✓ Claimed' : '✗ Failed: ' + result.reason}`);

    // Frontend claims task 3 (no dependencies)
    console.log(`[Frontend] Claiming: ${task3.description}`);
    result = crewStore.claimSubTask(mission, task3.id, frontend.id);
    console.log(`  Result: ${result.success ? '✓ Claimed' : '✗ Failed: ' + result.reason}`);

    // Complete task 1
    console.log(`[Backend] Completing: ${task1.description}`);
    result = crewStore.completeSubTask(mission, task1.id, backend.id);
    console.log(`  Result: ${result.success ? '✓ Completed' : '✗ Failed: ' + result.reason}`);

    // Upload artifact for task 1
    const artifact1 = crewStore.addArtifact(
        mission,
        task1.id,
        backend.id,
        'https://github.com/repo/api-design.md',
        'documentation',
        { format: 'markdown', size: '15KB' },
        'API specification document'
    );
    console.log(`  ✓ Artifact Uploaded: ${artifact1.id}\n`);

    // Backend claims task 2 (depends on task 1 - should work now)
    console.log(`[Backend] Claiming: ${task2.description}`);
    result = crewStore.claimSubTask(mission, task2.id, backend.id);
    console.log(`  Result: ${result.success ? '✓ Claimed' : '✗ Failed: ' + result.reason}`);

    // Complete task 2
    console.log(`[Backend] Completing: ${task2.description}`);
    result = crewStore.completeSubTask(mission, task2.id, backend.id);
    console.log(`  Result: ${result.success ? '✓ Completed' : '✗ Failed: ' + result.reason}\n`);

    // Complete task 3
    console.log(`[Frontend] Completing: ${task3.description}`);
    result = crewStore.completeSubTask(mission, task3.id, frontend.id);
    console.log(`  Result: ${result.success ? '✓ Completed' : '✗ Failed: ' + result.reason}\n`);

    // Frontend tries to claim task 4 (depends on task 2 & 3 - both complete)
    console.log(`[Frontend] Claiming: ${task4.description}`);
    result = crewStore.claimSubTask(mission, task4.id, frontend.id);
    console.log(`  Result: ${result.success ? '✓ Claimed' : '✗ Failed: ' + result.reason}`);

    // Complete task 4
    console.log(`[Frontend] Completing: ${task4.description}`);
    result = crewStore.completeSubTask(mission, task4.id, frontend.id);
    console.log(`  Result: ${result.success ? '✓ Completed' : '✗ Failed: ' + result.reason}\n`);

    // Tester claims task 5 (final task)
    console.log(`[Tester] Claiming: ${task5.description}`);
    result = crewStore.claimSubTask(mission, task5.id, tester.id);
    console.log(`  Result: ${result.success ? '✓ Claimed' : '✗ Failed: ' + result.reason}`);

    // Complete task 5
    console.log(`[Tester] Completing: ${task5.description}`);
    result = crewStore.completeSubTask(mission, task5.id, tester.id);
    console.log(`  Result: ${result.success ? '✓ Completed' : '✗ Failed: ' + result.reason}\n`);

    // Step 6: Check progress
    console.log('Step 6: Mission Progress...\n');

    const state = crewStore.getMissionState(mission);
    console.log('Progress Summary:');
    console.log(`  Completed: ${state.task_progress?.completed}/${state.task_progress?.total}`);
    console.log(`  Percentage: ${state.task_progress?.percentage.toFixed(0)}%`);
    console.log(`  Artifacts: ${state.artifacts.length}`);
    console.log(`  Events: ${mission.event_stream?.length}\n`);

    // Step 7: Show event stream
    console.log('Step 7: Recent Events...\n');

    const recentEvents = state.recent_events.slice(0, 5);
    recentEvents.forEach(event => {
        console.log(`  [${event.type}] ${new Date(event.timestamp).toLocaleTimeString()}`);
        if (event.agent_id) {
            const agent = mission.crew_assignments?.find(c => c.agent_id === event.agent_id);
            console.log(`    Agent: ${agent?.agent_name || event.agent_id}`);
        }
        if (event.details) {
            console.log(`    Details: ${JSON.stringify(event.details)}`);
        }
    });

    console.log('\n=== DEMO COMPLETE ===\n');
    console.log('Key Features Demonstrated:');
    console.log('  ✓ Multi-agent crew formation');
    console.log('  ✓ Task graph with dependencies (DAG)');
    console.log('  ✓ Dependency-based task claiming');
    console.log('  ✓ Artifact upload and tracking');
    console.log('  ✓ Event stream logging');
    console.log('  ✓ Progress tracking across crew\n');

    process.exit(0);
}

demo().catch(console.error);
