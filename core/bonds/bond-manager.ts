import { TokenLedger } from '../ledger/token-ledger';
import { ECONOMY_CONFIG } from '../../config/economy';
import { pool } from '../db';

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

export class BondManager {
    private ledger: TokenLedger;

    constructor(ledger: TokenLedger) {
        this.ledger = ledger;
        console.log('[BondManager] Initialized with PostgreSQL persistence');
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
        const existing = await this.getWorkerBond(missionId);
        if (existing) {
            return {
                success: false,
                error: 'Worker bond already staked for this mission',
                code: 'BOND_EXISTS'
            };
        }

        // Check agent balance
        const balance = await this.ledger.getAvailableBalance(agentId);
        if (balance < bondAmount) {
            return {
                success: false,
                error: `Insufficient balance. Required: ${bondAmount} $CLAWGER, Available: ${balance} $CLAWGER`,
                code: 'INSUFFICIENT_BALANCE'
            };
        }

        // Lock bond (internal escrow in token ledger)
        const locked = await this.ledger.lockEscrow(agentId, bondAmount, `bond_${missionId}`);

        if (!locked) {
            return {
                success: false,
                error: 'Failed to lock bond',
                code: 'LOCK_FAILED'
            };
        }

        // Create bond record in DB
        const bondId = `bond_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        await pool.query(`
            INSERT INTO bonds (
                bond_id, agent_id, mission_id, amount, type, status, staked_at
            ) VALUES (
                $1, $2, $3, $4, 'worker', 'staked', NOW()
            )
        `, [bondId, agentId, missionId, bondAmount]);

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
        const balance = await this.ledger.getAvailableBalance(verifierId);
        if (balance < bondAmount) {
            return {
                success: false,
                error: `Insufficient balance. Required: ${bondAmount} $CLAWGER, Available: ${balance} $CLAWGER`,
                code: 'INSUFFICIENT_BALANCE'
            };
        }

        // Lock bond
        const locked = await this.ledger.lockEscrow(verifierId, bondAmount, `verifier_bond_${missionId}_${verifierId}`);

        if (!locked) {
            return {
                success: false,
                error: 'Failed to lock verifier bond',
                code: 'LOCK_FAILED'
            };
        }

        // Create bond record
        const bondId = `bond_vrf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        await pool.query(`
            INSERT INTO bonds (
                bond_id, agent_id, mission_id, amount, type, status, staked_at
            ) VALUES (
                $1, $2, $3, $4, 'verifier', 'staked', NOW()
            )
        `, [bondId, verifierId, missionId, bondAmount]);

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
        const bond = await this.getWorkerBond(missionId);

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
        const released = await this.ledger.releaseEscrow(`bond_${missionId}`, bond.agentId);

        if (!released) {
            return {
                success: false,
                error: 'Failed to release bond escrow',
                code: 'RELEASE_FAILED'
            };
        }

        // Update bond status
        await pool.query(`
            UPDATE bonds 
            SET status = 'released', released_at = NOW() 
            WHERE bond_id = $1
        `, [bond.bondId]);

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
        const bond = await this.getWorkerBond(missionId);

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
        const slashed = await this.ledger.slashEscrow(`bond_${missionId}`, slashedAmount);

        if (!slashed) {
            return {
                success: false,
                error: 'Failed to slash bond'
            };
        }

        // Update bond status with slash details
        await pool.query(`
            UPDATE bonds 
            SET status = 'slashed', slashed_at = NOW(), slashed_amount = $1, slashed_reason = $2
            WHERE bond_id = $3
        `, [slashedAmount, reason, bond.bondId]);

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
            const bond = await this.getVerifierBond(missionId, verifierId);
            if (bond && bond.status === 'staked') {
                const released = await this.ledger.releaseEscrow(
                    `verifier_bond_${missionId}_${verifierId}`,
                    verifierId
                );

                if (released) {
                    await pool.query(`
                        UPDATE bonds SET status = 'released', released_at = NOW() WHERE bond_id = $1
                    `, [bond.bondId]);
                    releasedCount++;
                }
            }
        }

        // Slash bonds for dishonest verifiers
        for (const verifierId of dishonestVerifiers) {
            const bond = await this.getVerifierBond(missionId, verifierId);
            if (bond && bond.status === 'staked') {
                const slashed = await this.ledger.slashEscrow(
                    `verifier_bond_${missionId}_${verifierId}`,
                    bond.amount
                );

                if (slashed) {
                    await pool.query(`
                        UPDATE bonds 
                        SET status = 'slashed', slashed_at = NOW(), slashed_amount = $1, slashed_reason = 'Dishonest verification vote'
                        WHERE bond_id = $2
                    `, [bond.amount, bond.bondId]);
                    slashedCount++;
                }
            }
        }

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
    async getWorkerBond(missionId: string): Promise<BondRecord | null> {
        const res = await pool.query("SELECT * FROM bonds WHERE mission_id = $1 AND type = 'worker'", [missionId]);
        if (res.rows.length === 0) return null;
        return this.mapRowToBond(res.rows[0]);
    }

    /**
     * Get verifier bond for a mission and verifier
     */
    async getVerifierBond(missionId: string, verifierId: string): Promise<BondRecord | null> {
        const res = await pool.query("SELECT * FROM bonds WHERE mission_id = $1 AND type = 'verifier' AND agent_id = $2", [missionId, verifierId]);
        if (res.rows.length === 0) return null;
        return this.mapRowToBond(res.rows[0]);
    }

    /**
     * Get all bonds for an agent
     */
    async getAgentBonds(agentId: string): Promise<BondRecord[]> {
        const res = await pool.query("SELECT * FROM bonds WHERE agent_id = $1", [agentId]);
        return res.rows.map(row => this.mapRowToBond(row));
    }

    /**
     * Get agent bond statistics
     */
    async getAgentBondStats(agentId: string): Promise<{
        totalStaked: number;
        totalReleased: number;
        totalSlashed: number;
        activeStakes: number;
    }> {
        const bonds = await this.getAgentBonds(agentId);

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
    async getAllBonds(): Promise<BondRecord[]> {
        const res = await pool.query("SELECT * FROM bonds");
        return res.rows.map(row => this.mapRowToBond(row));
    }

    private mapRowToBond(row: any): BondRecord {
        return {
            bondId: row.bond_id,
            agentId: row.agent_id,
            missionId: row.mission_id,
            amount: parseFloat(row.amount),
            type: row.type as 'worker' | 'verifier',
            status: row.status as 'staked' | 'released' | 'slashed',
            staked_at: new Date(row.staked_at),
            released_at: row.released_at ? new Date(row.released_at) : undefined,
            slashed_at: row.slashed_at ? new Date(row.slashed_at) : undefined,
            slashed_amount: row.slashed_amount ? parseFloat(row.slashed_amount) : undefined,
            slashed_reason: row.slashed_reason
        };
    }
}
