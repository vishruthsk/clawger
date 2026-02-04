/**
 * Constraint enforcer
 * Applies deterministic hard limits that override AI reasoning
 */

import { ClawbotDecision, EvaluationContext, DecisionType, CounterTerms } from '../types';
import { CONSTRAINTS } from '../../config/constraints';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface EnforcedDecision extends ClawbotDecision {
    override?: boolean;
    override_reason?: string;
}

export class ConstraintEnforcer {

    /**
     * Apply hard constraints to Clawbot's decision
     * Returns final decision with potential overrides
     */
    static enforce(
        clawbotDecision: ClawbotDecision,
        context: EvaluationContext
    ): EnforcedDecision {
        const prefix = getLogPrefix();

        logger.info(`${prefix} Enforcing hard constraints...`);

        // Check each constraint in order of severity

        // 1. Treasury exposure limit
        const exposureCheck = this.checkTreasuryExposure(context);
        if (!exposureCheck.passed) {
            logger.warn(`${prefix} OVERRIDE: ${exposureCheck.reason}`);
            return {
                ...clawbotDecision,
                decision: 'REJECT',
                reasoning: [exposureCheck.reason!, ...clawbotDecision.reasoning],
                override: true,
                override_reason: exposureCheck.reason
            };
        }

        // 2. Minimum margin requirement
        if (clawbotDecision.decision === 'ACCEPT') {
            const marginCheck = this.checkMinimumMargin(clawbotDecision, context);
            if (!marginCheck.passed) {
                logger.warn(`${prefix} OVERRIDE: ${marginCheck.reason}`);

                // Try to counter instead of reject
                const counterTerms = this.calculateCounterForMargin(context);

                return {
                    ...clawbotDecision,
                    decision: 'COUNTER',
                    counter_terms: counterTerms,
                    reasoning: [marginCheck.reason!, ...clawbotDecision.reasoning],
                    override: true,
                    override_reason: marginCheck.reason
                };
            }
        }

        // 3. Recent failure rate threshold
        if (context.proposal.risk_tolerance === 'low') {
            const failureCheck = this.checkFailureRate(context);
            if (!failureCheck.passed && clawbotDecision.decision === 'ACCEPT') {
                logger.warn(`${prefix} OVERRIDE: ${failureCheck.reason}`);

                // Require higher budget for low-risk with high failure rate
                const counterTerms = this.calculateCounterForRisk(context);

                return {
                    ...clawbotDecision,
                    decision: 'COUNTER',
                    counter_terms: counterTerms,
                    reasoning: [failureCheck.reason!, ...clawbotDecision.reasoning],
                    override: true,
                    override_reason: failureCheck.reason
                };
            }
        }

        // 4. Worker availability
        const workerCheck = this.checkWorkerAvailability(context);
        if (!workerCheck.passed) {
            logger.warn(`${prefix} OVERRIDE: ${workerCheck.reason}`);
            return {
                ...clawbotDecision,
                decision: 'REJECT',
                reasoning: [workerCheck.reason!, ...clawbotDecision.reasoning],
                override: true,
                override_reason: workerCheck.reason
            };
        }

        // All constraints passed
        logger.info(`${prefix} All constraints satisfied`);
        return clawbotDecision;
    }

    /**
     * Check treasury exposure limit
     */
    private static checkTreasuryExposure(context: EvaluationContext): {
        passed: boolean;
        reason?: string;
    } {
        const proposalBudget = parseFloat(context.proposal.budget);
        const currentExposure = parseFloat(context.current_exposure);
        const treasuryTotal = parseFloat(context.treasury.total);

        const newExposure = currentExposure + proposalBudget;
        const newExposurePercent = newExposure / treasuryTotal;

        if (newExposurePercent > CONSTRAINTS.MAX_TREASURY_EXPOSURE) {
            return {
                passed: false,
                reason: `Treasury exposure limit exceeded: ${(newExposurePercent * 100).toFixed(1)}% > ${CONSTRAINTS.MAX_TREASURY_EXPOSURE * 100}% maximum`
            };
        }

        return { passed: true };
    }

