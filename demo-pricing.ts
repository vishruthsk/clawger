/**
 * Pricing System Demo
 * Demonstrates rate-based pricing and bounded negotiation
 */

import { AgentRegistry } from './core/registry/agent-registry';
import { generateRateCards } from './core/pricing/rate-cards';
import { estimateCost } from './core/pricing/cost-estimator';
import { generateQuote, evaluateBudget } from './core/pricing/pricing-engine';
import { checkFeasibility } from './core/pricing/feasibility-gates';
import { initializeNegotiation, processInitialBudget } from './core/pricing/negotiation-fsm';
import { Proposal, TreasuryState } from './core/types';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runPricingDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PRICING SYSTEM DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize components
    const registry = new AgentRegistry(undefined, undefined, true);

    // Mock treasury
    const treasury: TreasuryState = {
        total: '100',
        allocated: '20',
        available: '80'
    };

    // ============ Scenario 1: Underpayment → Reject ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Underpayment → Reject`);
    logger.info(`${prefix} ========================================\n`);

    const proposal1: Proposal = {
        id: 'PROP-001',
        proposer: '0xUSER1',
        objective: 'Process 5000 data entries for duplicates',
        budget: '1',
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
        risk_tolerance: 'medium',
        status: 'pending',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    await evaluateProposal(proposal1, registry, treasury, '20');

    await sleep(1000);

    // ============ Scenario 2: Reasonable Budget → Accept ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Reasonable Budget → Accept`);
    logger.info(`${prefix} ========================================\n`);

    const proposal2: Proposal = {
        id: 'PROP-002',
        proposer: '0xUSER2',
        objective: 'Verify 100 records for accuracy',
        budget: '3',
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        risk_tolerance: 'low',
        status: 'pending',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    await evaluateProposal(proposal2, registry, treasury, '20');

    await sleep(1000);

    // ============ Scenario 3: Close to Min → Counter ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Close to Min → Counter`);
    logger.info(`${prefix} ========================================\n`);

    const proposal3: Proposal = {
        id: 'PROP-003',
        proposer: '0xUSER3',
        objective: 'Analyze complex dataset',
        budget: '4',
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // 12 hours
        risk_tolerance: 'medium',
        status: 'pending',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    await evaluateProposal(proposal3, registry, treasury, '20');

    await sleep(1000);

    // ============ Scenario 4: Feasibility Gate Failure ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 4: Feasibility Gate Failure`);
    logger.info(`${prefix} ========================================\n`);

    const proposal4: Proposal = {
        id: 'PROP-004',
        proposer: '0xUSER4',
        objective: 'Emergency task',
        budget: '0.5', // Below minimum
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        risk_tolerance: 'low',
        status: 'pending',
        bond_amount: '0.1',
        submission_time: new Date()
    };

    await evaluateProposal(proposal4, registry, treasury, '20');

    await sleep(1000);

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

async function evaluateProposal(
    proposal: Proposal,
    registry: AgentRegistry,
    treasury: TreasuryState,
    currentExposure: string
): Promise<void> {
    const prefix = getLogPrefix();

    logger.info(`${prefix} Proposal: ${proposal.id}`);
    logger.info(`${prefix} Objective: ${proposal.objective}`);
    logger.info(`${prefix} Budget: ${proposal.budget} MON`);
    logger.info(`${prefix} Deadline: ${proposal.deadline}`);
    logger.info(`${prefix} Risk: ${proposal.risk_tolerance}\n`);

    // Get available agents
    const workers = await registry.queryWorkers(0);
    const verifiers = await registry.queryVerifiers(0);

    // Check feasibility gates
    const feasibility = checkFeasibility(
        proposal,
        workers.length,
        verifiers.length,
        currentExposure,
        treasury
    );

    if (!feasibility.allPassed) {
        logger.error(`${prefix} ❌ REJECTED: Feasibility gate failure`);
        logger.error(`${prefix} Failed gates: ${feasibility.failedGates.join(', ')}\n`);
        return;
    }

    // Generate rate cards
    const deadline = new Date(proposal.deadline);
    const workerRateCards = workers.map(w =>
        require('./core/pricing/rate-cards').generateRateCard(w, deadline)
    );
    const verifierRateCards = verifiers.map(v =>
        require('./core/pricing/rate-cards').generateRateCard(v, deadline)
    );

    // Estimate cost
    const estimate = estimateCost(proposal, workerRateCards, verifierRateCards);

    // Generate quote
    const quote = generateQuote(estimate);

    // Initialize negotiation
    const userBudget = parseFloat(proposal.budget);
    const negotiation = initializeNegotiation(
        proposal.id,
        quote.quoted_price,
        quote.min_acceptable,
        quote.max_acceptable,
        userBudget
    );

    // Process budget
    const decision = processInitialBudget(negotiation);

    // Log final decision
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} FINAL DECISION: ${decision.decision}`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Reason: ${decision.reason}`);

    if (decision.decision === 'COUNTER' && decision.counter_amount) {
        logger.info(`${prefix} Counter offer: ${decision.counter_amount.toFixed(2)} MON`);
        logger.info(`${prefix} User has 10 minutes to accept`);
    }

    if (decision.decision === 'ACCEPT') {
        logger.info(`${prefix} ✅ Task will be created with ${userBudget.toFixed(2)} MON escrow`);
    }

    if (decision.decision === 'REJECT') {
        logger.info(`${prefix} ❌ Proposal permanently rejected`);
        logger.info(`${prefix} Bond: 50% burned, 50% to CLAWGER`);
    }

    logger.info(`${prefix} ========================================\n`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runPricingDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runPricingDemo };
