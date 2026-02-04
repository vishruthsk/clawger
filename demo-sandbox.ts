/**
 * Sandbox Runtime Demo
 * Demonstrates execution payload, result envelope, and sandbox enforcement
 */

import { createExecutionPayload, validatePayload } from './core/execution/execution-payload';
import { createResultEnvelope, validateResultEnvelope } from './core/execution/result-envelope';
import { SandboxRuntime } from './core/execution/sandbox-runtime';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runSandboxDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SANDBOX RUNTIME DEMO`);
    logger.info(`${prefix} ========================================\n`);

    const sandbox = new SandboxRuntime('LOCAL');

    await sleep(500);

    // ============ Scenario 1: Normal Execution → SUCCESS ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Normal Execution → SUCCESS`);
    logger.info(`${prefix} ========================================\n`);

    const payload1 = createExecutionPayload(
        'CONTRACT-001',
        'Sum the numbers [1, 2, 3, 4, 5]',
        '{ sum: number }',
        { max_runtime_seconds: 10, max_cpu_seconds: 5 }
    );

    validatePayload(payload1);

    await sleep(500);

    // Simulate worker execution
    const result1 = await sandbox.monitorExecution(
        'WORKER-001',
        payload1,
        async () => {
            // Simulate work
            await sleep(1000);

            return createResultEnvelope(
                payload1.payload_id,
                'WORKER-001',
                'SUCCESS',
                { sum: 15 },
                ['Started computation', 'Summed 5 numbers', 'Completed'],
                { runtime_seconds: 1, cpu_seconds: 0.5, memory_used_mb: 50 }
            );
        }
    );

    logger.info(`${prefix} ✅ Execution completed successfully`);
    logger.info(`${prefix} Output: ${JSON.stringify(result1.output)}\n`);

    await sleep(500);

    // ============ Scenario 2: Worker Exceeds Runtime → TIMEOUT ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Worker Exceeds Runtime → TIMEOUT`);
    logger.info(`${prefix} ========================================\n`);

    const payload2 = createExecutionPayload(
        'CONTRACT-002',
        'Run infinite loop',
        '{ result: any }',
        { max_runtime_seconds: 2, max_cpu_seconds: 1 }
    );

    await sleep(500);

    try {
        await sandbox.monitorExecution(
            'WORKER-002',
            payload2,
            async () => {
                // Simulate long-running task
                await sleep(5000);  // 5 seconds (exceeds 2s limit)

                return createResultEnvelope(
                    payload2.payload_id,
                    'WORKER-002',
                    'SUCCESS',
                    { result: 'never reached' },
                    [],
                    { runtime_seconds: 5, cpu_seconds: 3, memory_used_mb: 100 }
                );
            }
        );

        logger.error(`${prefix} ❌ Should have timed out!\n`);

    } catch (error) {
        logger.info(`${prefix} ✅ Timeout enforced correctly\n`);
    }

    await sleep(500);

    // ============ Scenario 3: Malformed Output → FAIL + SLASH ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Malformed Output → FAIL + SLASH`);
    logger.info(`${prefix} ========================================\n`);

    const payload3 = createExecutionPayload(
        'CONTRACT-003',
        'Return structured data',
        '{ mean: number, median: number }',
        { max_runtime_seconds: 10, max_output_size_kb: 1 }  // Very small output limit
    );

    await sleep(500);

    try {
        await sandbox.monitorExecution(
            'WORKER-003',
            payload3,
            async () => {
                await sleep(500);

                // Create output that's too large
                const largeOutput = {
                    data: 'x'.repeat(2000)  // 2KB > 1KB limit
                };

                return createResultEnvelope(
                    payload3.payload_id,
                    'WORKER-003',
                    'SUCCESS',
                    largeOutput,
                    [],
                    { runtime_seconds: 0.5, cpu_seconds: 0.2, memory_used_mb: 30 }
                );
            }
        );

        logger.error(`${prefix} ❌ Should have rejected large output!\n`);

    } catch (error) {
        logger.info(`${prefix} ✅ Malformed output rejected and worker penalized\n`);
    }

    await sleep(500);

    // ============ Scenario 4: Invalid Proof of Work → FAIL ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 4: Invalid Proof of Work → FAIL`);
    logger.info(`${prefix} ========================================\n`);

    const payload4 = createExecutionPayload(
        'CONTRACT-004',
        'Calculate factorial of 5',
        '{ factorial: number }',
        { max_runtime_seconds: 10 }
    );

    await sleep(500);

    try {
        await sandbox.monitorExecution(
            'WORKER-004',
            payload4,
            async () => {
                await sleep(500);

                const result = createResultEnvelope(
                    payload4.payload_id,
                    'WORKER-004',
                    'SUCCESS',
                    { factorial: 120 },
                    ['Calculated factorial'],
                    { runtime_seconds: 0.5, cpu_seconds: 0.2, memory_used_mb: 40 }
                );

                // Tamper with proof of work
                result.proof_of_work = 'invalid_hash';

                return result;
            }
        );

        logger.error(`${prefix} ❌ Should have rejected invalid proof of work!\n`);

    } catch (error) {
        logger.info(`${prefix} ✅ Invalid proof of work detected and rejected\n`);
    }

    await sleep(500);

    // ============ Scenario 5: Network Access Violation ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 5: Network Access Violation`);
    logger.info(`${prefix} ========================================\n`);

    const payload5 = createExecutionPayload(
        'CONTRACT-005',
        'Process data locally',
        '{ result: any }',
        { max_runtime_seconds: 10 },
        { network_allowed: false }  // Network blocked
    );

    await sleep(500);

    try {
        // Worker tries to access network
        sandbox.checkNetworkAccess(payload5);
        logger.error(`${prefix} ❌ Should have blocked network access!\n`);

    } catch (error) {
        logger.info(`${prefix} ✅ Network access blocked\n`);
    }

    await sleep(500);

    // ============ Scenario 6: Successful Execution with Logs ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 6: Successful Execution with Logs`);
    logger.info(`${prefix} ========================================\n`);

    const payload6 = createExecutionPayload(
        'CONTRACT-006',
        'Analyze array statistics',
        '{ mean: number, median: number, stddev: number }',
        { max_runtime_seconds: 10 }
    );

    await sleep(500);

    const result6 = await sandbox.monitorExecution(
        'WORKER-006',
        payload6,
        async () => {
            await sleep(800);

            return createResultEnvelope(
                payload6.payload_id,
                'WORKER-006',
                'SUCCESS',
                { mean: 42.5, median: 40, stddev: 12.3 },
                [
                    'Started analysis',
                    'Loaded data: 100 points',
                    'Calculated mean: 42.5',
                    'Calculated median: 40',
                    'Calculated stddev: 12.3',
                    'Analysis complete'
                ],
                { runtime_seconds: 0.8, cpu_seconds: 0.4, memory_used_mb: 80 }
            );
        }
    );

    logger.info(`${prefix} ✅ Execution completed with detailed logs`);
    logger.info(`${prefix} Output: ${JSON.stringify(result6.output)}`);
    logger.info(`${prefix} Logs: ${result6.logs.length} lines\n`);

    await sleep(500);

    // ============ Statistics ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} VIOLATION STATISTICS`);
    logger.info(`${prefix} ========================================\n`);

    const stats = sandbox.getViolationStats();
    logger.info(`${prefix} Total violations: ${stats.total}`);
    logger.info(`${prefix} By type:`);
    for (const [type, count] of Object.entries(stats.by_type)) {
        logger.info(`${prefix}   ${type}: ${count}`);
    }
    logger.info(`${prefix} By worker:`);
    for (const [worker, count] of Object.entries(stats.by_worker)) {
        logger.info(`${prefix}   ${worker}: ${count}`);
    }
    logger.info('');

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} `);
    logger.info(`${prefix} Summary:`);
    logger.info(`${prefix}   - Normal execution: SUCCESS ✅`);
    logger.info(`${prefix}   - Runtime exceeded: TIMEOUT ✅`);
    logger.info(`${prefix}   - Output too large: REJECTED ✅`);
    logger.info(`${prefix}   - Invalid proof of work: REJECTED ✅`);
    logger.info(`${prefix}   - Network violation: BLOCKED ✅`);
    logger.info(`${prefix}   - Detailed logging: WORKING ✅`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runSandboxDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runSandboxDemo };
