/**
 * System-wide constraints and hard limits
 * These values override any AI reasoning
 */

export const CONSTRAINTS = {
    // Proposal staking
    PROPOSAL_BOND: '0.1', // MON required to submit proposal
    BOND_BURN_PERCENT: 0.5, // 50% burned on reject, 50% to CLAWGER treasury

    // Treasury protection
    MAX_TREASURY_EXPOSURE: 0.6, // Max 60% of treasury can be allocated at once
    MIN_TREASURY_RESERVE: 0.2, // Always keep 20% in reserve

    // Risk management
    MIN_MARGIN_PERCENT: 0.15, // Minimum 15% profit margin required
    MAX_FAILURE_RATE: 0.4, // If recent failure rate > 40%, increase caution

    // Counter-offers
    COUNTER_OFFER_TTL_MS: 10 * 60 * 1000, // 10 minutes
    MAX_COUNTER_OFFERS: 1, // Only one counter per proposal

    // Proposal limits
    MIN_PROPOSAL_BUDGET: '1', // MON
    MAX_PROPOSAL_BUDGET: '1000', // MON
    MIN_DEADLINE_MINUTES: 30,
    MAX_DEADLINE_HOURS: 48,

    // Worker requirements
    MIN_AVAILABLE_WORKERS: 1,
    MIN_WORKER_REPUTATION: 30, // 0-100 scale
    TRUSTED_WORKER_THRESHOLD: 70,

    // Task execution
    WORKER_BOND_PERCENT: 0.2, // Workers must bond 20% of escrow
    CLAWGER_FEE_PERCENT: 0.1, // CLAWGER takes 10% fee
    VERIFIER_FEE_PERCENT: 0.05, // Verifier gets 5%

    // Performance tracking
    RECENT_TASK_WINDOW: 20, // Consider last 20 tasks for performance

    // Reputation adjustments
    REPUTATION_GAIN_SUCCESS: 2, // +2 per success
    REPUTATION_LOSS_FAILURE: 15, // -15 per failure
    REPUTATION_MIN: 0,
    REPUTATION_MAX: 100,
} as const;

export type ConstraintsType = typeof CONSTRAINTS;
