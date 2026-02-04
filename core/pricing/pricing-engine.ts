/**
 * Pricing Engine
 * Generates authoritative quotes with fixed margins and negotiation bands
 */

import { CostEstimate } from './cost-estimator';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface PricingQuote {
    estimated_cost: number;
    platform_margin: number;      // 20% of estimated cost
    platform_margin_percent: number; // 0.20
    quoted_price: number;          // estimated + margin
    min_acceptable: number;        // 90% of quoted
    max_acceptable: number;        // 110% of quoted
    negotiation_band_percent: number; // 0.20 (20% total band)
    min_counter_threshold: number; // 80% of min_acceptable
}

// Fixed pricing parameters
const PLATFORM_MARGIN_PERCENT = 0.20;  // 20% margin
const NEGOTIATION_BAND_PERCENT = 0.10; // ±10% band
const COUNTER_THRESHOLD_PERCENT = 0.80; // 80% of min for counter

/**
 * Generate pricing quote from cost estimate
 */
export function generateQuote(estimate: CostEstimate): PricingQuote {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} PRICING QUOTE`);
    logger.info(`${prefix} ========================================`);

    const estimatedCost = estimate.total_cost;
    const platformMargin = estimatedCost * PLATFORM_MARGIN_PERCENT;
    const quotedPrice = estimatedCost + platformMargin;

    const minAcceptable = quotedPrice * (1 - NEGOTIATION_BAND_PERCENT);
    const maxAcceptable = quotedPrice * (1 + NEGOTIATION_BAND_PERCENT);
    const minCounterThreshold = minAcceptable * COUNTER_THRESHOLD_PERCENT;

    logger.info(`${prefix} Estimated cost: ${estimatedCost.toFixed(2)} MON`);
    logger.info(`${prefix} Platform margin: ${platformMargin.toFixed(2)} MON (${(PLATFORM_MARGIN_PERCENT * 100).toFixed(0)}%)`);
    logger.info(`${prefix} Quoted price: ${quotedPrice.toFixed(2)} MON`);
    logger.info(`${prefix} `);
    logger.info(`${prefix} Negotiation band:`);
    logger.info(`${prefix}   Min acceptable: ${minAcceptable.toFixed(2)} MON (90%)`);
    logger.info(`${prefix}   Max acceptable: ${maxAcceptable.toFixed(2)} MON (110%)`);
    logger.info(`${prefix}   Counter threshold: ${minCounterThreshold.toFixed(2)} MON (80% of min)`);
    logger.info(`${prefix} ========================================\n`);

    return {
        estimated_cost: estimatedCost,
        platform_margin: platformMargin,
        platform_margin_percent: PLATFORM_MARGIN_PERCENT,
        quoted_price: quotedPrice,
        min_acceptable: minAcceptable,
        max_acceptable: maxAcceptable,
        negotiation_band_percent: NEGOTIATION_BAND_PERCENT,
        min_counter_threshold: minCounterThreshold
    };
}

/**
 * Evaluate user budget against quote
 */
export function evaluateBudget(
    userBudget: number,
    quote: PricingQuote
): {
    status: 'ACCEPT' | 'COUNTER' | 'REJECT';
    reason: string;
    counter_amount?: number;
} {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} BUDGET EVALUATION`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} User budget: ${userBudget.toFixed(2)} MON`);
    logger.info(`${prefix} Quoted price: ${quote.quoted_price.toFixed(2)} MON`);

    // Check if within acceptable range
    if (userBudget >= quote.min_acceptable && userBudget <= quote.max_acceptable) {
        const percentOfQuote = (userBudget / quote.quoted_price * 100).toFixed(1);
        logger.info(`${prefix} Status: ACCEPT (${percentOfQuote}% of quote)`);
        logger.info(`${prefix} ========================================\n`);

        return {
            status: 'ACCEPT',
            reason: `Budget ${userBudget.toFixed(2)} MON within acceptable range [${quote.min_acceptable.toFixed(2)}, ${quote.max_acceptable.toFixed(2)}] MON`
        };
    }

    // Check if close enough for counter-offer
    if (userBudget >= quote.min_counter_threshold && userBudget < quote.min_acceptable) {
        const shortfall = quote.min_acceptable - userBudget;
        const percentShort = (shortfall / quote.min_acceptable * 100).toFixed(1);

        logger.info(`${prefix} Status: COUNTER`);
        logger.info(`${prefix} Shortfall: ${shortfall.toFixed(2)} MON (${percentShort}%)`);
        logger.info(`${prefix} Counter offer: ${quote.min_acceptable.toFixed(2)} MON`);
        logger.info(`${prefix} ========================================\n`);

        return {
            status: 'COUNTER',
            reason: `Budget ${userBudget.toFixed(2)} MON below minimum acceptable ${quote.min_acceptable.toFixed(2)} MON`,
            counter_amount: quote.min_acceptable
        };
    }

    // Too low - reject
    const shortfall = quote.min_acceptable - userBudget;
    const percentBelow = (shortfall / quote.min_acceptable * 100).toFixed(1);

    logger.info(`${prefix} Status: REJECT`);
    logger.info(`${prefix} Budget ${percentBelow}% below minimum viable cost`);
    logger.info(`${prefix} ========================================\n`);

    return {
        status: 'REJECT',
        reason: `Budget ${userBudget.toFixed(2)} MON is ${percentBelow}% below minimum viable cost ${quote.min_acceptable.toFixed(2)} MON`
    };
}

/**
 * Check if budget is above maximum acceptable
 */
export function isOverpayment(userBudget: number, quote: PricingQuote): boolean {
    return userBudget > quote.max_acceptable;
}

/**
 * Get pricing summary for logging
 */
export function getPricingSummary(quote: PricingQuote): string {
    return `Quote: ${quote.quoted_price.toFixed(2)} MON | Range: [${quote.min_acceptable.toFixed(2)}, ${quote.max_acceptable.toFixed(2)}] MON | Counter threshold: ${quote.min_counter_threshold.toFixed(2)} MON`;
}
