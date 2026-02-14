import { pool } from '../db';

/**
 * Escrow status for a mission
 */
export interface EscrowStatus {
    missionId: string;
    owner: string;
    amount: number;
    locked_at: Date;
    status: 'locked' | 'released' | 'slashed';
    released_to?: string;
    released_at?: Date;
    slashed_amount?: number;
    slashed_at?: Date;
}

/**
 * Transaction record
 */
export interface Transaction {
    id: number; // Changed from string to number (SERIAL)
    tx_id: string;
    type: 'transfer' | 'escrow_lock' | 'escrow_release' | 'escrow_slash' | 'mint' | 'burn';
    from?: string;
    to?: string;
    amount: number;
    missionId?: string;
    metadata?: any;
    timestamp: Date;
}

/**
 * TokenLedger - $CLAWGER balance tracking and escrow accounting
 * 
 * Deterministic, append-only ledger for token operations
 * Now backed by PostgreSQL.
 */
export class TokenLedger {

    constructor() {
        console.log('[TokenLedger] Initialized with PostgreSQL persistence');
    }

    /**
     * Get balance for an address
     */
    async getBalance(address: string): Promise<number> {
        const result = await pool.query('SELECT balance FROM ledger_balances WHERE address = $1', [address.toLowerCase()]);
        return result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0;
    }

    /**
     * Get available balance (total - escrowed)
     */
    async getAvailableBalance(address: string): Promise<number> {
        const normalizedAddress = address.toLowerCase();
        const total = await this.getBalance(normalizedAddress);

        // Calculate escrowed amount
        const escrowResult = await pool.query(`
            SELECT SUM(amount) as locked_amount 
            FROM ledger_escrows 
            WHERE owner = $1 AND status = 'locked'
        `, [normalizedAddress]);

        const escrowed = escrowResult.rows[0].locked_amount ? parseFloat(escrowResult.rows[0].locked_amount) : 0;

        return total - escrowed;
    }

    /**
     * Get escrowed amount for an address
     */
    async getEscrowedAmount(address: string): Promise<number> {
        const result = await pool.query(`
            SELECT SUM(amount) as locked_amount 
            FROM ledger_escrows 
            WHERE owner = $1 AND status = 'locked'
        `, [address.toLowerCase()]);

        return result.rows[0].locked_amount ? parseFloat(result.rows[0].locked_amount) : 0;
    }

