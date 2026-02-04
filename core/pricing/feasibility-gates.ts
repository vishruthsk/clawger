/**
 * Hard Feasibility Gates
 * Non-negotiable rejection criteria checked BEFORE pricing
 */

import { Proposal, TreasuryState } from '../types';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface FeasibilityCheck {
    gate: string;
    passed: boolean;
    reason?: string;
}

export interface FeasibilityResult {
    allPassed: boolean;
    checks: FeasibilityCheck[];
    failedGates: string[];
}

// Hard limits
const MIN_BUDGET = 1.0;           // MON
const MAX_BUDGET = 1000.0;        // MON
const MIN_DEADLINE_HOURS = 1;     // hours
const MAX_TREASURY_EXPOSURE = 0.60; // 60%

/**
 * Gate 1: Minimum budget floor
 */
function checkMinimumBudget(proposal: Proposal): FeasibilityCheck {
    const budget = parseFloat(proposal.budget);

    if (budget < MIN_BUDGET) {
        return {
            gate: 'Minimum Budget',
            passed: false,
            reason: `Budget ${budget} MON below minimum viable threshold ${MIN_BUDGET} MON`
        };
    }

    return {
        gate: 'Minimum Budget',
        passed: true
    };
}

/**
 * Gate 2: Maximum budget cap
 */
function checkMaximumBudget(proposal: Proposal): FeasibilityCheck {
    const budget = parseFloat(proposal.budget);

    if (budget > MAX_BUDGET) {
        return {
            gate: 'Maximum Budget',
            passed: false,
            reason: `Budget ${budget} MON exceeds maximum contract size ${MAX_BUDGET} MON`
        };
    }

    return {
        gate: 'Maximum Budget',
        passed: true
    };
}

/**
 * Gate 3: Deadline feasibility
 */
function checkDeadline(proposal: Proposal): FeasibilityCheck {
    const deadline = new Date(proposal.deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeadline < MIN_DEADLINE_HOURS) {
        return {
            gate: 'Deadline Feasibility',
            passed: false,
            reason: `Deadline ${hoursUntilDeadline.toFixed(1)}h too aggressive for any execution (min: ${MIN_DEADLINE_HOURS}h)`
        };
    }

    if (deadline <= now) {
        return {
            gate: 'Deadline Feasibility',
            passed: false,
            reason: 'Deadline is in the past'
        };
    }

    return {
        gate: 'Deadline Feasibility',
        passed: true
    };
}

/**
 * Gate 4: Agent capacity
 */
function checkAgentCapacity(
    availableWorkers: number,
    availableVerifiers: number
): FeasibilityCheck {
    if (availableWorkers < 1) {
        return {
            gate: 'Agent Capacity',
            passed: false,
            reason: 'No workers available'
        };
    }

    if (availableVerifiers < 1) {
        return {
            gate: 'Agent Capacity',
            passed: false,
            reason: 'No verifiers available'
        };
    }

    return {
        gate: 'Agent Capacity',
        passed: true
    };
}

/**
 * Gate 5: Treasury exposure
 */
function checkTreasuryExposure(
    currentExposure: string,
    treasury: TreasuryState
): FeasibilityCheck {
    const exposure = parseFloat(currentExposure);
    const total = parseFloat(treasury.total);

    if (total === 0) {
        return {
            gate: 'Treasury Exposure',
            passed: false,
            reason: 'Treasury is empty'
        };
    }

    const exposurePercent = exposure / total;

    if (exposurePercent > MAX_TREASURY_EXPOSURE) {
        return {
            gate: 'Treasury Exposure',
            passed: false,
            reason: `Treasury exposure ${(exposurePercent * 100).toFixed(1)}% exceeds limit ${(MAX_TREASURY_EXPOSURE * 100).toFixed(0)}%`
        };
    }

    return {
        gate: 'Treasury Exposure',
        passed: true
    };
}

/**
 * Run all feasibility gates
 */
export function checkFeasibility(
    proposal: Proposal,
    availableWorkers: number,
    availableVerifiers: number,
    currentExposure: string,
    treasury: TreasuryState
): FeasibilityResult {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} FEASIBILITY GATES`);
    logger.info(`${prefix} ========================================`);

    const checks: FeasibilityCheck[] = [
        checkMinimumBudget(proposal),
        checkMaximumBudget(proposal),
        checkDeadline(proposal),
        checkAgentCapacity(availableWorkers, availableVerifiers),
        checkTreasuryExposure(currentExposure, treasury)
    ];

    const failedGates: string[] = [];

    checks.forEach(check => {
        const status = check.passed ? '✅' : '❌';
        logger.info(`${prefix} ${status} ${check.gate}`);

        if (!check.passed) {
            logger.warn(`${prefix}    Reason: ${check.reason}`);
            failedGates.push(check.gate);
        }
    });

    const allPassed = checks.every(check => check.passed);

    logger.info(`${prefix} `);
    logger.info(`${prefix} Result: ${allPassed ? 'ALL GATES PASSED' : 'GATES FAILED'}`);

    if (!allPassed) {
        logger.warn(`${prefix} Failed gates: ${failedGates.join(', ')}`);
    }

    logger.info(`${prefix} ========================================\n`);

    return {
        allPassed,
        checks,
        failedGates
    };
}

/**
 * Get first failure reason
 */
export function getFirstFailureReason(result: FeasibilityResult): string {
    const failed = result.checks.find(check => !check.passed);
    return failed?.reason || 'Unknown failure';
}

/**
 * Get all failure reasons
 */
export function getAllFailureReasons(result: FeasibilityResult): string[] {
    return result.checks
        .filter(check => !check.passed)
        .map(check => check.reason || 'Unknown');
}
