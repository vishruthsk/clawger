/**
 * Negotiation FSM
 * Bounded state machine for proposal negotiation (max 1 counter)
 */

import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type NegotiationState = 'PRICED' | 'ACCEPTED' | 'COUNTERED' | 'REJECTED';

export interface NegotiationContext {
    proposal_id: string;
    state: NegotiationState;
    quoted_price: number;
    min_acceptable: number;
    max_acceptable: number;
    user_budget: number;
    counter_amount?: number;
    counter_expiration?: Date;
    rejection_reason?: string;
    state_history: Array<{
        state: NegotiationState;
        timestamp: Date;
        reason: string;
    }>;
}

export interface NegotiationTransition {
    from: NegotiationState;
    to: NegotiationState;
    condition: string;
    action: string;
}

// Finite state transitions (immutable)
const TRANSITIONS: NegotiationTransition[] = [
    {
        from: 'PRICED',
        to: 'ACCEPTED',
        condition: 'budget >= min_acceptable && budget <= max_acceptable',
        action: 'Create task with user budget'
    },
    {
        from: 'PRICED',
        to: 'COUNTERED',
        condition: 'budget >= min_acceptable * 0.8 && budget < min_acceptable',
        action: 'Counter with min_acceptable, start 10-minute timer'
    },
    {
        from: 'PRICED',
        to: 'REJECTED',
        condition: 'budget < min_acceptable * 0.8',
        action: 'Reject permanently, burn bond'
    },
    {
        from: 'COUNTERED',
        to: 'ACCEPTED',
        condition: 'user accepts counter',
        action: 'Create task with counter amount'
    },
    {
        from: 'COUNTERED',
        to: 'REJECTED',
        condition: 'user rejects OR timeout',
        action: 'Close permanently, refund bond'
    }
];

/**
 * Initialize negotiation context
 */
export function initializeNegotiation(
    proposalId: string,
    quotedPrice: number,
    minAcceptable: number,
    maxAcceptable: number,
    userBudget: number
): NegotiationContext {
    return {
        proposal_id: proposalId,
        state: 'PRICED',
        quoted_price: quotedPrice,
        min_acceptable: minAcceptable,
        max_acceptable: maxAcceptable,
        user_budget: userBudget,
        state_history: [
            {
                state: 'PRICED',
                timestamp: new Date(),
                reason: 'Initial quote generated'
            }
        ]
    };
}

/**
 * Transition to new state
 */
function transition(
    context: NegotiationContext,
    newState: NegotiationState,
    reason: string
): void {
    const prefix = getLogPrefix();

    logger.info(`${prefix} State transition: ${context.state} → ${newState}`);
    logger.info(`${prefix} Reason: ${reason}`);

    context.state = newState;
    context.state_history.push({
        state: newState,
        timestamp: new Date(),
        reason
    });
}

/**
 * Process initial budget evaluation
 */
