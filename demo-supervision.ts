/**
 * Execution Supervision Demo
 * Demonstrates: grace period → stall → kill → reassign → success
 */

import { createWorkContract, startExecution, recordHeartbeat, submitWork, completeVerification } from './core/execution/work-contract';
import { ExecutionSupervisor } from './core/execution/execution-supervisor';
import { LocalAgentManager } from './core/local/local-agent-manager';
import { ProcessEnforcer } from './core/local/process-enforcer';
import { Proposal } from './core/types';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runSupervisionDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} EXECUTION SUPERVISION DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize LOCAL mode components
    const agentManager = new LocalAgentManager();
    const enforcer = new ProcessEnforcer(agentManager);

    // Register mock workers
    agentManager.registerAgent(1001, '0xWORKER_A', 'worker');
    agentManager.registerAgent(1002, '0xWORKER_B', 'worker');
    agentManager.registerAgent(2001, '0xVERIFIER_1', 'verifier');

    agentManager.updateStatus('0xWORKER_A', 'idle');
    agentManager.updateStatus('0xWORKER_B', 'idle');
    agentManager.updateStatus('0xVERIFIER_1', 'idle');

    // Create supervisor
    const supervisor = new ExecutionSupervisor({
        mode: 'LOCAL',
        check_interval_ms: 5000,
        local_agent_manager: agentManager,
        process_enforcer: enforcer
    });

    // Create mock proposal
    const proposal: Proposal = {
        id: 'PROP-DEMO-001',
        proposer: '0xUSER',
        objective: 'Process 1000 data entries',
        budget: '5',
        deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        risk_tolerance: 'medium',
        status: 'accepted',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    // ============ Create Work Contract ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO: Stall Detection & Reassignment`);
    logger.info(`${prefix} ========================================\n`);

    const contract = createWorkContract(
        proposal,
        '0xWORKER_A',
        ['0xVERIFIER_1'],
        1 // max_retries
    );

    // Register with supervisor
    supervisor.registerContract(contract);
    supervisor.startMonitoring();

    await sleep(2000);

    // ============ Start Execution ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PHASE 1: Worker A Starts (Grace Period)`);
    logger.info(`${prefix} ========================================\n`);

    startExecution(contract);
    agentManager.updateStatus('0xWORKER_A', 'working');

    logger.info(`${prefix} Worker A started`);
    logger.info(`${prefix} Grace period: 60s (heartbeat not enforced yet)\n`);

    await sleep(3000);

    // ============ Heartbeats During Grace Period ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PHASE 2: Heartbeats (10s, 20s)`);
    logger.info(`${prefix} ========================================\n`);

    logger.info(`${prefix} [T+10s] Worker A heartbeat (progress: 10%)`);
    recordHeartbeat(contract, 10);

    await sleep(5000);

    logger.info(`${prefix} [T+20s] Worker A heartbeat (progress: 20%)\n`);
    recordHeartbeat(contract, 20);

    await sleep(5000);

    // ============ Stall (No More Heartbeats) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PHASE 3: Worker A Stalls`);
    logger.info(`${prefix} ========================================\n`);

    logger.warn(`${prefix} [T+30s] No heartbeat from Worker A`);
    logger.warn(`${prefix} Worker A has stalled!\n`);

    // Simulate stall by not sending heartbeat
    await sleep(10000);

    logger.warn(`${prefix} [T+40s] Still no heartbeat...`);
    logger.warn(`${prefix} Grace period elapsed, heartbeat enforcement active\n`);

    await sleep(25000);

    // Supervisor should have detected stall and reassigned by now

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PHASE 4: Supervisor Detects Stall`);
    logger.info(`${prefix} ========================================\n`);

    logger.info(`${prefix} Supervisor detected stall after 30s timeout`);
    logger.info(`${prefix} Worker A killed and quarantined`);
    logger.info(`${prefix} Work reassigned to Worker B\n`);

    // Manually trigger reassignment (in real scenario, supervisor does this)
    if (contract.status === 'assigned' && contract.worker === '0xWORKER_B') {
        logger.info(`${prefix} ✅ Reassignment successful!\n`);
    }

    await sleep(2000);

    // ============ Worker B Executes Successfully ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PHASE 5: Worker B Executes`);
    logger.info(`${prefix} ========================================\n`);

    // Start Worker B
    if (contract.status === 'assigned') {
        startExecution(contract);
        agentManager.updateStatus('0xWORKER_B', 'working');

        logger.info(`${prefix} Worker B started`);
        logger.info(`${prefix} Grace period: 60s\n`);

        await sleep(3000);

        // Worker B sends regular heartbeats
        logger.info(`${prefix} [T+10s] Worker B heartbeat (progress: 15%)`);
        recordHeartbeat(contract, 15);

        await sleep(5000);

        logger.info(`${prefix} [T+20s] Worker B heartbeat (progress: 40%)`);
        recordHeartbeat(contract, 40);

        await sleep(5000);

        logger.info(`${prefix} [T+30s] Worker B heartbeat (progress: 70%)`);
        recordHeartbeat(contract, 70);

        await sleep(5000);

        logger.info(`${prefix} [T+40s] Worker B heartbeat (progress: 95%)\n`);
        recordHeartbeat(contract, 95);

        await sleep(3000);

        // Worker B submits work
        logger.info(`${prefix} [T+45s] Worker B submits work\n`);
        submitWork(contract, 'Processed 1000 entries successfully');

        await sleep(2000);

        // Verification passes
        logger.info(`${prefix} Verifier checks work...`);
        await sleep(2000);

        completeVerification(contract, true);
    }

    await sleep(2000);

    // ============ Summary ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} EXECUTION SUMMARY`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Contract ID: ${contract.contract_id}`);
    logger.info(`${prefix} Final status: ${contract.status.toUpperCase()}`);
    logger.info(`${prefix} Successful worker: ${contract.worker}`);
    logger.info(`${prefix} Failed workers: ${contract.reassigned_from.map(r => r.worker).join(', ')}`);
    logger.info(`${prefix} Retries used: ${contract.retry_count}/${contract.max_retries}`);
    logger.info(`${prefix} `);

    if (contract.reassigned_from.length > 0) {
        logger.info(`${prefix} Failure details:`);
        contract.reassigned_from.forEach((failure, i) => {
            logger.info(`${prefix}   ${i + 1}. ${failure.worker}`);
            logger.info(`${prefix}      Type: ${failure.failure_type}`);
            logger.info(`${prefix}      Reason: ${failure.reason}`);
        });
    }

    logger.info(`${prefix} ========================================`);

    // Stop supervisor
    supervisor.stopMonitoring();

    // Agent statistics
    const agentStats = agentManager.getStatistics();
    logger.info(`${prefix} `);
    logger.info(`${prefix} Agent Statistics:`);
    logger.info(`${prefix}   Total: ${agentStats.total}`);
    logger.info(`${prefix}   Idle: ${agentStats.idle}`);
    logger.info(`${prefix}   Working: ${agentStats.working}`);
    logger.info(`${prefix}   Quarantined: ${agentStats.quarantined}`);
    logger.info(`${prefix}   Terminated: ${agentStats.terminated}`);

    logger.info(`${prefix} `);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runSupervisionDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runSupervisionDemo };
