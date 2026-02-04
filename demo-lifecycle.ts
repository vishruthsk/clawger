/**
 * Contract Lifecycle Demo
 * Demonstrates full contract lifecycle from PROPOSED to COMPLETED
 */

import { createHumanIdentity } from './core/identity/identity';
import { publicAPI } from './core/api/public-api';
import { eventBus } from './core/api/event-bus';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runLifecycleDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} CONTRACT LIFECYCLE DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // ============ Setup ============

    const alice = createHumanIdentity('0xALICE', 'Alice', true);

    // Subscribe to all events
    const subscription = publicAPI.subscribeToEvents((event) => {
        logger.info(`${prefix} [EVENT RECEIVED] ${event.event_type}: ${event.contract_id}`);
    });

    await sleep(500);

    // ============ Step 1: Submit Proposal ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 1: Submit Proposal`);
    logger.info(`${prefix} ========================================\n`);

    const contract = await publicAPI.submitProposal(alice, {
        objective: "Analyze market data and generate report",
        budget: "100",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 hours
    });

    logger.info(`${prefix} State: ${contract.state}`);
    logger.info(`${prefix} Expected: PROPOSED\n`);

    await sleep(500);

    // ============ Step 2: Pricing Complete ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 2: Pricing Complete`);
    logger.info(`${prefix} ========================================\n`);

    await publicAPI.transitionState(
        contract.contract_id,
        'PRICED',
        'PRICED',
        { price: "95", worker_count: 3 }
    );

    const contract2 = await publicAPI.getContract(contract.contract_id);
    logger.info(`${prefix} State: ${contract2?.state}`);
    logger.info(`${prefix} Expected: PRICED\n`);

    await sleep(500);

    // ============ Step 3: Proposer Accepts ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 3: Proposer Accepts`);
    logger.info(`${prefix} ========================================\n`);

    await publicAPI.transitionState(
        contract.contract_id,
        'ACCEPTED',
        'ACCEPTED',
        { accepted_by: alice.wallet_address }
    );

    const contract3 = await publicAPI.getContract(contract.contract_id);
    logger.info(`${prefix} State: ${contract3?.state}`);
    logger.info(`${prefix} Expected: ACCEPTED\n`);

    await sleep(500);

    // ============ Step 4: Execution Started ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 4: Execution Started`);
    logger.info(`${prefix} ========================================\n`);

    await publicAPI.transitionState(
        contract.contract_id,
        'EXECUTING',
        'EXECUTION_STARTED',
        { worker: 'AGENT_WORKER_001' }
    );

    const contract4 = await publicAPI.getContract(contract.contract_id);
    logger.info(`${prefix} State: ${contract4?.state}`);
    logger.info(`${prefix} Expected: EXECUTING\n`);

    await sleep(500);

    // ============ Step 5: Work Submitted ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 5: Work Submitted`);
    logger.info(`${prefix} ========================================\n`);

    await publicAPI.transitionState(
        contract.contract_id,
        'VERIFYING',
        'WORK_SUBMITTED',
        { worker: 'AGENT_WORKER_001', result: 'Market analysis complete' }
    );

    const contract5 = await publicAPI.getContract(contract.contract_id);
    logger.info(`${prefix} State: ${contract5?.state}`);
    logger.info(`${prefix} Expected: VERIFYING\n`);

    await sleep(500);

    // ============ Step 6: Verification Complete ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STEP 6: Verification Complete`);
    logger.info(`${prefix} ========================================\n`);

    await publicAPI.transitionState(
        contract.contract_id,
        'COMPLETED',
        'COMPLETED',
        { verifiers: ['V1', 'V2', 'V3'], consensus: 'PASS', payment: '95 MON' }
    );

    const contract6 = await publicAPI.getContract(contract.contract_id);
    logger.info(`${prefix} State: ${contract6?.state}`);
    logger.info(`${prefix} Expected: COMPLETED\n`);

    await sleep(500);

    // ============ Contract History ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} CONTRACT HISTORY`);
    logger.info(`${prefix} ========================================\n`);

    const history = await publicAPI.getContractHistory(contract.contract_id);

    logger.info(`${prefix} Total events: ${history.length}`);
    for (const event of history) {
        logger.info(`${prefix}   ${event.event_type}: ${event.from_state} → ${event.to_state}`);
    }
    logger.info('');

    await sleep(500);

    // ============ Test Invalid Transition ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} TEST: Invalid Transition`);
    logger.info(`${prefix} ========================================\n`);

    try {
        await publicAPI.transitionState(
            contract.contract_id,
            'EXECUTING',  // Try to go back from COMPLETED
            'EXECUTION_STARTED',
            {}
        );
        logger.error(`${prefix} ❌ Should have thrown error!\n`);
    } catch (error) {
        logger.info(`${prefix} ✅ Invalid transition rejected: ${(error as Error).message}\n`);
    }

    await sleep(500);

    // ============ List Contracts ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} LIST CONTRACTS`);
    logger.info(`${prefix} ========================================\n`);

    const allContracts = await publicAPI.listContracts();
    logger.info(`${prefix} Total contracts: ${allContracts.length}`);

    const completedContracts = await publicAPI.listContracts({ state: ['COMPLETED'] });
    logger.info(`${prefix} Completed contracts: ${completedContracts.length}\n`);

    await sleep(500);

    // ============ Statistics ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} STATISTICS`);
    logger.info(`${prefix} ========================================\n`);

    const apiStats = publicAPI.getStats();
    logger.info(`${prefix} Total contracts: ${apiStats.total_contracts}`);
    logger.info(`${prefix} Total events: ${apiStats.total_events}`);
    logger.info(`${prefix} By state:`);
    for (const [state, count] of Object.entries(apiStats.by_state)) {
        logger.info(`${prefix}   ${state}: ${count}`);
    }
    logger.info('');

    const eventStats = eventBus.getStats();
    logger.info(`${prefix} Events by type:`);
    for (const [type, count] of Object.entries(eventStats.by_type)) {
        logger.info(`${prefix}   ${type}: ${count}`);
    }
    logger.info('');

    // ============ Cleanup ============

    subscription.unsubscribe();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} `);
    logger.info(`${prefix} Summary:`);
    logger.info(`${prefix}   - Contract lifecycle: PROPOSED → PRICED → ACCEPTED → EXECUTING → VERIFYING → COMPLETED`);
    logger.info(`${prefix}   - Total events: ${history.length}`);
    logger.info(`${prefix}   - Invalid transitions rejected`);
    logger.info(`${prefix}   - Event subscriptions working`);
    logger.info(`${prefix}   - Deterministic state machine`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runLifecycleDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runLifecycleDemo };
