/**
 * Cost Estimator
 * Deterministic heuristics for work estimation (NO LLMs)
 */

import { Proposal, RiskTolerance } from '../types';
import { AgentRateCard } from './rate-cards';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface CostEstimate {
    estimated_hours: number;
    workers_needed: number;
    verifiers_needed: number;
    worker_cost: number;
    verifier_cost: number;
    total_cost: number;
    breakdown: string[];
}

export interface TeamSize {
    workers: number;
    verifiers: number;
}

/**
 * Estimate hours based on objective keywords (deterministic rules)
 */
export function estimateHours(objective: string): number {
    const lower = objective.toLowerCase();

    // Extract numbers from objective
    const numbers = objective.match(/\d+/g);
    const maxNumber = numbers ? Math.max(...numbers.map(Number)) : 0;

    // Rule-based estimation
    if (lower.includes('verify') || lower.includes('check') || lower.includes('audit')) {
        return 2; // Simple verification
    }

    if (lower.includes('process') || lower.includes('parse')) {
        if (maxNumber < 1000) {
            return 2;
        } else if (maxNumber < 10000) {
            return 6;
        } else {
            return 12;
        }
    }

    if (lower.includes('compute') || lower.includes('calculate')) {
        return 4;
    }

    if (lower.includes('analyze') || lower.includes('research')) {
        return 8;
    }

    if (lower.includes('complex') || lower.includes('advanced')) {
        return 10;
    }

    // Default
    return 4;
}

/**
 * Determine team size based on risk and deadline
 */
export function determineTeamSize(
    riskTolerance: RiskTolerance,
    deadline: Date
): TeamSize {
    const now = new Date();
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    // High risk OR tight deadline → larger team
    if (riskTolerance === 'high' || hoursUntilDeadline < 12) {
        return {
            workers: 2,
            verifiers: 3
        };
    }

    // Medium risk with reasonable deadline
    if (riskTolerance === 'medium' && hoursUntilDeadline >= 12) {
        return {
            workers: 1,
            verifiers: 2
        };
    }

    // Low risk with ample time
    return {
        workers: 1,
        verifiers: 1
    };
}

/**
 * Estimate cost for a proposal
 */
export function estimateCost(
    proposal: Proposal,
    workerRateCards: AgentRateCard[],
    verifierRateCards: AgentRateCard[]
): CostEstimate {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} COST ESTIMATION`);
    logger.info(`${prefix} ========================================`);

    // Parse deadline
    const deadline = new Date(proposal.deadline);

    // Estimate hours
    const hours = estimateHours(proposal.objective);
    logger.info(`${prefix} Estimated hours: ${hours}h`);

    // Determine team size
    const team = determineTeamSize(proposal.risk_tolerance, deadline);
    logger.info(`${prefix} Team size: ${team.workers} worker(s), ${team.verifiers} verifier(s)`);

    // Check if we have enough agents
    if (workerRateCards.length < team.workers) {
        throw new Error(`Insufficient workers: need ${team.workers}, have ${workerRateCards.length}`);
    }

    if (verifierRateCards.length < team.verifiers) {
        throw new Error(`Insufficient verifiers: need ${team.verifiers}, have ${verifierRateCards.length}`);
    }

    // Select cheapest workers
    const selectedWorkers = workerRateCards
        .sort((a, b) => a.effective_rate - b.effective_rate)
        .slice(0, team.workers);

    // Select cheapest verifiers
    const selectedVerifiers = verifierRateCards
        .sort((a, b) => a.verification_fee_per_task - b.verification_fee_per_task)
        .slice(0, team.verifiers);

    // Calculate worker cost
    const workerCost = selectedWorkers.reduce((sum, worker) => {
        const cost = worker.effective_rate * hours;
        return sum + cost;
    }, 0);

    // Calculate verifier cost
    const verifierCost = selectedVerifiers.reduce((sum, verifier) => {
        return sum + verifier.verification_fee_per_task;
    }, 0);

    const totalCost = workerCost + verifierCost;

    // Build breakdown
    const breakdown: string[] = [];

    breakdown.push(`Objective analysis: ${hours}h estimated`);
    breakdown.push(`Team: ${team.workers} worker(s) + ${team.verifiers} verifier(s)`);

    selectedWorkers.forEach((worker, i) => {
        const cost = worker.effective_rate * hours;
        breakdown.push(
            `Worker ${i + 1}: ${worker.effective_rate.toFixed(2)} MON/h × ${hours}h = ${cost.toFixed(2)} MON`
        );
    });

    selectedVerifiers.forEach((verifier, i) => {
        breakdown.push(
            `Verifier ${i + 1}: ${verifier.verification_fee_per_task.toFixed(2)} MON`
        );
    });

    breakdown.push(`Total: ${totalCost.toFixed(2)} MON`);

    logger.info(`${prefix} Worker cost: ${workerCost.toFixed(2)} MON`);
    logger.info(`${prefix} Verifier cost: ${verifierCost.toFixed(2)} MON`);
    logger.info(`${prefix} Total cost: ${totalCost.toFixed(2)} MON`);
    logger.info(`${prefix} ========================================\n`);

    return {
        estimated_hours: hours,
        workers_needed: team.workers,
        verifiers_needed: team.verifiers,
        worker_cost: workerCost,
        verifier_cost: verifierCost,
        total_cost: totalCost,
        breakdown
    };
}