    /**
     * Lock escrow for a mission
     */
    async lockEscrow(address: string, amount: number, missionId: string): Promise<boolean> {
        const normalizedAddress = address.toLowerCase();

        // Transactional lock
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if escrow already exists
            const existing = await client.query('SELECT 1 FROM ledger_escrows WHERE mission_id = $1', [missionId]);
            if (existing.rowCount && existing.rowCount > 0) {
                console.error(`Escrow already exists for mission: ${missionId}`);
                await client.query('ROLLBACK');
                return false;
            }

            // Check AVAILABLE balance (this is tricky in SQL without locking rows)
            // Ideally we calculate available balance based on current state
            // For MVP, we trust getAvailableBalance logic but ensure consistency
            const currentBalanceRes = await client.query('SELECT balance FROM ledger_balances WHERE address = $1 FOR UPDATE', [normalizedAddress]);
            const currentBalance = currentBalanceRes.rows.length > 0 ? parseFloat(currentBalanceRes.rows[0].balance) : 0;

            // Check locked amount
            const lockedRes = await client.query("SELECT SUM(amount) as locked FROM ledger_escrows WHERE owner = $1 AND status = 'locked'", [normalizedAddress]);
            const locked = lockedRes.rows[0].locked ? parseFloat(lockedRes.rows[0].locked) : 0;

            if (currentBalance - locked < amount) {
                console.error(`Insufficient available balance. Has: ${currentBalance - locked}, Needs: ${amount}`);
                await client.query('ROLLBACK');
                return false;
            }

            // Create escrow
            await client.query(`
                INSERT INTO ledger_escrows (mission_id, owner, amount, status)
                VALUES ($1, $2, $3, 'locked')
            `, [missionId, normalizedAddress, amount]);

            // Record transaction
            await this.recordTransaction(client, {
                type: 'escrow_lock',
                from: normalizedAddress,
                amount,
                missionId,
                metadata: { action: 'lock' }
            });

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Failed to lock escrow', e);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Release escrow to recipient
     */
    async releaseEscrow(missionId: string, recipient: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const escrowRes = await client.query("SELECT * FROM ledger_escrows WHERE mission_id = $1 FOR UPDATE", [missionId]);
            if (escrowRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return false;
            }
            const escrow = escrowRes.rows[0];

            if (escrow.status !== 'locked') {
                console.error(`Escrow not in locked state: ${escrow.status}`);
                await client.query('ROLLBACK');
                return false;
            }

            const normalizedRecipient = recipient.toLowerCase();
            const amount = parseFloat(escrow.amount);

            // Transfer: Update balances
            // Decrease owner balance (it was locked, now it's gone)
            await client.query('UPDATE ledger_balances SET balance = balance - $1 WHERE address = $2', [amount, escrow.owner]);

            // Increase recipient balance
            await client.query(`
                INSERT INTO ledger_balances (address, balance) VALUES ($1, $2)
                ON CONFLICT (address) DO UPDATE SET balance = ledger_balances.balance + $2
            `, [normalizedRecipient, amount]);

            // Update escrow status
            await client.query(`
                UPDATE ledger_escrows 
                SET status = 'released', released_to = $1, released_at = NOW() 
                WHERE mission_id = $2
            `, [normalizedRecipient, missionId]);

            // Record transaction
            await this.recordTransaction(client, {
                type: 'escrow_release',
                from: escrow.owner,
                to: normalizedRecipient,
                amount,
                missionId,
                metadata: { action: 'release' }
            });

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Failed to release escrow', e);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Slash escrow (partial or full)
     */
    async slashEscrow(missionId: string, slashAmount: number): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const escrowRes = await client.query("SELECT * FROM ledger_escrows WHERE mission_id = $1 FOR UPDATE", [missionId]);
            if (escrowRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return false;
            }
            const escrow = escrowRes.rows[0];
            const lockedAmount = parseFloat(escrow.amount);


            if (escrow.status !== 'locked') {
                await client.query('ROLLBACK');
                return false;
            }

            if (slashAmount > lockedAmount) {
                console.error(`Slash amount exceeds escrow: ${slashAmount} > ${lockedAmount}`);
                await client.query('ROLLBACK');
                return false;
            }

            // Burn slashed amount (remove from owner balance)
            await client.query('UPDATE ledger_balances SET balance = balance - $1 WHERE address = $2', [slashAmount, escrow.owner]);

            // Update escrow status
            await client.query(`
                UPDATE ledger_escrows 
                SET status = 'slashed', slashed_amount = $1, slashed_at = NOW() 
                WHERE mission_id = $2
            `, [slashAmount, missionId]);

            const remainder = lockedAmount - slashAmount;

            // Record transaction
            await this.recordTransaction(client, {
                type: 'escrow_slash',
                from: escrow.owner,
                amount: slashAmount,
                missionId,
                metadata: { action: 'slash', remainder }
            });

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Failed to slash escrow', e);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Transfer tokens between addresses
     */
    async transfer(from: string, to: string, amount: number): Promise<boolean> {
        const normalizedFrom = from.toLowerCase();
        const normalizedTo = to.toLowerCase();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const fromBalanceRes = await client.query('SELECT balance FROM ledger_balances WHERE address = $1 FOR UPDATE', [normalizedFrom]);
            const fromBalance = fromBalanceRes.rows.length > 0 ? parseFloat(fromBalanceRes.rows[0].balance) : 0;

            if (fromBalance < amount) {
                console.error(`Insufficient balance for transfer. Has: ${fromBalance}, Needs: ${amount}`);
                await client.query('ROLLBACK');
                return false;
            }

            // Deduct from sender
            await client.query('UPDATE ledger_balances SET balance = balance - $1 WHERE address = $2', [amount, normalizedFrom]);

            // Add to recipient
            await client.query(`
                INSERT INTO ledger_balances (address, balance) VALUES ($1, $2)
                ON CONFLICT (address) DO UPDATE SET balance = ledger_balances.balance + $2
            `, [normalizedTo, amount]);

            await this.recordTransaction(client, {
                type: 'transfer',
                from: normalizedFrom,
                to: normalizedTo,
                amount
            });

            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Failed to transfer', e);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Get escrow status for a mission
     */
    async getEscrowStatus(missionId: string): Promise<EscrowStatus | null> {
        const result = await pool.query('SELECT * FROM ledger_escrows WHERE mission_id = $1', [missionId]);
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            missionId: row.mission_id,
            owner: row.owner,
            amount: parseFloat(row.amount),
            locked_at: new Date(row.locked_at),
            status: row.status,
            released_to: row.released_to,
            released_at: row.released_at ? new Date(row.released_at) : undefined,
            slashed_amount: row.slashed_amount ? parseFloat(row.slashed_amount) : undefined,
            slashed_at: row.slashed_at ? new Date(row.slashed_at) : undefined
        };
    }

    /**
     * Get all escrows for an address
     */
    async getEscrowsForAddress(address: string): Promise<EscrowStatus[]> {
        const result = await pool.query('SELECT * FROM ledger_escrows WHERE owner = $1', [address.toLowerCase()]);

        return result.rows.map(row => ({
            missionId: row.mission_id,
            owner: row.owner,
            amount: parseFloat(row.amount),
            locked_at: new Date(row.locked_at),
            status: row.status,
            released_to: row.released_to,
            released_at: row.released_at ? new Date(row.released_at) : undefined,
            slashed_amount: row.slashed_amount ? parseFloat(row.slashed_amount) : undefined,
            slashed_at: row.slashed_at ? new Date(row.slashed_at) : undefined
        }));
    }

    /**
     * Get transaction history for an address
     */
    async getTransactionHistory(address: string, limit: number = 50): Promise<Transaction[]> {
        const result = await pool.query(`
            SELECT * FROM ledger_transactions 
            WHERE from_address = $1 OR to_address = $1
            ORDER BY timestamp DESC
            LIMIT $2
        `, [address.toLowerCase(), limit]);

        return result.rows.map(row => ({
            id: row.id,
            tx_id: row.tx_id,
            type: row.type,
            from: row.from_address,
            to: row.to_address,
            amount: parseFloat(row.amount),
            missionId: row.mission_id,
            metadata: row.metadata,
            timestamp: new Date(row.timestamp)
        }));
    }

    /**
     * Record a transaction (Internal Helper)
     */
    private async recordTransaction(client: any, tx: Omit<Transaction, 'id' | 'timestamp' | 'tx_id'>): Promise<void> {
        const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        await client.query(`
            INSERT INTO ledger_transactions (tx_id, type, from_address, to_address, amount, mission_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            txId, tx.type, tx.from, tx.to, tx.amount, tx.missionId,
            tx.metadata ? JSON.stringify(tx.metadata) : null
        ]);
    }

    /**
     * Mint tokens (for testing/admin)
     */
    async mint(address: string, amount: number): Promise<void> {
        const normalizedAddress = address.toLowerCase();

        await pool.query(`
            INSERT INTO ledger_balances (address, balance) VALUES ($1, $2)
            ON CONFLICT (address) DO UPDATE SET balance = ledger_balances.balance + $2
        `, [normalizedAddress, amount]);

        const client = await pool.connect();
        try {
            await this.recordTransaction(client, {
                type: 'mint',
                to: normalizedAddress,
                amount,
                metadata: { reason: 'Manual mint' }
            });
        } finally {
            client.release();
        }
    }

    /**
     * Get total supply
     */
    async getTotalSupply(): Promise<number> {
        const result = await pool.query('SELECT SUM(balance) as total FROM ledger_balances');
        return result.rows[0].total ? parseFloat(result.rows[0].total) : 0;
    }

    /**
     * Get ledger stats
     */
    async getStats() {
        const supply = await this.getTotalSupply();
        const accountsRes = await pool.query('SELECT count(*) as count FROM ledger_balances');
        const escrowsRes = await pool.query('SELECT count(*) as count FROM ledger_escrows');
        const lockedRes = await pool.query("SELECT count(*) as count FROM ledger_escrows WHERE status = 'locked'");
        const txRes = await pool.query('SELECT count(*) as count FROM ledger_transactions');

        return {
            totalSupply: supply,
            totalAccounts: parseInt(accountsRes.rows[0].count),
            totalEscrows: parseInt(escrowsRes.rows[0].count),
            lockedEscrows: parseInt(lockedRes.rows[0].count),
            totalTransactions: parseInt(txRes.rows[0].count)
        };
    }
}
