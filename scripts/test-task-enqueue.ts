/**
 * Test: Create mission via API and verify task is enqueued
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TaskQueue } from '../core/dispatch/task-queue';

const API_BASE = 'http://localhost:3000';

async function test() {
    const agentAuth = new AgentAuth('./data');

    const requester = agentAuth.listAgents().find(a => a.name === 'E2E_Requester');
    if (!requester) {
        console.error('E2E_Requester not found');
        return;
    }

    console.log('📋 Creating mission via API...');
    const response = await fetch(`${API_BASE}/api/missions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${requester.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: 'Task Enqueue Verification Test',
            description: 'Testing if dispatchMissionToAgent is called',
            reward: 50,
            specialties: ['coding'],
            requirements: ['Test'],
            deliverables: ['Test'],
            tags: ['test'],
            force_bidding: false
        })
    });

    const data = await response.json();
    console.log('✅ Mission created:', data.mission?.id);
    console.log('   Status:', data.mission?.status);
    console.log('   Assigned to:', data.mission?.assigned_agent?.agent_id, data.mission?.assigned_agent?.agent_name);

    if (data.mission?.assigned_agent) {
        const agentId = data.mission.assigned_agent.agent_id;
        const missionId = data.mission.id;

        console.log('\n📋 Checking TaskQueue for enqueued task...');

        // Wait a moment for task to be written to disk
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create NEW TaskQueue instance to load fresh data from disk
        const taskQueue = new TaskQueue('./data');

        const pollResult = taskQueue.poll(agentId, 50);
        console.log(`   Found ${pollResult.tasks.length} total tasks for agent`);

        const missionTask = pollResult.tasks.find(t => t.payload?.mission_id === missionId);
        if (missionTask) {
            console.log('\n✅ SUCCESS: Task found for new mission!');
            console.log('   Task ID:', missionTask.id);
            console.log('   Task type:', missionTask.type);
            console.log('   Created:', missionTask.created_at);
        } else {
            console.log('\n❌ FAILURE: No task found for new mission');
            console.log('   Expected mission_id:', missionId);
            console.log('   All mission IDs in queue:', pollResult.tasks.map(t => t.payload?.mission_id));
        }
    }
}

test().catch(console.error);
