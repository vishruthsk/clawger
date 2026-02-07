import { TokenLedger } from '../ledger/token-ledger';

/**
 * Result type for escrow operations
 */
export interface EscrowResult {
    success: boolean;
    error?: string;
    code?: string;
    details?: any;
}

/**
 * Escrow details for a mission
 */
export interface EscrowDetails {
    missionId: string;
    owner: string;
    amount: number;
    status: 'locked' | 'released' | 'slashed';
    locked_at: Date;
    released_to?: string;
    released_at?: Date;
    slashed_amount?: number;
    slashed_at?: Date;
}

/**
 * EscrowEngine - Orchestrate escrow lifecycle for missions
 * 
 * Handles:
 * - Pre-flight balance validation
 * - Atomic lock on mission creation
 * - Release on verification success
 * - Slash on failure/timeout
 */
export class EscrowEngine {
    private ledger: TokenLedger;

    constructor(ledger: TokenLedger) {
        this.ledger = ledger;
    }

    /**
     * Validate balance and lock escrow for a mission
     * 
     * This is the critical pre-flight check before mission creation
     */
    validateAndLock(
        requester: string,
        amount: number,
        missionId: string
    ): EscrowResult {
        // Normalize address
        const normalizedRequester = requester.toLowerCase();

        // Check if mission already has escrow
        const existing = this.ledger.getEscrowStatus(missionId);
        if (existing) {
            return {
                success: false,
                error: 'Escrow already exists for this mission',
                code: 'ESCROW_EXISTS'
            };
        }

        // Validate amount
        if (amount <= 0) {
            return {
                success: false,
                error: 'Invalid escrow amount',
                code: 'INVALID_AMOUNT'
            };
        }

        // Check available balance
        const available = this.ledger.getAvailableBalance(normalizedRequester);
        if (available < amount) {
            return {
                success: false,
                error: `Insufficient funds. You need at least ${amount} $CLAWGER to submit this mission.`,
                code: 'INSUFFICIENT_FUNDS',
                details: {
                    required: amount,
                    available,
                    shortfall: amount - available
                }
            };
        }

        // Lock escrow
        const locked = this.ledger.lockEscrow(normalizedRequester, amount, missionId);

        if (!locked) {
            return {
                success: false,
                error: 'Failed to lock escrow',
                code: 'ESCROW_LOCK_FAILED'
            };
        }

        return {
            success: true,
            details: {
                missionId,
                amount,
                owner: normalizedRequester,
                locked_at: new Date()
            }
        };
    }

    /**
     * Release escrow to agent upon successful verification
     */
    releaseToAgent(missionId: string, agentAddress: string): EscrowResult {
        // Normalize address
        const normalizedAgent = agentAddress.toLowerCase();

        // Check if escrow exists
        const escrow = this.ledger.getEscrowStatus(missionId);
        if (!escrow) {
            return {
                success: false,
                error: 'Escrow not found for this mission',
                code: 'ESCROW_NOT_FOUND'
            };
        }

        // Check if already released or slashed
        if (escrow.status !== 'locked') {
            return {
                success: false,
                error: `Escrow already ${escrow.status}`,
                code: 'ESCROW_NOT_LOCKED'
            };
        }

        // Release to agent
        const released = this.ledger.releaseEscrow(missionId, normalizedAgent);

        if (!released) {
            return {
                success: false,
                error: 'Failed to release escrow',
                code: 'ESCROW_RELEASE_FAILED'
            };
        }

        return {
            success: true,
            details: {
                missionId,
                amount: escrow.amount,
                released_to: normalizedAgent,
                released_at: new Date()
            }
        };
    }

    /**
     * Slash escrow and optionally refund remainder to requester
     * 
     * @param missionId - Mission ID
     * @param reason - Reason for slashing
     * @param slashPercentage - Percentage to slash (0-100), default 100
     */
    slashAndRefund(
        missionId: string,
        reason: string,
        slashPercentage: number = 100
    ): EscrowResult {
        // Validate slash percentage
        if (slashPercentage < 0 || slashPercentage > 100) {
            return {
                success: false,
                error: 'Invalid slash percentage',
                code: 'INVALID_PERCENTAGE'
            };
        }

        // Check if escrow exists
        const escrow = this.ledger.getEscrowStatus(missionId);
        if (!escrow) {
            return {
                success: false,
                error: 'Escrow not found for this mission',
                code: 'ESCROW_NOT_FOUND'
            };
        }

        // Check if already released or slashed
        if (escrow.status !== 'locked') {
            return {
                success: false,
                error: `Escrow already ${escrow.status}`,
                code: 'ESCROW_NOT_LOCKED'
            };
        }

        // Calculate slash amount
        const slashAmount = (escrow.amount * slashPercentage) / 100;
        const refundAmount = escrow.amount - slashAmount;

        // Slash escrow
        const slashed = this.ledger.slashEscrow(missionId, slashAmount);

        if (!slashed) {
            return {
                success: false,
                error: 'Failed to slash escrow',
                code: 'ESCROW_SLASH_FAILED'
            };
        }

        return {
            success: true,
            details: {
                missionId,
                total: escrow.amount,
                slashed: slashAmount,
                refunded: refundAmount,
                reason,
                slashed_at: new Date()
            }
        };
    }

    /**
     * Get escrow details for a mission
     */
    getEscrowDetails(missionId: string): EscrowDetails | null {
        const status = this.ledger.getEscrowStatus(missionId);
        if (!status) {
            return null;
        }

        return {
            missionId: status.missionId,
            owner: status.owner,
            amount: status.amount,
            status: status.status,
            locked_at: status.locked_at,
            released_to: status.released_to,
            released_at: status.released_at,
            slashed_amount: status.slashed_amount,
            slashed_at: status.slashed_at
        };
    }

    /**
     * Check if requester has sufficient balance for amount
     */
    canAfford(requester: string, amount: number): boolean {
        const available = this.ledger.getAvailableBalance(requester.toLowerCase());
        return available >= amount;
    }

    /**
     * Get all escrows for a requester
     */
    getEscrowsForRequester(requester: string): EscrowDetails[] {
        const escrows = this.ledger.getEscrowsForAddress(requester.toLowerCase());
        return escrows.map(e => ({
            missionId: e.missionId,
            owner: e.owner,
            amount: e.amount,
            status: e.status,
            locked_at: e.locked_at,
            released_to: e.released_to,
            released_at: e.released_at,
            slashed_amount: e.slashed_amount,
            slashed_at: e.slashed_at
        }));
    }
}
