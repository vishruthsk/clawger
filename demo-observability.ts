/**
 * Observability Demo
 * Demonstrates metrics evolution, decision traces, and safe mode
 */

import { createWorkContract, startExecution, recordHeartbeat, submitWork, completeVerification, markTimeout, markFailed } from './core/execution/work-contract';
import { MetricsEngine } from './core/observability/metrics-engine';
import { DecisionTraceLog } from './core/observability/decision-trace';
import { HealthMonitor } from './core/observability/health-monitor';
import { Observer } from './core/observability/observer';
import { Proposal } from './core/types';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runObservabilityDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} OBSERVABILITY DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize observability components
    const metrics = new MetricsEngine();
    const decisionTrace = new DecisionTraceLog('LOCAL');
    const healthMonitor = new HealthMonitor(metrics, decisionTrace);

    const contracts = new Map();
    const observer = new Observer(contracts, metrics, decisionTrace, healthMonitor);

    // ============ Scenario 1: 3 Successful Contracts ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Successful Contracts`);
    logger.info(`${prefix} ========================================\n`);

    for (let i = 1; i <= 3; i++) {
        const proposal: Proposal = {
            id: `PROP-${i}`,
            proposer: '0xUSER',
            objective: `Task ${i}`,
            budget: '5',
            deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            risk_tolerance: 'low',
            status: 'accepted',
            bond_amount: '0.1',
            submission_time: new Date()
        };

        const contract = createWorkContract(proposal, `0xWORKER_${i}`, [`0xVERIFIER_${i}`], 1);
        contracts.set(contract.contract_id, contract);

        // Metrics
        metrics.recordContractCreated();
        metrics.recordWorkerAssigned(`0xWORKER_${i}`);

        // Trace
        decisionTrace.logDecision(contract.contract_id, 'CONTRACT_CREATED', 'Contract registered', {
            worker: contract.worker,
            budget: contract.budget
        });

        // Execute
        startExecution(contract);
        decisionTrace.logDecision(contract.contract_id, 'EXECUTION_STARTED', 'Worker started execution', {});

        // Heartbeats
        recordHeartbeat(contract, 50);
        recordHeartbeat(contract, 100);

        // Complete
        submitWork(contract, `Result for task ${i}`);
        completeVerification(contract, true);

        metrics.recordWorkerSuccess(`0xWORKER_${i}`);
        metrics.recordContractCompleted();
        metrics.recordVerification(`0xVERIFIER_${i}`, true);

        decisionTrace.logDecision(contract.contract_id, 'VERIFICATION_PASSED', 'Work verified successfully', {
            verifier: `0xVERIFIER_${i}`
        });
        decisionTrace.logDecision(contract.contract_id, 'CONTRACT_COMPLETED', 'Contract completed successfully', {
            worker: contract.worker
        });

        await sleep(500);
    }

    logger.info(`${prefix} ✅ 3 contracts completed successfully\n`);

    // Show metrics after successful contracts
    metrics.printSummary();
    healthMonitor.printHealthReport();

    await sleep(1000);

    // ============ Scenario 2: Stall + Reassignment ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Stall + Reassignment`);
    logger.info(`${prefix} ========================================\n`);

    const proposal4: Proposal = {
        id: 'PROP-4',
        proposer: '0xUSER',
        objective: 'Task 4 (will stall)',
        budget: '5',
        deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        risk_tolerance: 'medium',
        status: 'accepted',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    const contract4 = createWorkContract(proposal4, '0xWORKER_A', ['0xVERIFIER_4'], 1);
    contracts.set(contract4.contract_id, contract4);

    metrics.recordContractCreated();
    metrics.recordWorkerAssigned('0xWORKER_A');
    decisionTrace.logDecision(contract4.contract_id, 'CONTRACT_CREATED', 'Contract registered', {
        worker: '0xWORKER_A'
    });

    startExecution(contract4);
    decisionTrace.logDecision(contract4.contract_id, 'EXECUTION_STARTED', 'Worker started execution', {});

    // Worker A stalls
    recordHeartbeat(contract4, 20);
    logger.warn(`${prefix} Worker A stalled!\n`);

    // Record failure
    metrics.recordFailure('STALL');
    metrics.recordWorkerFailure('0xWORKER_A', 'STALL');
    metrics.recordRetryUsed();

    decisionTrace.logDecision(contract4.contract_id, 'WORKER_KILLED', 'Worker stalled (no heartbeat)', {
        worker: '0xWORKER_A',
        failure_type: 'STALL'
    });

    // Reassign to Worker B
    contract4.worker = '0xWORKER_B';
    contract4.retry_count = 1;
    contract4.status = 'assigned';

    metrics.recordWorkerAssigned('0xWORKER_B');
    decisionTrace.logDecision(contract4.contract_id, 'WORK_REASSIGNED', 'Retry 1/1', {
        from_worker: '0xWORKER_A',
        to_worker: '0xWORKER_B',
        retry_count: 1
    });

    logger.info(`${prefix} Work reassigned to Worker B\n`);

    // Worker B completes
    startExecution(contract4);
    recordHeartbeat(contract4, 50);
    recordHeartbeat(contract4, 100);
    submitWork(contract4, 'Result for task 4');
    completeVerification(contract4, true);

    metrics.recordWorkerSuccess('0xWORKER_B');
    metrics.recordContractCompleted();
    metrics.recordVerification('0xVERIFIER_4', true);

    decisionTrace.logDecision(contract4.contract_id, 'CONTRACT_COMPLETED', 'Contract completed after reassignment', {
        worker: '0xWORKER_B'
    });

    logger.info(`${prefix} ✅ Contract completed after reassignment\n`);

    await sleep(1000);

    // Show metrics after stall
    metrics.printSummary();
    healthMonitor.printHealthReport();

    await sleep(1000);

    // ============ Scenario 3: Timeout ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Timeout`);
    logger.info(`${prefix} ========================================\n`);

    const proposal5: Proposal = {
        id: 'PROP-5',
        proposer: '0xUSER',
        objective: 'Task 5 (will timeout)',
        budget: '5',
        deadline: new Date(Date.now() - 1000).toISOString(), // Already expired
        risk_tolerance: 'low',
        status: 'accepted',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    const contract5 = createWorkContract(proposal5, '0xWORKER_5', ['0xVERIFIER_5'], 1);
    contracts.set(contract5.contract_id, contract5);

    metrics.recordContractCreated();
    metrics.recordWorkerAssigned('0xWORKER_5');
    decisionTrace.logDecision(contract5.contract_id, 'CONTRACT_CREATED', 'Contract registered', {
        worker: '0xWORKER_5'
    });

    startExecution(contract5);

    // Timeout immediately
    markTimeout(contract5);
    metrics.recordContractTimeout();
    metrics.recordWorkerFailure('0xWORKER_5', 'TIMEOUT');

    decisionTrace.logDecision(contract5.contract_id, 'CONTRACT_TIMEOUT', 'Deadline exceeded', {
        worker: '0xWORKER_5',
        deadline: contract5.deadline.toISOString()
    });

    logger.error(`${prefix} ❌ Contract timed out\n`);

    await sleep(1000);

    // ============ Final Metrics & Health Check ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} FINAL METRICS`);
    logger.info(`${prefix} ========================================\n`);

    metrics.printSummary();

    await sleep(500);

    healthMonitor.printHealthReport();

    await sleep(500);

    // ============ Decision Traces ============

    logger.info(`${prefix} `);
    decisionTrace.printRecentTraces(15);

    await sleep(500);

    // ============ Observer View ============

    logger.info(`${prefix} `);
    observer.printOverview();

    await sleep(500);

    // ============ Replay Contract ============

    logger.info(`${prefix} `);
    decisionTrace.replayContract(contract4.contract_id);

    await sleep(500);

    // ============ Worker Stats ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} WORKER RELIABILITY`);
    logger.info(`${prefix} ========================================`);

    const workerMetrics = metrics.getAllWorkerMetrics();
    workerMetrics.forEach((stats, worker) => {
        logger.info(`${prefix} ${worker}:`);
        logger.info(`${prefix}   Assigned: ${stats.tasks_assigned}`);
        logger.info(`${prefix}   Completed: ${stats.tasks_completed}`);
        logger.info(`${prefix}   Failed: ${stats.tasks_failed}`);
        logger.info(`${prefix}   Success rate: ${(stats.success_rate * 100).toFixed(1)}%`);
        logger.info(`${prefix}   Stalls: ${stats.stalls}`);
        logger.info(`${prefix}   Crashes: ${stats.crashes}`);
        logger.info(`${prefix} `);
    });

    logger.info(`${prefix} ========================================`);

    logger.info(`${prefix} `);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} `);
    logger.info(`${prefix} Summary:`);
    logger.info(`${prefix}   - 5 contracts created`);
    logger.info(`${prefix}   - 4 completed (3 direct, 1 after reassignment)`);
    logger.info(`${prefix}   - 1 timeout`);
    logger.info(`${prefix}   - 1 stall detected and recovered`);
    logger.info(`${prefix}   - System health: ${healthMonitor.getHealthStatus().healthy ? 'HEALTHY' : 'DEGRADED'}`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runObservabilityDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runObservabilityDemo };
