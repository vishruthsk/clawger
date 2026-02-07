import { TokenLedger } from '../ledger/token-ledger';
import { ECONOMY_CONFIG } from '../../config/economy';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bond record for tracking stakes
 */
export interface BondRecord {
    bondId: string;
    agentId: string;
    missionId: string;
    amount: number;
    type: 'worker' | 'verifier';
    status: 'staked' | 'released' | 'slashed';
    staked_at: Date;
    released_at?: Date;
    slashed_at?: Date;
    slashed_amount?: number;
    slashed_reason?: string;
}

/**
 * Bond operation result
 */
export interface BondResult {
    success: boolean;
    bondId?: string;
    error?: string;
    code?: string;
}

/**
 * BondManager - Manage worker and verifier bonds
 * 
 * Responsibilities:
 * - Stake worker bonds when accepting missions
 * - Stake verifier bonds when voting
 * - Release bonds on successful completion
 * - Slash bonds on failure/timeout/dishonesty
 * - Track bond history per agent
 */
export class BondManager {
    private ledger: TokenLedger;
    private dataDir: string;
    private bondsFile: string;
    private bonds: Map<string, BondRecord>;
    private bondCounter: number;

    constructor(ledger: TokenLedger, dataDir: string = './data') {
        this.ledger = ledger;
        this.dataDir = dataDir;
        this.bondsFile = path.join(dataDir, 'bonds.json');
        this.bonds = new Map();
        this.bondCounter = 0;
        this.load();
    }