export function processInitialBudget(
    context: NegotiationContext
): {
    decision: 'ACCEPT' | 'COUNTER' | 'REJECT';
    reason: string;
    counter_amount?: number;
} {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} NEGOTIATION FSM`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Current state: ${context.state}`);
    logger.info(`${prefix} User budget: ${context.user_budget.toFixed(2)} MON`);
    logger.info(`${prefix} Quoted price: ${context.quoted_price.toFixed(2)} MON`);
    logger.info(`${prefix} Acceptable range: [${context.min_acceptable.toFixed(2)}, ${context.max_acceptable.toFixed(2)}] MON`);

    // Check if within acceptable range
    if (context.user_budget >= context.min_acceptable &&
        context.user_budget <= context.max_acceptable) {

        transition(context, 'ACCEPTED', 'Budget within acceptable range');

        logger.info(`${prefix} Decision: ACCEPT`);
        logger.info(`${prefix} ========================================\n`);

        return {
            decision: 'ACCEPT',
            reason: `Budget ${context.user_budget.toFixed(2)} MON within acceptable range`
        };
    }

    // Check if close enough for counter
    const counterThreshold = context.min_acceptable * 0.8;

    if (context.user_budget >= counterThreshold &&
        context.user_budget < context.min_acceptable) {

        context.counter_amount = context.min_acceptable;
        context.counter_expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        transition(context, 'COUNTERED', 'Budget close to minimum, offering counter');

        logger.info(`${prefix} Decision: COUNTER`);
        logger.info(`${prefix} Counter amount: ${context.counter_amount.toFixed(2)} MON`);
        logger.info(`${prefix} Counter expires: ${context.counter_expiration.toISOString()}`);
        logger.info(`${prefix} ========================================\n`);

        return {
            decision: 'COUNTER',
            reason: `Budget ${context.user_budget.toFixed(2)} MON below minimum ${context.min_acceptable.toFixed(2)} MON`,
            counter_amount: context.counter_amount
        };
    }

    // Too low - reject
    const percentBelow = ((context.min_acceptable - context.user_budget) / context.min_acceptable * 100).toFixed(1);
    const reason = `Budget ${context.user_budget.toFixed(2)} MON is ${percentBelow}% below minimum viable cost ${context.min_acceptable.toFixed(2)} MON`;

    context.rejection_reason = reason;
    transition(context, 'REJECTED', reason);

    logger.info(`${prefix} Decision: REJECT`);
    logger.info(`${prefix} Reason: ${reason}`);
    logger.info(`${prefix} ========================================\n`);

    return {
        decision: 'REJECT',
        reason
    };
}

/**
 * Process counter-offer response
 */
export function processCounterResponse(
    context: NegotiationContext,
    accepted: boolean
): {
    decision: 'ACCEPT' | 'REJECT';
    reason: string;
} {
    const prefix = getLogPrefix();

    if (context.state !== 'COUNTERED') {
        throw new Error(`Invalid state for counter response: ${context.state}`);
    }

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} COUNTER RESPONSE`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} User response: ${accepted ? 'ACCEPTED' : 'REJECTED'}`);

    if (accepted) {
        transition(context, 'ACCEPTED', 'User accepted counter-offer');

        logger.info(`${prefix} Decision: ACCEPT`);
        logger.info(`${prefix} Final amount: ${context.counter_amount!.toFixed(2)} MON`);
        logger.info(`${prefix} ========================================\n`);

        return {
            decision: 'ACCEPT',
            reason: 'Counter-offer accepted'
        };
    } else {
        const reason = 'User rejected counter-offer';
        context.rejection_reason = reason;
        transition(context, 'REJECTED', reason);

        logger.info(`${prefix} Decision: REJECT`);
        logger.info(`${prefix} Proposal permanently closed`);
        logger.info(`${prefix} ========================================\n`);

        return {
            decision: 'REJECT',
            reason
        };
    }
}

/**
 * Check if counter-offer has expired
 */
export function checkCounterExpiration(context: NegotiationContext): boolean {
    if (context.state !== 'COUNTERED' || !context.counter_expiration) {
        return false;
    }

    const now = new Date();
    return now >= context.counter_expiration;
}

/**
 * Process counter-offer expiration
 */
export function processCounterExpiration(context: NegotiationContext): void {
    const prefix = getLogPrefix();

    if (context.state !== 'COUNTERED') {
        return;
    }

    const reason = 'Counter-offer expired (10-minute timeout)';
    context.rejection_reason = reason;
    transition(context, 'REJECTED', reason);

    logger.warn(`${prefix} Counter-offer expired for ${context.proposal_id}`);
}

/**
 * Get valid transitions from current state
 */
export function getValidTransitions(state: NegotiationState): NegotiationTransition[] {
    return TRANSITIONS.filter(t => t.from === state);
}

/**
 * Check if state is terminal
 */
export function isTerminalState(state: NegotiationState): boolean {
    return state === 'ACCEPTED' || state === 'REJECTED';
}

/**
 * Get negotiation summary
 */
export function getNegotiationSummary(context: NegotiationContext): string {
    const history = context.state_history.map(h =>
        `${h.state} (${h.reason})`
    ).join(' → ');

    return `${context.proposal_id}: ${history}`;
}