    /**
     * Check minimum margin requirement
     */
    private static checkMinimumMargin(
        decision: ClawbotDecision,
        context: EvaluationContext
    ): {
        passed: boolean;
        reason?: string;
    } {
        const budget = parseFloat(context.proposal.budget);
        const estimatedCost = parseFloat(decision.estimated_cost);
        const expectedMargin = parseFloat(decision.expected_margin);

        const minMargin = budget * CONSTRAINTS.MIN_MARGIN_PERCENT;

        if (expectedMargin < minMargin) {
            return {
                passed: false,
                reason: `Insufficient margin: ${expectedMargin.toFixed(2)} MON < ${minMargin.toFixed(2)} MON required (${CONSTRAINTS.MIN_MARGIN_PERCENT * 100}%)`
            };
        }

        return { passed: true };
    }

    /**
     * Check recent failure rate
     */
    private static checkFailureRate(context: EvaluationContext): {
        passed: boolean;
        reason?: string;
    } {
        const failureRate = 1 - context.recent_performance.success_rate;

        if (failureRate > CONSTRAINTS.MAX_FAILURE_RATE) {
            return {
                passed: false,
                reason: `Recent failure rate too high for low-risk execution: ${(failureRate * 100).toFixed(1)}% > ${CONSTRAINTS.MAX_FAILURE_RATE * 100}% threshold`
            };
        }

        return { passed: true };
    }

    /**
     * Check worker availability
     */
    private static checkWorkerAvailability(context: EvaluationContext): {
        passed: boolean;
        reason?: string;
    } {
        const totalWorkers = context.worker_availability.total;

        if (totalWorkers < CONSTRAINTS.MIN_AVAILABLE_WORKERS) {
            return {
                passed: false,
                reason: `Insufficient workers available: ${totalWorkers} < ${CONSTRAINTS.MIN_AVAILABLE_WORKERS} required`
            };
        }

        // For low-risk proposals, require at least one trusted worker
        if (context.proposal.risk_tolerance === 'low' && context.worker_availability.trusted === 0) {
            return {
                passed: false,
                reason: 'Low-risk execution requires trusted workers (none available)'
            };
        }

        return { passed: true };
    }

    /**
     * Calculate counter-offer to meet margin requirements
     */
    private static calculateCounterForMargin(context: EvaluationContext): CounterTerms {
        const currentBudget = parseFloat(context.proposal.budget);

        // Increase budget by 20% to ensure margin
        const newBudget = (currentBudget * 1.2).toFixed(2);

        return {
            budget: newBudget,
            deadline: context.proposal.deadline // Keep same deadline
        };
    }

    /**
     * Calculate counter-offer to account for high failure rate
     */
    private static calculateCounterForRisk(context: EvaluationContext): CounterTerms {
        const currentBudget = parseFloat(context.proposal.budget);

        // Increase budget by 30% for risk buffer
        const newBudget = (currentBudget * 1.3).toFixed(2);

        // Also extend deadline by 50% for redundancy
        const deadlineExtension = this.extendDeadline(context.proposal.deadline, 1.5);

        return {
            budget: newBudget,
            deadline: deadlineExtension
        };
    }

    /**
     * Extend deadline by multiplier
     */
    private static extendDeadline(deadline: string, multiplier: number): string {
        // Try parsing as ISO timestamp
        const timestamp = new Date(deadline);
        if (!isNaN(timestamp.getTime())) {
            const now = new Date();
            const diffMs = timestamp.getTime() - now.getTime();
            const newDiffMs = diffMs * multiplier;
            const newTimestamp = new Date(now.getTime() + newDiffMs);
            return newTimestamp.toISOString();
        }

        // Try parsing as duration
        const durationMatch = deadline.match(/^(\d+)\s*(hour|hours|minute|minutes|min|mins)$/i);
        if (durationMatch) {
            const value = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            const newValue = Math.round(value * multiplier);
            return `${newValue} ${unit}`;
        }

        // Fallback: return original
        return deadline;
    }
}
