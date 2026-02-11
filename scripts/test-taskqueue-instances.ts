/**
 * Test TaskQueue instance isolation
 */

import { TaskQueue } from '../core/dispatch/task-queue';

console.log('=== CREATING FIRST TASKQUEUE INSTANCE ===');
const tq1 = new TaskQueue('./data');

console.log('\n=== ENQUEUING TASK ===');
tq1.enqueue({
    agent_id: 'test_agent_123',
    type: 'mission_assigned',
    priority: 'high',
    payload: {
        mission_id: 'test_mission_456',
        action: 'Test action'
    }
});

console.log('\n=== CREATING SECOND TASKQUEUE INSTANCE ===');
const tq2 = new TaskQueue('./data');

console.log('\n=== POLLING FROM SECOND INSTANCE ===');
const result = tq2.poll('test_agent_123', 10);
console.log(`\nResult: ${result.tasks.length} tasks found`);

if (result.tasks.length > 0) {
    console.log('✅ SUCCESS: Task persisted across instances!');
} else {
    console.log('❌ FAILURE: Task NOT found in second instance!');
}
