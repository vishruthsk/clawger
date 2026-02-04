/**
 * CLAWGER Demo Script
 * Demonstrates the negotiation flow with example proposals
 */

import { StateManager } from './core/memory/state-manager';
import { ClawbotIntegration } from './core/negotiation/clawbot-integration';
import { RejectionLedger } from './core/negotiation/rejection-ledger';
import { CounterExpiration } from './core/negotiation/counter-expiration';
import { EvaluationPipeline } from './core/negotiation/evaluation-pipeline';
import { ProposalIntake } from './core/negotiation/proposal-intake';
import { ProposalSubmission, RecentPerformance, WorkerAvailability } from './core/types';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} CLAWGER NEGOTIATION DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // Initialize components
    const stateManager = new StateManager();
    const clawbot = new ClawbotIntegration();
    const rejectionLedger = new RejectionLedger();
    const counterExpiration = new CounterExpiration();
    const pipeline = new EvaluationPipeline(clawbot, rejectionLedger, counterExpiration);

    // Setup counter-offer expiration handler
    counterExpiration.onExpiration((proposalId) => {
        logger.info(`${prefix} ⏰ Counter-offer ${proposalId} expired`);
    });

    // Get current state
    const treasury = stateManager.getTreasury();

    logger.info(`${prefix} Current Treasury State:`);
    logger.info(`${prefix} - Total: ${treasury.total} MON`);
    logger.info(`${prefix} - Available: ${treasury.available} MON`);
    logger.info(`${prefix} - Allocated: ${treasury.allocated} MON\n`);

    // Mock recent performance (good performance)
    const recentPerformance: RecentPerformance = {
        total_tasks: 10,
        successful: 8,
        failed: 2,
        success_rate: 0.8,
        total_profit: '5.5',
        total_loss: '1.2',
        net_pnl: '4.3'
    };

    // Mock worker availability
    const workerAvailability: WorkerAvailability = {
        trusted: 2,
        probation: 1,
        total: 3,
        avg_success_rate: 0.85
    };

    logger.info(`${prefix} Recent Performance:`);
    logger.info(`${prefix} - Success Rate: ${(recentPerformance.success_rate * 100).toFixed(1)}%`);
    logger.info(`${prefix} - Net P&L: ${recentPerformance.net_pnl} MON\n`);

    logger.info(`${prefix} Worker Availability:`);
    logger.info(`${prefix} - Trusted: ${workerAvailability.trusted}`);
    logger.info(`${prefix} - Probation: ${workerAvailability.probation}\n`);

    // ============ Scenario 1: Reasonable Proposal (Should ACCEPT) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Reasonable Proposal`);
    logger.info(`${prefix} ========================================\n`);

    const proposal1: ProposalSubmission = {
        objective: 'Verify 1000 data entries for duplicates and inconsistencies',
        budget: '5',
        deadline: '2 hours',
        risk_tolerance: 'medium',
        constraints: ['Deterministic output', 'Independent verification required']
    };

    logger.info(`${prefix} Submitting proposal...`);
    logger.info(`${prefix} Objective: ${proposal1.objective}`);
    logger.info(`${prefix} Budget: ${proposal1.budget} MON`);
    logger.info(`${prefix} Deadline: ${proposal1.deadline}`);
    logger.info(`${prefix} Risk: ${proposal1.risk_tolerance}\n`);

    const intake1 = await ProposalIntake.processSubmission(
        proposal1,
        '0x1234567890abcdef',
        'mock-tx-hash-1'
    );

    if (intake1.success) {
        const proposal = {
            id: intake1.proposal_id!,
            proposer: '0x1234567890abcdef',
            ...proposal1,
            status: 'pending' as const,
            bond_amount: '0.1',
            submission_time: new Date()
        };

        stateManager.upsertProposal(proposal);

        const response1 = await pipeline.evaluate(
            proposal,
            treasury,
            recentPerformance,
            workerAvailability,
            '10' // Current exposure
        );

        logger.info(`${prefix}\n📋 CLAWGER RESPONSE:`);
        logger.info(JSON.stringify(response1, null, 2));
        logger.info('');
    }

    // Wait a bit
    await sleep(2000);

    // ============ Scenario 2: Aggressive Proposal (Should COUNTER) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: Aggressive Proposal`);
    logger.info(`${prefix} ========================================\n`);

    const proposal2: ProposalSubmission = {
        objective: 'Process real-time market data for 24 hours continuously',
        budget: '3',
        deadline: '24 hours',
        risk_tolerance: 'low',
        constraints: ['99.9% uptime required', 'Real-time processing']
    };

    logger.info(`${prefix} Submitting proposal...`);
    logger.info(`${prefix} Objective: ${proposal2.objective}`);
    logger.info(`${prefix} Budget: ${proposal2.budget} MON`);
    logger.info(`${prefix} Deadline: ${proposal2.deadline}`);
    logger.info(`${prefix} Risk: ${proposal2.risk_tolerance}\n`);

    const intake2 = await ProposalIntake.processSubmission(
        proposal2,
        '0xabcdef1234567890',
        'mock-tx-hash-2'
    );

    if (intake2.success) {
        const proposal = {
            id: intake2.proposal_id!,
            proposer: '0xabcdef1234567890',
            ...proposal2,
            status: 'pending' as const,
            bond_amount: '0.1',
            submission_time: new Date()
        };

        stateManager.upsertProposal(proposal);

        const response2 = await pipeline.evaluate(
            proposal,
            treasury,
            recentPerformance,
            workerAvailability,
            '10'
        );

        logger.info(`${prefix}\n📋 CLAWGER RESPONSE:`);
        logger.info(JSON.stringify(response2, null, 2));
        logger.info('');
    }

    // Wait a bit
    await sleep(2000);

    // ============ Scenario 3: Unreasonable Proposal (Should REJECT) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Unreasonable Proposal`);
    logger.info(`${prefix} ========================================\n`);

    const proposal3: ProposalSubmission = {
        objective: 'Execute 10,000 blockchain transactions in 5 minutes',
        budget: '1',
        deadline: '5 minutes',
        risk_tolerance: 'low',
        constraints: ['All transactions must succeed', 'No failures allowed']
    };

    logger.info(`${prefix} Submitting proposal...`);
    logger.info(`${prefix} Objective: ${proposal3.objective}`);
    logger.info(`${prefix} Budget: ${proposal3.budget} MON`);
    logger.info(`${prefix} Deadline: ${proposal3.deadline}`);
    logger.info(`${prefix} Risk: ${proposal3.risk_tolerance}\n`);

    const intake3 = await ProposalIntake.processSubmission(
        proposal3,
        '0xfedcba0987654321',
        'mock-tx-hash-3'
    );

    if (intake3.success) {
        const proposal = {
            id: intake3.proposal_id!,
            proposer: '0xfedcba0987654321',
            ...proposal3,
            status: 'pending' as const,
            bond_amount: '0.1',
            submission_time: new Date()
        };

        stateManager.upsertProposal(proposal);

        const response3 = await pipeline.evaluate(
            proposal,
            treasury,
            recentPerformance,
            workerAvailability,
            '10'
        );

        logger.info(`${prefix}\n📋 CLAWGER RESPONSE:`);
        logger.info(JSON.stringify(response3, null, 2));
        logger.info('');
    }

    // ============ Show Rejection Ledger ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} REJECTION LEDGER`);
    logger.info(`${prefix} ========================================\n`);

    const rejections = rejectionLedger.getAllRejections();

    if (rejections.length > 0) {
        logger.info(`${prefix} Total Rejections: ${rejections.length}\n`);

        rejections.forEach((rejection, i) => {
            logger.info(`${prefix} ${i + 1}. ${rejection.proposal_id}`);
            logger.info(`${prefix}    Objective: ${rejection.objective.substring(0, 50)}...`);
            logger.info(`${prefix}    Budget: ${rejection.budget} MON`);
            logger.info(`${prefix}    Reason: ${rejection.reason}`);
            logger.info(`${prefix}    Bond Burned: ${rejection.bond_burned} MON`);
            logger.info(`${prefix}    Timestamp: ${rejection.timestamp.toISOString()}\n`);
        });

        const stats = rejectionLedger.getStatistics();
        logger.info(`${prefix} Statistics:`);
        logger.info(`${prefix} - Total Bonds Burned: ${stats.total_bonds_burned} MON`);
        logger.info(`${prefix} - Total to CLAWGER: ${stats.total_bonds_to_clawger} MON`);
        logger.info(`${prefix} - Unique Proposers: ${stats.unique_proposers}\n`);
    } else {
        logger.info(`${prefix} No rejections recorded yet.\n`);
    }

    // Cleanup
    counterExpiration.clearAll();
    stateManager.close();
    rejectionLedger.close();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runDemo };
