/**
 * Verifier Consensus Demo
 * Demonstrates deterministic consensus logic with PASS, FAIL, and DISPUTE scenarios
 */

import { VerifierConsensus, VerifierSubmission } from './core/verification/verifier-consensus';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runConsensusDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} VERIFIER CONSENSUS DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Helper to create submissions
    const createSub = (id: string, verdict: 'PASS' | 'FAIL'): VerifierSubmission => ({
        verifier_id: id,
        verdict,
        reason: `I vote ${verdict}`,
        timestamp: new Date()
    });

    // ============ Scenario 1: Unanimous PASS ============
    logger.info(`${prefix} --- SCENARIO 1: Unanimous PASS ---`);
    const sub1 = [
        createSub('V1', 'PASS'),
        createSub('V2', 'PASS'),
        createSub('V3', 'PASS')
    ];
    VerifierConsensus.evaluate(sub1);
    await sleep(500);

    // ============ Scenario 2: Unanimous FAIL ============
    logger.info(`${prefix} --- SCENARIO 2: Unanimous FAIL ---`);
    const sub2 = [
        createSub('V1', 'FAIL'),
        createSub('V2', 'FAIL'),
        createSub('V3', 'FAIL')
    ];
    VerifierConsensus.evaluate(sub2);
    await sleep(500);

    // ============ Scenario 3: Split Vote (Majority PASS) ============
    logger.info(`${prefix} --- SCENARIO 3: Split Vote (Majority PASS) ---`);
    const sub3 = [
        createSub('V1', 'PASS'),
        createSub('V2', 'PASS'),
        createSub('V3', 'FAIL') // Dissenter
    ];
    VerifierConsensus.evaluate(sub3);
    await sleep(500);

    // ============ Scenario 4: Split Vote (Majority FAIL) ============
    logger.info(`${prefix} --- SCENARIO 4: Split Vote (Majority FAIL) ---`);
    const sub4 = [
        createSub('V1', 'PASS'), // Dissenter
        createSub('V2', 'FAIL'),
        createSub('V3', 'FAIL')
    ];
    VerifierConsensus.evaluate(sub4);
    await sleep(500);

    // ============ Scenario 5: Tie (Defaults to FAIL) ============
    logger.info(`${prefix} --- SCENARIO 5: Tie (Defaults to FAIL) ---`);
    const sub5 = [
        createSub('V1', 'PASS'),
        createSub('V2', 'FAIL')
    ];
    VerifierConsensus.evaluate(sub5);
    await sleep(500);

    // ============ Scenario 6: Single Verifier ============
    logger.info(`${prefix} --- SCENARIO 6: Single Verifier PASS ---`);
    const sub6 = [
        createSub('V1', 'PASS')
    ];
    VerifierConsensus.evaluate(sub6);

    logger.info(`${prefix} --- SCENARIO 7: Single Verifier FAIL ---`);
    const sub7 = [
        createSub('V1', 'FAIL')
    ];
    VerifierConsensus.evaluate(sub7);

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runConsensusDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runConsensusDemo };
