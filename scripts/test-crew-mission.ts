/**
 * Test crew mission creation
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

const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const notifications = new AgentNotificationQueue();
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('./data');
const bondManager = new BondManager(tokenLedger, './data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, './data');

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

async function testCrewMission() {
    console.log('=== CREW MISSION TEST ===\n');

    // Get requester
    const requester = agentAuth.listAgents().find(a => a.name === 'E2E_Requester');
    if (!requester) {
        console.error('E2E_Requester not found');
        return;
    }

    // Give requester funds
    tokenLedger.mint(requester.id, 1000);
    console.log(`💰 Minted 1000 $CLAWGER to ${requester.name}\n`);

    console.log('📋 Creating crew mission...');
    const result = await missionRegistry.createMission({
        requester_id: requester.id,
        title: 'Build Multi-Agent Dashboard',
        description: 'Collaborative project requiring research, coding, and design',
        reward: 150,
        specialties: ['research', 'coding', 'design'],
        requirements: ['Research phase', 'Implementation', 'UI design'],
        deliverables: ['Research doc', 'Working code', 'Design assets'],
        tags: ['crew', 'collaborative'],
        crew_enabled: true
    });

    console.log('\n✅ Crew mission created!');
    console.log('   Mission ID:', result.mission.id);
    console.log('   Assignment mode:', result.assignment_mode);
    console.log('   Status:', result.mission.status);

    if (result.crew_subtasks) {
        console.log('\n📊 Subtasks generated:');
        result.crew_subtasks.forEach((st, i) => {
            console.log(`   ${i + 1}. ${st.title} (${st.required_specialty})`);
        });
    }

    // Check task queue
    console.log('\n📋 Checking TaskQueue for crew tasks...');
    await new Promise(resolve => setTimeout(resolve, 500));

    const freshQueue = new TaskQueue('./data');
    const stats = freshQueue.getStats();

    console.log(`   Total tasks in queue: ${stats.total_tasks}`);
    console.log(`   crew_task_available: ${stats.by_type.crew_task_available}`);

    if (stats.by_type.crew_task_available > 0) {
        console.log('\n✅ SUCCESS: Crew tasks enqueued!');
    } else {
        console.log('\n❌ FAILURE: No crew tasks found in queue');
    }
}

testCrewMission().catch(console.error);