    /**
     * Load bond records from disk
     */
    private load(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (fs.existsSync(this.bondsFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.bondsFile, 'utf-8'));

                // Restore bonds with date conversion
                if (data.bonds) {
                    for (const [bondId, bond] of Object.entries(data.bonds)) {
                        this.bonds.set(bondId, {
                            ...(bond as any),
                            staked_at: new Date((bond as any).staked_at),
                            released_at: (bond as any).released_at ? new Date((bond as any).released_at) : undefined,
                            slashed_at: (bond as any).slashed_at ? new Date((bond as any).slashed_at) : undefined
                        });
                    }

                    this.bondCounter = this.bonds.size;
                }
            } catch (error) {
                console.error('Failed to load bonds:', error);
            }
        }
    }

    /**
     * Save bond records to disk
     */
    private save(): void {
        const data = {
            bonds: Object.fromEntries(
                Array.from(this.bonds.entries()).map(([id, bond]) => [
                    id, {
                        ...bond,
                        staked_at: bond.staked_at.toISOString(),
                        released_at: bond.released_at?.toISOString(),
                        slashed_at: bond.slashed_at?.toISOString()
                    }
                ])
            )
        };

        fs.writeFileSync(this.bondsFile, JSON.stringify(data, null, 2));
    }

    /**
     * Stake worker bond
     */
    async stakeWorkerBond(
        agentId: string,
        missionId: string,
        bondAmount: number
    ): Promise<BondResult> {
        // Validate amount
        if (bondAmount < ECONOMY_CONFIG.BOND.MIN_WORKER_BOND) {
            return {
                success: false,
                error: `Bond amount below minimum (${ECONOMY_CONFIG.BOND.MIN_WORKER_BOND} $CLAWGER)`,
                code: 'BOND_TOO_LOW'
            };
        }

        // Check if bond already exists
        const existing = this.getWorkerBond(missionId);
        if (existing) {
            return {
                success: false,
                error: 'Worker bond already staked for this mission',
                code: 'BOND_EXISTS'
            };
        }

        // Check agent balance
        const balance = this.ledger.getAvailableBalance(agentId);
        if (balance < bondAmount) {
            return {
                success: false,
                error: `Insufficient balance. Required: ${bondAmount} $CLAWGER, Available: ${balance} $CLAWGER`,
                code: 'INSUFFICIENT_BALANCE'
            };
        }

        // Lock bond (internal escrow in token ledger)
        const locked = this.ledger.lockEscrow(agentId, bondAmount, `bond_${missionId}`);

        if (!locked) {
            return {
                success: false,
                error: 'Failed to lock bond',
                code: 'LOCK_FAILED'
            };
        }

        // Create bond record
        const bondId = `bond_${String(this.bondCounter++).padStart(6, '0')}`;
        const bond: BondRecord = {
            bondId,
            agentId,
            missionId,
            amount: bondAmount,
            type: 'worker',
            status: 'staked',
            staked_at: new Date()
        };

        this.bonds.set(bondId, bond);
        this.save();

        console.log(`[BondManager] Worker bond staked: ${agentId} → ${bondAmount} $CLAWGER for mission ${missionId}`);

        return {
            success: true,
            bondId
        };
    }

    /**
     * Stake verifier bond
     */
    async stakeVerifierBond(
        verifierId: string,
        missionId: string,
        bondAmount: number
    ): Promise<BondResult> {
        // Validate amount
        if (bondAmount < ECONOMY_CONFIG.BOND.MIN_VERIFIER_BOND) {
            return {
                success: false,
                error: `Bond amount below minimum (${ECONOMY_CONFIG.BOND.MIN_VERIFIER_BOND} $CLAWGER)`,
                code: 'BOND_TOO_LOW'
            };
        }

        // Check verifier balance
        const balance = this.ledger.getAvailableBalance(verifierId);
        if (balance < bondAmount) {
            return {
                success: false,
                error: `Insufficient balance. Required: ${bondAmount} $CLAWGER, Available: ${balance} $CLAWGER`,
                code: 'INSUFFICIENT_BALANCE'
            };
        }

        // Lock bond
        const locked = this.ledger.lockEscrow(verifierId, bondAmount, `verifier_bond_${missionId}_${verifierId}`);

        if (!locked) {
            return {
                success: false,
                error: 'Failed to lock verifier bond',
                code: 'LOCK_FAILED'
            };
        }

        // Create bond record
        const bondId = `bond_${String(this.bondCounter++).padStart(6, '0')}`;
        const bond: BondRecord = {
            bondId,
            agentId: verifierId,
            missionId,
            amount: bondAmount,
            type: 'verifier',
            status: 'staked',
            staked_at: new Date()
        };

        this.bonds.set(bondId, bond);
        this.save();

        console.log(`[BondManager] Verifier bond staked: ${verifierId} → ${bondAmount} $CLAWGER for mission ${missionId}`);

        return {
            success: true,
            bondId
        };
    }

    /**
     * Release worker bond (on success)
     */
    async releaseWorkerBond(missionId: string): Promise<BondResult> {
        const bond = this.getWorkerBond(missionId);

        if (!bond) {
            return {
                success: false,
                error: 'Worker bond not found',
                code: 'BOND_NOT_FOUND'
            };
        }

        if (bond.status !== 'staked') {
            return {
                success: false,
                error: `Bond not in staked state: ${bond.status}`,
                code: 'INVALID_STATE'
            };
        }

        // Release escrow back to worker
        const released = this.ledger.releaseEscrow(`bond_${missionId}`, bond.agentId);

        if (!released) {
            return {
                success: false,
                error: 'Failed to release bond escrow',
                code: 'RELEASE_FAILED'
            };
        }

        // Update bond status
        bond.status = 'released';
        bond.released_at = new Date();

        this.bonds.set(bond.bondId, bond);
        this.save();

        console.log(`[BondManager] Worker bond released: ${bond.agentId} ← ${bond.amount} $CLAWGER`);

        return {
            success: true,
            bondId: bond.bondId
        };
    }

    /**
     * Slash worker bond (on failure)
     */
    async slashWorkerBond(
        missionId: string,
        reason: string,
        slashRate: number = 1.0
    ): Promise<{ success: boolean; slashedAmount?: number; error?: string }> {
        const bond = this.getWorkerBond(missionId);

        if (!bond) {
            return {
                success: false,
                error: 'Worker bond not found'
            };
        }

        if (bond.status !== 'staked') {
            return {
                success: false,
                error: `Bond not in staked state: ${bond.status}`
            };
        }

        // Calculate slash amount
        const slashedAmount = bond.amount * slashRate;

        // Slash escrow
        const slashed = this.ledger.slashEscrow(`bond_${missionId}`, slashedAmount);

        if (!slashed) {
            return {
                success: false,
                error: 'Failed to slash bond'
            };
        }

        // Update bond status
        bond.status = 'slashed';
        bond.slashed_at = new Date();
        bond.slashed_amount = slashedAmount;
        bond.slashed_reason = reason;

        this.bonds.set(bond.bondId, bond);
        this.save();

        console.log(`[BondManager] Worker bond slashed: ${bond.agentId} -${slashedAmount} $CLAWGER (${reason})`);

        return {
            success: true,
            slashedAmount
        };
    }

    /**
     * Settle verifier bonds (release honest, slash dishonest)
     */
    async settleVerifierBonds(
        missionId: string,
        honestVerifiers: string[],
        dishonestVerifiers: string[]
    ): Promise<{ success: boolean; releasedCount?: number; slashedCount?: number }> {
        let releasedCount = 0;
        let slashedCount = 0;

        // Release bonds for honest verifiers
        for (const verifierId of honestVerifiers) {
            const bond = this.getVerifierBond(missionId, verifierId);
            if (bond && bond.status === 'staked') {
                const released = this.ledger.releaseEscrow(
                    `verifier_bond_${missionId}_${verifierId}`,
                    verifierId
                );

                if (released) {
                    bond.status = 'released';
                    bond.released_at = new Date();
                    this.bonds.set(bond.bondId, bond);
                    releasedCount++;
                }
            }
        }

        // Slash bonds for dishonest verifiers
        for (const verifierId of dishonestVerifiers) {
            const bond = this.getVerifierBond(missionId, verifierId);
            if (bond && bond.status === 'staked') {
                const slashed = this.ledger.slashEscrow(
                    `verifier_bond_${missionId}_${verifierId}`,
                    bond.amount
                );

                if (slashed) {
                    bond.status = 'slashed';
                    bond.slashed_at = new Date();
                    bond.slashed_amount = bond.amount;
                    bond.slashed_reason = 'Dishonest verification vote';
                    this.bonds.set(bond.bondId, bond);
                    slashedCount++;
                }
            }
        }

        this.save();

        console.log(`[BondManager] Verifier bonds settled: ${releasedCount} released, ${slashedCount} slashed`);

        return {
            success: true,
            releasedCount,
            slashedCount
        };
    }

    /**
     * Get worker bond for a mission
     */
    getWorkerBond(missionId: string): BondRecord | null {
        for (const bond of this.bonds.values()) {
            if (bond.missionId === missionId && bond.type === 'worker') {
                return bond;
            }
        }
        return null;
    }

    /**
     * Get verifier bond for a mission and verifier
     */
    getVerifierBond(missionId: string, verifierId: string): BondRecord | null {
        for (const bond of this.bonds.values()) {
            if (bond.missionId === missionId &&
                bond.type === 'verifier' &&
                bond.agentId === verifierId) {
                return bond;
            }
        }
        return null;
    }

    /**
     * Get all bonds for an agent
     */
    getAgentBonds(agentId: string): BondRecord[] {
        return Array.from(this.bonds.values())
            .filter(bond => bond.agentId === agentId);
    }

    /**
     * Get agent bond statistics
     */
    getAgentBondStats(agentId: string): {
        totalStaked: number;
        totalReleased: number;
        totalSlashed: number;
        activeStakes: number;
    } {
        const bonds = this.getAgentBonds(agentId);

        return {
            totalStaked: bonds.reduce((sum, b) => sum + b.amount, 0),
            totalReleased: bonds.filter(b => b.status === 'released').reduce((sum, b) => sum + b.amount, 0),
            totalSlashed: bonds.filter(b => b.status === 'slashed').reduce((sum, b) => sum + (b.slashed_amount || 0), 0),
            activeStakes: bonds.filter(b => b.status === 'staked').length
        };
    }

    /**
     * Get all bonds
     */
    getAllBonds(): BondRecord[] {
        return Array.from(this.bonds.values());
    }
}
