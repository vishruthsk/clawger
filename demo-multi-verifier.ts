/**
 * Multi-Verifier Demo
 * Demonstrates verifier selection and consensus mechanism
 */

import { AgentRegistry } from './core/registry/agent-registry';
import { VerifierSelector } from './core/execution/verifier-selection';
import { ConsensusEngine } from './core/execution/consensus-engine';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runMultiVerifierDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} MULTI-VERIFIER CONSENSUS DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize components
    const registry = new AgentRegistry(undefined, undefined, true); // Use mock
    const selector = new VerifierSelector(registry);
    const consensus = new ConsensusEngine(registry);

    // ============ Scenario 1: Low Risk (1 Verifier) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Low Risk Task`);
    logger.info(`${prefix} ========================================\n`);

    const task1 = 'TASK-001';
    const selection1 = await selector.selectVerifiers(task1, 'low', '2');

    logger.info(`${prefix} Selected ${selection1.count} verifier(s):`);
    selection1.verifiers.forEach((v, i) => {
        logger.info(`${prefix}   ${i + 1}. ${v}`);
    });
    logger.info(`${prefix} Reasoning:`);
    selection1.reasoning.forEach(r => logger.info(`${prefix}   - ${r}`));
    logger.info('');

    // Initialize verification
    consensus.initializeVerification(task1, selection1.verifiers);

    // Verifier votes PASS
    consensus.submitVote(task1, selection1.verifiers[0], true, 'Work verified successfully');

    logger.info(`${prefix} Consensus: ${consensus.getConsensus(task1) ? 'PASS' : 'FAIL'}\n`);

    await sleep(1000);

    // ============ Scenario 2: Medium Risk (2 Verifiers, Agreement) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Medium Risk Task (Agreement)`);
    logger.info(`${prefix} ========================================\n`);

    const task2 = 'TASK-002';
    const selection2 = await selector.selectVerifiers(task2, 'medium', '5');

    logger.info(`${prefix} Selected ${selection2.count} verifier(s):`);
    selection2.verifiers.forEach((v, i) => {
        logger.info(`${prefix}   ${i + 1}. ${v}`);
    });
    logger.info('');

    consensus.initializeVerification(task2, selection2.verifiers);

    // Both verifiers vote PASS
    consensus.submitVote(task2, selection2.verifiers[0], true, 'Verified');
    consensus.submitVote(task2, selection2.verifiers[1], true, 'Verified');

    logger.info(`${prefix} Consensus: ${consensus.getConsensus(task2) ? 'PASS' : 'FAIL'}\n`);

    await sleep(1000);

    // ============ Scenario 3: Medium Risk (2 Verifiers, Disagreement) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Medium Risk Task (Disagreement)`);
    logger.info(`${prefix} ========================================\n`);

    const task3 = 'TASK-003';
    const selection3 = await selector.selectVerifiers(task3, 'medium', '5');

    consensus.initializeVerification(task3, selection3.verifiers);

    // Verifiers disagree
    consensus.submitVote(task3, selection3.verifiers[0], true, 'Looks good');
    consensus.submitVote(task3, selection3.verifiers[1], false, 'Found issues');

    const result3 = consensus.getVerification(task3);
    logger.info(`${prefix} Consensus: ${result3?.consensus === null ? 'DISAGREEMENT' : (result3?.consensus ? 'PASS' : 'FAIL')}`);
    logger.info(`${prefix} Both verifiers flagged as outliers due to disagreement\n`);

    await sleep(1000);

    // ============ Scenario 4: High Risk (3 Verifiers, 2/3 Majority) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 4: High Risk Task (2/3 Majority)`);
    logger.info(`${prefix} ========================================\n`);

    const task4 = 'TASK-004';
    const selection4 = await selector.selectVerifiers(task4, 'high', '10');

    logger.info(`${prefix} Selected ${selection4.count} verifier(s):`);
    selection4.verifiers.forEach((v, i) => {
        logger.info(`${prefix}   ${i + 1}. ${v}`);
    });
    logger.info('');

    consensus.initializeVerification(task4, selection4.verifiers);

    // 2 PASS, 1 FAIL
    consensus.submitVote(task4, selection4.verifiers[0], true, 'Verified');
    consensus.submitVote(task4, selection4.verifiers[1], true, 'Verified');
    consensus.submitVote(task4, selection4.verifiers[2], false, 'Found discrepancy');

    const result4 = consensus.getVerification(task4);
    logger.info(`${prefix} Consensus: ${result4?.consensus ? 'PASS' : 'FAIL'} (2/3 majority)`);
    logger.info(`${prefix} Outliers: ${result4?.outliers.length}`);
    if (result4?.outliers.length) {
        logger.info(`${prefix}   - ${result4.outliers[0]} (voted against consensus)`);
    }
    logger.info('');

    // Process outcome (update reputations)
    const outcome = await consensus.processOutcome(task4);

    logger.info(`${prefix} Reputation Updates:`);
    outcome.reputationUpdates.forEach(update => {
        const change = update.newRep - update.oldRep;
        const symbol = change > 0 ? '+' : '';
        logger.info(`${prefix}   ${update.agent}: ${update.oldRep} → ${update.newRep} (${symbol}${change})`);
    });
    logger.info('');

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runMultiVerifierDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runMultiVerifierDemo };
