/**
 * Proposal intake system
 * Validates proposals and enforces staking requirements
 */

import { z } from 'zod';
import { Proposal, ProposalSubmission } from '../types';
import { CONSTRAINTS } from '../../config/constraints';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

// ============ Validation Schema ============

const ProposalSchema = z.object({
    objective: z.string().min(10, 'Objective must be at least 10 characters'),
    budget: z.string().refine(
        (val) => {
            const num = parseFloat(val);
            return num >= parseFloat(CONSTRAINTS.MIN_PROPOSAL_BUDGET) &&
                num <= parseFloat(CONSTRAINTS.MAX_PROPOSAL_BUDGET);
        },
        {
            message: `Budget must be between ${CONSTRAINTS.MIN_PROPOSAL_BUDGET} and ${CONSTRAINTS.MAX_PROPOSAL_BUDGET} MON`
        }
    ),
    deadline: z.string(),
    risk_tolerance: z.enum(['low', 'medium', 'high']),
    constraints: z.array(z.string()).optional(),
});

// ============ Proposal Intake ============

export class ProposalIntake {

    /**
     * Validate proposal structure
     */
    static validate(submission: ProposalSubmission): {
        valid: boolean;
        errors?: string[];
    } {
        const result = ProposalSchema.safeParse(submission);

        if (!result.success) {
            const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            return { valid: false, errors };
        }

        // Additional validation
        const additionalErrors: string[] = [];

        // Validate deadline
        const deadlineValidation = this.validateDeadline(submission.deadline);
        if (!deadlineValidation.valid) {
            additionalErrors.push(deadlineValidation.error!);
        }

        if (additionalErrors.length > 0) {
            return { valid: false, errors: additionalErrors };
        }

        return { valid: true };
    }

    /**
     * Validate deadline format and constraints
     */
    private static validateDeadline(deadline: string): {
        valid: boolean;
        error?: string;
    } {
        // Try parsing as ISO timestamp
        const timestamp = new Date(deadline);
        if (!isNaN(timestamp.getTime())) {
            const now = new Date();
            const diffMs = timestamp.getTime() - now.getTime();
            const diffMinutes = diffMs / (1000 * 60);
            const diffHours = diffMinutes / 60;

            if (diffMinutes < CONSTRAINTS.MIN_DEADLINE_MINUTES) {
                return {
                    valid: false,
                    error: `Deadline must be at least ${CONSTRAINTS.MIN_DEADLINE_MINUTES} minutes in the future`
                };
            }

            if (diffHours > CONSTRAINTS.MAX_DEADLINE_HOURS) {
                return {
                    valid: false,
                    error: `Deadline cannot exceed ${CONSTRAINTS.MAX_DEADLINE_HOURS} hours`
                };
            }

            return { valid: true };
        }

        // Try parsing as duration (e.g., "2 hours", "90 minutes")
        const durationMatch = deadline.match(/^(\d+)\s*(hour|hours|minute|minutes|min|mins)$/i);
        if (durationMatch) {
            const value = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();

            const minutes = unit.startsWith('hour') ? value * 60 : value;

            if (minutes < CONSTRAINTS.MIN_DEADLINE_MINUTES) {
                return {
                    valid: false,
                    error: `Deadline must be at least ${CONSTRAINTS.MIN_DEADLINE_MINUTES} minutes`
                };
            }

            const hours = minutes / 60;
            if (hours > CONSTRAINTS.MAX_DEADLINE_HOURS) {
                return {
                    valid: false,
                    error: `Deadline cannot exceed ${CONSTRAINTS.MAX_DEADLINE_HOURS} hours`
                };
            }

            return { valid: true };
        }

        return {
            valid: false,
            error: 'Deadline must be either an ISO timestamp or duration (e.g., "2 hours", "90 minutes")'
        };
    }

    /**
     * Process proposal submission
     * Returns proposal ID if successful
     */
    static async processSubmission(
        submission: ProposalSubmission,
        proposer: string,
        bondTxHash?: string
    ): Promise<{
        success: boolean;
        proposal_id?: string;
        errors?: string[];
    }> {
        const prefix = getLogPrefix();

        // Validate
        const validation = this.validate(submission);
        if (!validation.valid) {
            logger.error(`${prefix} Proposal validation failed:`, validation.errors);
            return {
                success: false,
                errors: validation.errors
            };
        }

        // In production, verify bond transaction on-chain
        // For now, we'll assume it's valid if provided
        if (!bondTxHash) {
            logger.error(`${prefix} No bond transaction provided`);
            return {
                success: false,
                errors: ['Proposal bond required']
            };
        }

        // Generate proposal ID
        const proposalId = this.generateProposalId();

        // Create proposal object
        const proposal: Proposal = {
            id: proposalId,
            proposer,
            objective: submission.objective,
            budget: submission.budget,
            deadline: submission.deadline,
            risk_tolerance: submission.risk_tolerance,
            constraints: submission.constraints,
            status: 'pending',
            bond_amount: CONSTRAINTS.PROPOSAL_BOND,
            submission_time: new Date(),
        };

        logger.info(`${prefix} Proposal ${proposalId} submitted by ${proposer}`);
        logger.info(`${prefix} Objective: ${submission.objective}`);
        logger.info(`${prefix} Budget: ${submission.budget} MON`);
        logger.info(`${prefix} Deadline: ${submission.deadline}`);
        logger.info(`${prefix} Risk tolerance: ${submission.risk_tolerance}`);

        return {
            success: true,
            proposal_id: proposalId
        };
    }

    /**
     * Generate unique proposal ID
     */
    private static generateProposalId(): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `PROP-${timestamp}-${random}`;
    }

    /**
     * Get required bond amount
     */
    static getRequiredBond(): string {
        return CONSTRAINTS.PROPOSAL_BOND;
    }
}
