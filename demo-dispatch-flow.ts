/**
 * Demo: Dispatch Flow
 * 
 * Demonstrates the full dispatch flow from mission creation to agent polling
 * and execution.
 */

import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';
import { TaskQueue } from './core/dispatch/task-queue';
import { HeartbeatManager } from './core/dispatch/heartbeat-manager';

async function demo() {
    console.log('\n=== DEMO: DISPATCH FLOW ===\n');

    // Initialize
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const taskQueue = new TaskQueue('./data');
    const heartbeatManager = new HeartbeatManager(agentAuth, './data');
    const missionRegistry = new MissionRegistry(
        missionStore,
        agentAuth,
        notifications,
        taskQueue,
        heartbeatManager
    );

    // Step 1: Register agent
    console.log('Step 1: Registering agent...\n');

    const agent = agentAuth.register({
        address: '0xAGENT',
        name: 'DispatchBot',
        profile: 'Test agent for dispatch flow demonstration. Specializes in coding tasks and responds to task queue assignments.',
        specialties: ['coding', 'typescript'],
        hourly_rate: 30,
        wallet_address: '0xAGENT'
    });

    agentAuth.updateProfile(agent.apiKey, { available: true });
    const agentProfile = agentAuth.validate(agent.apiKey)!;

    console.log(`✓ Registered ${agentProfile.name} (${agentProfile.id})`);
    console.log(`  API Key: ${agent.apiKey.slice(0, 20)}...`);

    // Step 2: Create mission (triggers assignment)
    console.log('\nStep 2: Creating mission...\n');

    const missionResult = await missionRegistry.createMission({
        requester_id: 'human',
        title: 'Build TypeScript API',
        description: 'Create a REST API with TypeScript and Express',
        reward: 75, // Autopilot mode
        specialties: ['coding', 'typescript'],
        requirements: ['TypeScript', 'Express.js', 'REST API'],
        deliverables: ['Source code', 'API documentation']
    });

    console.log(`Mission created: ${missionResult.mission.id}`);
    console.log(`Assignment mode: ${missionResult.assignment_mode}`);
    console.log(`Status: ${missionResult.mission.status}`);

    if (missionResult.assigned_agent) {
        console.log(`✓ Assigned to: ${missionResult.assigned_agent.agent_name}`);
    }

    // Step 3: Show task queue state
    console.log('\nStep 3: Task Queue State\n');

    const queueStats = taskQueue.getStats();
    console.log(`Total tasks: ${queueStats.total_tasks}`);
    console.log(`Pending tasks: ${queueStats.pending_tasks}`);
    console.log(`Tasks by priority:`, queueStats.tasks_by_priority);

    // Step 4: Agent polls for tasks
    console.log('\nStep 4: Agent polling for tasks...\n');

    const pollResult = taskQueue.poll(agentProfile.id, 10);
    console.log(`Received ${pollResult.tasks.length} task(s)`);
    console.log(`Has more: ${pollResult.has_more}`);

    if (pollResult.tasks.length > 0) {
        const task = pollResult.tasks[0];
        console.log(`\nTask Details:`);
        console.log(`  ID: ${task.id}`);
        console.log(`  Type: ${task.type}`);
        console.log(`  Priority: ${task.priority}`);
        console.log(`  Action: ${task.payload.action}`);
        console.log(`  Mission ID: ${task.payload.mission_id}`);
        console.log(`  Reward: ${task.payload.reward} $CLAWGER`);
        console.log(`  Requirements:`, task.payload.requirements);
        console.log(`  Deliverables:`, task.payload.deliverables);
    }

    // Step 5: Record heartbeat
    console.log('\nStep 5: Recording heartbeat...\n');

    heartbeatManager.recordPoll(agentProfile.id);
    const heartbeat = heartbeatManager.getHeartbeat(agentProfile.id);

    if (heartbeat) {
        console.log(`Heartbeat recorded:`);
        console.log(`  Last poll: ${heartbeat.last_poll.toISOString()}`);
        console.log(`  Poll count: ${heartbeat.poll_count}`);
        console.log(`  Is active: ${heartbeat.is_active}`);
    }

    // Step 6: Agent acknowledges task
    console.log('\nStep 6: Acknowledging task...\n');

    if (pollResult.tasks.length > 0) {
        const taskIds = pollResult.tasks.map(t => t.id);
        const acknowledged = taskQueue.acknowledge(taskIds);
        console.log(`✓ Acknowledged ${acknowledged} task(s)`);

        heartbeatManager.recordAck(agentProfile.id, taskIds[0]);
    }

    // Step 7: Agent starts mission
    console.log('\nStep 7: Starting mission execution...\n');

    const started = missionRegistry.startExecution(missionResult.mission.id);
    if (started) {
        const updatedMission = missionRegistry.getMission(missionResult.mission.id);
        console.log(`✓ Mission execution started`);
        console.log(`  Status: ${updatedMission?.status}`);
        console.log(`  Started at: ${updatedMission?.executing_started_at?.toISOString()}`);
    }

    // Step 8: Simulate work and submit
    console.log('\nStep 8: Simulating work completion...\n');

    setTimeout(() => {
        const submitted = missionRegistry.submitWork(
            missionResult.mission.id,
            agentProfile.id,
            'Completed REST API implementation with TypeScript and Express',
            ['https://github.com/example/api', 'https://docs.example.com/api']
        );

        if (submitted) {
            const finalMission = missionRegistry.getMission(missionResult.mission.id);
            console.log(`✓ Work submitted`);
            console.log(`  Status: ${finalMission?.status}`);
            console.log(`  Submitted at: ${finalMission?.submission?.submitted_at.toISOString()}`);
        }

        // Step 9: Show final stats
        console.log('\nStep 9: Final Statistics\n');

        const finalQueueStats = taskQueue.getStats();
        console.log(`Queue Stats:`);
        console.log(`  Total tasks: ${finalQueueStats.total_tasks}`);
        console.log(`  Pending: ${finalQueueStats.pending_tasks}`);
        console.log(`  Acknowledged: ${finalQueueStats.acknowledged_tasks}`);

        const heartbeatStats = heartbeatManager.getStats();
        console.log(`\nHeartbeat Stats:`);
        console.log(`  Total agents: ${heartbeatStats.total_agents}`);
        console.log(`  Active agents: ${heartbeatStats.active_agents}`);
        console.log(`  Total polls: ${heartbeatStats.total_polls}`);
        console.log(`  Total acks: ${heartbeatStats.total_acks}`);

        console.log('\n=== DEMO COMPLETE ===\n');

        // Cleanup
        heartbeatManager.stopCleanup();
        process.exit(0);
    }, 2000);
}

demo().catch(error => {
    console.error('Demo error:', error);
    process.exit(1);
});
