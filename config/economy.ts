/**
 * CLAWGER Labor Economy Configuration
 * 
 * Defines all economic parameters for the marketplace
 */

export const ECONOMY_CONFIG = {
    /**
     * Protocol Fee
     * Percentage of mission reward taken as platform fee
     */
    PROTOCOL_FEE_PERCENT: 2,

    /**
     * Worker Bond
     * Percentage of mission reward worker must stake to accept mission
     */
    WORKER_BOND_PERCENT: 10,

    /**
     * Verifier Bond
     * Percentage of mission reward each verifier must stake
     */
    VERIFIER_BOND_PERCENT: 5,

    /**
     * Verifier Reward Pool
     * Fixed amount per mission for all verifiers to split
     */
    VERIFIER_REWARD_POOL: 15, // $CLAWGER tokens

    /**
     * Minimum Verifiers
     * Minimum number of verifiers required for a mission
     */
    MIN_VERIFIERS: 3,

    /**
     * Settlement Finality
     * Settlement behavior - 'immediate' means no retries
     */
    SETTLEMENT_FINALITY: 'immediate' as const,

    /**
     * Slash Distribution
     * How slashed bonds are distributed
     */
    SLASH_DISTRIBUTION: {
        protocol: 0.5,  // 50% to protocol treasury
        verifiers: 0.5  // 50% split among verifiers
    },

    /**
     * Balance Check Mode
     * 'onchain' - check blockchain, 'hybrid' - check cache then blockchain, 'mock' - use in-memory
     */
    BALANCE_CHECK_MODE: process.env.BALANCE_CHECK_MODE || 'mock' as const,

    /**
     * Cache TTL
     * How long to cache balance checks (in seconds)
     */
    BALANCE_CACHE_TTL: 30,

    /**
     * Token Contract
     * Address of CLAWGERToken ERC20 contract
     */
    TOKEN_CONTRACT_ADDRESS: process.env.CLAWGER_TOKEN_ADDRESS || '',

    /**
     * RPC Endpoint
     * Blockchain RPC endpoint for token operations
     */
    RPC_ENDPOINT: process.env.RPC_ENDPOINT || 'http://localhost:8545',

    /**
     * Gas Settings
     */
    GAS_LIMIT: 500000,
    GAS_PRICE_GWEI: 50,

    /**
     * Escrow Settings
     */
    ESCROW: {
        // Minimum escrow amount
        MIN_AMOUNT: 10, // $CLAWGER

        // Maximum escrow amount (anti-whale measure)
        MAX_AMOUNT: 10000, // $CLAWGER

        // Timeout for locked escrows (in seconds)
        LOCK_TIMEOUT: 86400 * 7, // 7 days
    },

    /**
     * Bond Settings
     */
    BOND: {
        // Minimum bond amount
        MIN_WORKER_BOND: 1, // $CLAWGER
        MIN_VERIFIER_BOND: 0.5, // $CLAWGER

        // Slash penalties based on failure type
        SLASH_RATES: {
            TIMEOUT: 1.0,           // 100% of bond
            MALFORMED_RESULT: 0.8,  // 80% of bond
            FAILED_VERIFICATION: 1.0 // 100% of bond
        }
    }
};

/**
 * Get total cost for creating a mission
 */
export function calculateMissionCost(reward: number): {
    reward: number;
    protocolFee: number;
    total: number;
} {
    const protocolFee = (reward * ECONOMY_CONFIG.PROTOCOL_FEE_PERCENT) / 100;
    return {
        reward,
        protocolFee,
        total: reward + protocolFee
    };
}

/**
 * Get bond requirements for a mission
 */
export function calculateBondRequirements(reward: number): {
    workerBond: number;
    verifierBond: number;
    totalBondsRequired: number;
} {
    const workerBond = Math.max(
        (reward * ECONOMY_CONFIG.WORKER_BOND_PERCENT) / 100,
        ECONOMY_CONFIG.BOND.MIN_WORKER_BOND
    );

    const verifierBond = Math.max(
        (reward * ECONOMY_CONFIG.VERIFIER_BOND_PERCENT) / 100,
        ECONOMY_CONFIG.BOND.MIN_VERIFIER_BOND
    );

    const totalBondsRequired = workerBond + (verifierBond * ECONOMY_CONFIG.MIN_VERIFIERS);

    return {
        workerBond,
        verifierBond,
        totalBondsRequired
    };
}

/**
 * Calculate settlement distribution for successful mission
 */
export function calculateSuccessDistribution(reward: number): {
    worker: number;
    verifiers: number;
    verifierPerPerson: number;
    protocol: number;
} {
    const protocolFee = (reward * ECONOMY_CONFIG.PROTOCOL_FEE_PERCENT) / 100;
    const workerPayout = reward - protocolFee;
    const verifierPool = ECONOMY_CONFIG.VERIFIER_REWARD_POOL;
    const verifierPerPerson = verifierPool / ECONOMY_CONFIG.MIN_VERIFIERS;

    return {
        worker: workerPayout,
        verifiers: verifierPool,
        verifierPerPerson,
        protocol: protocolFee
    };
}

/**
 * Calculate settlement distribution for failed mission
 */
export function calculateFailureDistribution(
    reward: number,
    workerBond: number,
    failureType: keyof typeof ECONOMY_CONFIG.BOND.SLASH_RATES = 'FAILED_VERIFICATION'
): {
    requesterRefund: number;
    workerSlashed: number;
    verifiers: number;
    verifierPerPerson: number;
    protocol: number;
} {
    const slashRate = ECONOMY_CONFIG.BOND.SLASH_RATES[failureType];
    const slashedAmount = workerBond * slashRate;

    const protocolShare = slashedAmount * ECONOMY_CONFIG.SLASH_DISTRIBUTION.protocol;
    const verifierShare = slashedAmount * ECONOMY_CONFIG.SLASH_DISTRIBUTION.verifiers;
    const verifierPerPerson = verifierShare / ECONOMY_CONFIG.MIN_VERIFIERS;

    return {
        requesterRefund: reward, // Full reward refunded
        workerSlashed: slashedAmount,
        verifiers: verifierShare,
        verifierPerPerson,
        protocol: protocolShare
    };
}

export type EconomyConfig = typeof ECONOMY_CONFIG;
