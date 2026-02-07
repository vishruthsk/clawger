// Economy Configuration for CLAWGER Protocol

export const ECONOMY_CONFIG = {
    // Escrow Settings
    ESCROW_LOCK_REQUIRED: true,
    MIN_ESCROW_AMOUNT: 100, // Minimum bounty in $CLAWGER

    // Worker Bond Requirements
    WORKER_BOND_PERCENTAGE: 0.10, // 10% of mission bounty
    MIN_WORKER_BOND: 50,
    MAX_WORKER_BOND: 10000,

    // Verifier Settings
    VERIFIER_STAKE_PERCENTAGE: 0.05, // 5% of bounty
    MIN_VERIFIER_STAKE: 25,
    VERIFIER_REWARD_ON_CORRECT: 0.03, // 3% of bounty as reward

    // Slashing & Penalties
    SLASH_PERCENTAGE_ON_FAILURE: 1.0, // 100% of worker bond
    SLASH_PERCENTAGE_ON_INCORRECT_VERIFICATION: 0.50, // 50% of verifier stake

    // Timeouts
    DEFAULT_EXECUTION_TIMEOUT_SECONDS: 3600, // 1 hour
    DEFAULT_VERIFICATION_TIMEOUT_SECONDS: 1800, // 30 minutes

    // Fees
    PLATFORM_FEE_PERCENTAGE: 0.02, // 2% platform fee on successful missions
};

/**
 * Calculate the total cost to create a mission (including escrow + fees)
 */
export function calculateMissionCost(bounty: number): {
    bounty: number;
    platformFee: number;
    totalCost: number;
} {
    const platformFee = bounty * ECONOMY_CONFIG.PLATFORM_FEE_PERCENTAGE;
    const totalCost = bounty + platformFee;

    return {
        bounty,
        platformFee,
        totalCost
    };
}

/**
 * Calculate required worker bond for a given bounty
 */
export function calculateWorkerBond(bounty: number): number {
    const calculatedBond = bounty * ECONOMY_CONFIG.WORKER_BOND_PERCENTAGE;
    return Math.max(
        ECONOMY_CONFIG.MIN_WORKER_BOND,
        Math.min(calculatedBond, ECONOMY_CONFIG.MAX_WORKER_BOND)
    );
}

/**
 * Calculate required verifier stake
 */
export function calculateVerifierStake(bounty: number): number {
    const calculatedStake = bounty * ECONOMY_CONFIG.VERIFIER_STAKE_PERCENTAGE;
    return Math.max(ECONOMY_CONFIG.MIN_VERIFIER_STAKE, calculatedStake);
}

/**
 * Calculate verifier reward for correct verification
 */
export function calculateVerifierReward(bounty: number): number {
    return bounty * ECONOMY_CONFIG.VERIFIER_REWARD_ON_CORRECT;
}
