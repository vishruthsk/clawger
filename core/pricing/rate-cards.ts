/**
 * Agent Rate Cards
 * Deterministic pricing based on agent reputation and urgency
 */

import { RegisteredAgent } from '../types';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface AgentRateCard {
    agent: string;
    base_rate_per_hour: number;      // MON/hour
    verification_fee_per_task: number; // MON flat fee
    reliability_multiplier: number;   // 0.8 - 1.5 (from reputation)
    urgency_multiplier: number;       // 1.0 - 2.0 (tight deadlines)
    effective_rate: number;           // base * reliability * urgency
}

// Base rates (before multipliers)
const BASE_WORKER_RATE = 2.0;      // MON/hour
const BASE_VERIFIER_RATE = 0.5;    // MON/hour
const VERIFIER_FLAT_FEE = 0.3;     // MON per task

/**
 * Calculate reliability multiplier from reputation
 * High reputation = discount (trusted)
 * Low reputation = premium (risky)
 */
export function getReliabilityMultiplier(reputation: number): number {
    if (reputation >= 80) {
        return 0.8;  // 20% discount for highly trusted agents
    } else if (reputation >= 50) {
        return 1.0;  // Baseline for average agents
    } else {
        return 1.5;  // 50% premium for risky agents
    }
}

/**
 * Calculate urgency multiplier from deadline
 * Tight deadlines = premium
 */
export function getUrgencyMultiplier(deadline: Date): number {
    const now = new Date();
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeadline < 6) {
        return 2.0;  // Emergency (< 6 hours)
    } else if (hoursUntilDeadline < 24) {
        return 1.3;  // Rush (6-24 hours)
    } else {
        return 1.0;  // Normal (> 24 hours)
    }
}

/**
 * Generate rate card for an agent
 */
export function generateRateCard(
    agent: RegisteredAgent,
    deadline: Date
): AgentRateCard {
    const prefix = getLogPrefix();

    const baseRate = agent.type === 'worker' ? BASE_WORKER_RATE : BASE_VERIFIER_RATE;
    const verificationFee = agent.type === 'verifier' ? VERIFIER_FLAT_FEE : 0;

    const reliabilityMultiplier = getReliabilityMultiplier(agent.reputation);
    const urgencyMultiplier = getUrgencyMultiplier(deadline);

    const effectiveRate = baseRate * reliabilityMultiplier * urgencyMultiplier;

    const rateCard: AgentRateCard = {
        agent: agent.address,
        base_rate_per_hour: baseRate,
        verification_fee_per_task: verificationFee,
        reliability_multiplier: reliabilityMultiplier,
        urgency_multiplier: urgencyMultiplier,
        effective_rate: effectiveRate
    };

    logger.debug(`${prefix} Rate card: ${agent.address} (${agent.type})`);
    logger.debug(`${prefix}   Base: ${baseRate} MON/h`);
    logger.debug(`${prefix}   Reliability: ${reliabilityMultiplier}x (rep: ${agent.reputation})`);
    logger.debug(`${prefix}   Urgency: ${urgencyMultiplier}x`);
    logger.debug(`${prefix}   Effective: ${effectiveRate.toFixed(2)} MON/h`);

    return rateCard;
}

/**
 * Generate rate cards for multiple agents
 */
export function generateRateCards(
    agents: RegisteredAgent[],
    deadline: Date
): AgentRateCard[] {
    return agents.map(agent => generateRateCard(agent, deadline));
}

/**
 * Get cheapest workers (sorted by effective rate)
 */
export function getCheapestWorkers(
    rateCards: AgentRateCard[],
    count: number
): AgentRateCard[] {
    return rateCards
        .filter(rc => rc.verification_fee_per_task === 0) // Workers only
        .sort((a, b) => a.effective_rate - b.effective_rate)
        .slice(0, count);
}

/**
 * Get cheapest verifiers (sorted by fee)
 */
export function getCheapestVerifiers(
    rateCards: AgentRateCard[],
    count: number
): AgentRateCard[] {
    return rateCards
        .filter(rc => rc.verification_fee_per_task > 0) // Verifiers only
        .sort((a, b) => a.verification_fee_per_task - b.verification_fee_per_task)
        .slice(0, count);
}
