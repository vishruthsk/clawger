/**
 * Evaluation pipeline
 * Orchestrates proposal evaluation from context assembly to final decision
 */

import {
    Proposal,
    EvaluationContext,
    ClawgerResponse,
    TreasuryState,
    RecentPerformance,
    WorkerAvailability
} from '../types';
import { ClawbotIntegration } from './clawbot-integration';
import { ConstraintEnforcer } from './constraint-enforcer';
import { RejectionLedger } from './rejection-ledger';
import { CounterExpiration } from './counter-expiration';
import { CONSTRAINTS } from '../../config/constraints';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export class EvaluationPipeline {
    private clawbot: ClawbotIntegration;
    private rejectionLedger: RejectionLedger;
    private counterExpiration: CounterExpiration;

    constructor(
        clawbot: ClawbotIntegration,
        rejectionLedger: RejectionLedger,
        counterExpiration: CounterExpiration
    ) {
        this.clawbot = clawbot;
        this.rejectionLedger = rejectionLedger;
        this.counterExpiration = counterExpiration;
    }

    /**
     * Evaluate a proposal and return CLAWGER's decision
     */
    async evaluate(
        proposal: Proposal,
        treasury: TreasuryState,
        recentPerformance: RecentPerformance,
        workerAvailability: WorkerAvailability,
        currentExposure: string
    ): Promise<ClawgerResponse> {
        const prefix = getLogPrefix();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} EVALUATING PROPOSAL ${proposal.id}`);
        logger.info(`${prefix} ========================================`);

        // Step 1: Assemble context
        const context = this.assembleContext(
            proposal,
            treasury,
            recentPerformance,
            workerAvailability,
            currentExposure
        );

        logger.info(`${prefix} Context assembled:`);
        logger.info(`${prefix} - Treasury: ${treasury.available} MON available`);
        logger.info(`${prefix} - Recent success rate: ${(recentPerformance.success_rate * 100).toFixed(1)}%`);
        logger.info(`${prefix} - Workers: ${workerAvailability.trusted} trusted, ${workerAvailability.probation} probation`);

        // Step 2: Get Clawbot's reasoning
        logger.info(`${prefix} Step 2: Calling Clawbot for reasoning...`);
        const clawbotDecision = await this.clawbot.evaluateProposal(context);

        // Step 3: Apply deterministic constraints
        logger.info(`${prefix} Step 3: Applying hard constraints...`);
        const enforcedDecision = ConstraintEnforcer.enforce(clawbotDecision, context);

        if (enforcedDecision.override) {
            logger.warn(`${prefix} CONSTRAINT OVERRIDE: ${enforcedDecision.override_reason}`);
        }

        // Step 4: Generate response
        logger.info(`${prefix} Step 4: Generating response...`);
        const response = this.generateResponse(proposal, enforcedDecision, context);

        // Step 5: Handle side effects
        await this.handleSideEffects(proposal, response);

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} DECISION: ${response.decision}`);
        logger.info(`${prefix} ========================================`);

        return response;
    }

    /**
     * Assemble evaluation context
     */
    private assembleContext(
        proposal: Proposal,
        treasury: TreasuryState,
        recentPerformance: RecentPerformance,
        workerAvailability: WorkerAvailability,
        currentExposure: string
    ): EvaluationContext {
        const treasuryTotal = parseFloat(treasury.total);
        const exposure = parseFloat(currentExposure);
        const exposurePercent = (exposure / treasuryTotal) * 100;

        return {
            proposal,
            treasury,
            recent_performance: recentPerformance,
            worker_availability: workerAvailability,
            current_exposure: currentExposure,
            current_exposure_percent: exposurePercent
        };
    }

    /**
     * Generate CLAWGER response from enforced decision
     */
    private generateResponse(
        proposal: Proposal,
        decision: any,
        context: EvaluationContext
    ): ClawgerResponse {
        const response: ClawgerResponse = {
            proposal_id: proposal.id,
            decision: decision.decision,
            timestamp: new Date().toISOString(),
            reasoning: decision.reasoning,
            risk_assessment: decision.risk_assessment
        };

        if (decision.decision === 'ACCEPT') {
            // Calculate terms
            const budget = parseFloat(proposal.budget);
            const clawgerFee = budget * CONSTRAINTS.CLAWGER_FEE_PERCENT;
            const escrow = budget - clawgerFee;
            const workerBond = escrow * CONSTRAINTS.WORKER_BOND_PERCENT;

            response.terms = {
                escrow: escrow.toFixed(2),
                clawger_fee: clawgerFee.toFixed(2),
                worker_bond: workerBond.toFixed(2),
                expected_completion: proposal.deadline
            };

            // Calculate success probability based on worker availability and recent performance
            const baseProb = context.recent_performance.success_rate;
            const workerBonus = context.worker_availability.trusted > 0 ? 0.1 : 0;
            response.estimated_success_probability = Math.min(0.95, baseProb + workerBonus);

        } else if (decision.decision === 'COUNTER') {
            response.counter_terms = decision.counter_terms;

            // Set expiration
            const expiration = CounterExpiration.calculateExpiration();
            response.counter_expiration = expiration.toISOString();

        } else if (decision.decision === 'REJECT') {
            response.rejection_reason = decision.reasoning[0];

            // Calculate bond distribution
            const bondAmount = parseFloat(CONSTRAINTS.PROPOSAL_BOND);
            const burnAmount = bondAmount * CONSTRAINTS.BOND_BURN_PERCENT;
            const toClawger = bondAmount - burnAmount;

            response.bond_burned = burnAmount.toFixed(2);
            response.bond_to_clawger = toClawger.toFixed(2);
        }

        return response;
    }

    /**
     * Handle side effects based on decision
     */
    private async handleSideEffects(
        proposal: Proposal,
        response: ClawgerResponse
    ): Promise<void> {
        const prefix = getLogPrefix();

        if (response.decision === 'REJECT') {
            // Record in rejection ledger
            this.rejectionLedger.recordRejection({
                proposal_id: proposal.id,
                timestamp: new Date(),
                objective: proposal.objective,
                budget: proposal.budget,
                deadline: proposal.deadline,
                reason: response.rejection_reason!,
                bond_burned: response.bond_burned!,
                bond_to_clawger: response.bond_to_clawger!,
                proposer: proposal.proposer
            });

            logger.info(`${prefix} Rejection recorded in permanent ledger`);

        } else if (response.decision === 'COUNTER') {
            // Start expiration timer
            const expiration = new Date(response.counter_expiration!);
            this.counterExpiration.startTimer(proposal.id, expiration);

            logger.info(`${prefix} Counter-offer expiration timer started`);

        } else if (response.decision === 'ACCEPT') {
            // In production, this would trigger on-chain task creation
            logger.info(`${prefix} Task creation would be triggered on-chain`);
        }
    }
}
