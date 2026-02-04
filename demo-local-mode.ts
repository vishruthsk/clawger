/**
 * LOCAL Mode Demo
 * Demonstrates order-based execution with process management
 */

import { OrderProcessor } from './core/local/order-processor';
import { LocalAgentManager } from './core/local/local-agent-manager';
import { ProcessEnforcer } from './core/local/process-enforcer';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runLocalModeDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} LOCAL MODE DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize components
    const orderProcessor = new OrderProcessor();
    const agentManager = new LocalAgentManager();
    const enforcer = new ProcessEnforcer(agentManager);

    // Register mock local agents
    logger.info(`${prefix} Registering local agents...\n`);

    agentManager.registerAgent(1234, '0xWORKER1', 'worker');
    agentManager.registerAgent(5678, '0xWORKER2', 'worker');
    agentManager.registerAgent(9012, '0xVERIFIER1', 'verifier');

    // Simulate initial status
    agentManager.updateStatus('0xWORKER1', 'idle');
    agentManager.updateStatus('0xWORKER2', 'idle');
    agentManager.updateStatus('0xVERIFIER1', 'idle');

    await sleep(1000);

    // ============ Scenario 1: Normal Order Execution ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Normal Order Execution`);
    logger.info(`${prefix} ========================================\n`);

    const order1 = orderProcessor.submitOrder(
        '0xOPERATOR',
        'Process 1000 data entries',
        'medium',
        300000
    );

    // Assign to worker
    const worker1 = agentManager.getAvailableWorkers()[0];
    logger.info(`${prefix} Assigning to worker: ${worker1.address}\n`);

    agentManager.updateStatus(worker1.address, 'working');
    orderProcessor.updateStatus(order1.id, 'executing');

    await sleep(1000);

    // Complete successfully
    logger.info(`${prefix} Task completed successfully\n`);
    agentManager.recordTaskCompletion(worker1.address, true);
    orderProcessor.updateStatus(order1.id, 'completed');

    await sleep(1000);

    // ============ Scenario 2: Agent Misbehavior (High CPU) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Agent Misbehavior`);
    logger.info(`${prefix} ========================================\n`);

    const order2 = orderProcessor.submitOrder(
        '0xOPERATOR',
        'Complex computation task',
        'high',
        600000
    );

    const worker2 = agentManager.getAvailableWorkers()[0];
    logger.info(`${prefix} Assigning to worker: ${worker2.address}\n`);

    agentManager.updateStatus(worker2.address, 'working');
    orderProcessor.updateStatus(order2.id, 'executing');

    await sleep(500);

    // Simulate high CPU usage
    logger.info(`${prefix} Simulating excessive CPU usage...\n`);
    const agent2 = agentManager.getAgent(worker2.address)!;
    agent2.cpu = 98; // Exceeds threshold

    // Enforce
    await enforcer.enforce();

    logger.info(`${prefix} Agent killed. Reassigning task...\n`);

    // Reassign to another worker
    const worker3 = agentManager.getAvailableWorkers()[0];
    if (worker3) {
        await enforcer.reassignTask(order2.id, worker2.address, worker3.address, 'Original worker killed for excessive CPU');
        orderProcessor.updateStatus(order2.id, 'executing');

        await sleep(500);

        // Complete with new worker
        logger.info(`${prefix} Task completed by replacement worker\n`);
        agentManager.recordTaskCompletion(worker3.address, true);
        orderProcessor.updateStatus(order2.id, 'completed');
    }

    await sleep(1000);

    // ============ Scenario 3: High Failure Rate → Quarantine ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: High Failure Rate`);
    logger.info(`${prefix} ========================================\n`);

    // Simulate agent with high failure rate
    const unreliableWorker = agentManager.getAgent('0xWORKER1')!;
    unreliableWorker.tasksCompleted = 2;
    unreliableWorker.tasksFailed = 4; // 67% failure rate
    unreliableWorker.cpu = 96; // Trigger enforcement

    logger.info(`${prefix} Worker 0xWORKER1 has 67% failure rate\n`);

    await enforcer.enforce();

    logger.info(`${prefix} Agent quarantined for 30 minutes\n`);

    await sleep(1000);

    // ============ Statistics ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STATISTICS`);
    logger.info(`${prefix} ========================================\n`);

    const orderStats = orderProcessor.getStatistics();
    logger.info(`${prefix} Orders:`);
    logger.info(`${prefix}   Total: ${orderStats.total}`);
    logger.info(`${prefix}   Completed: ${orderStats.completed}`);
    logger.info(`${prefix}   Failed: ${orderStats.failed}\n`);

    const agentStats = agentManager.getStatistics();
    logger.info(`${prefix} Agents:`);
    logger.info(`${prefix}   Total: ${agentStats.total}`);
    logger.info(`${prefix}   Idle: ${agentStats.idle}`);
    logger.info(`${prefix}   Working: ${agentStats.working}`);
    logger.info(`${prefix}   Quarantined: ${agentStats.quarantined}`);
    logger.info(`${prefix}   Terminated: ${agentStats.terminated}\n`);

    const enforcementStats = enforcer.getStatistics();
    logger.info(`${prefix} Enforcement Actions:`);
    logger.info(`${prefix}   Total: ${enforcementStats.total}`);
    logger.info(`${prefix}   Kills: ${enforcementStats.kills}`);
    logger.info(`${prefix}   Quarantines: ${enforcementStats.quarantines}`);
    logger.info(`${prefix}   Reassignments: ${enforcementStats.reassignments}\n`);

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runLocalModeDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runLocalModeDemo };
