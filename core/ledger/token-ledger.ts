import * as fs from 'fs';
import * as path from 'path';

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
    id: string;
    type: 'transfer' | 'escrow_lock' | 'escrow_release' | 'escrow_slash' | 'mint' | 'burn';
    from?: string;
    to?: string;
    amount: number;
    missionId?: string;
    timestamp: Date;
    metadata?: any;
}

/**
 * Ledger state
 */
interface LedgerState {
    balances: { [address: string]: number };
    escrows: { [missionId: string]: EscrowStatus };
    transactions: Transaction[];
}

/**
 * TokenLedger - $CLAWGER balance tracking and escrow accounting
 * 
 * Deterministic, append-only ledger for token operations
 */
export class TokenLedger {
    private dataDir: string;
    private ledgerFile: string;
    private state: LedgerState;
    private txCounter: number;

    constructor(dataDir: string = './data') {
        this.dataDir = dataDir;
        this.ledgerFile = path.join(dataDir, 'token-ledger.json');
        this.state = {
            balances: {},
            escrows: {},
            transactions: []
        };
        this.txCounter = 0;
        this.load();
    }

    /**
     * Load ledger state from disk
     */
    private load(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (fs.existsSync(this.ledgerFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.ledgerFile, 'utf-8'));

                // Restore state with date conversion
                this.state.balances = data.balances || {};
                this.state.escrows = {};
                this.state.transactions = [];

                // Convert escrow dates
                if (data.escrows) {
                    for (const [missionId, escrow] of Object.entries(data.escrows)) {
                        this.state.escrows[missionId] = {
                            ...(escrow as any),
                            locked_at: new Date((escrow as any).locked_at),
                            released_at: (escrow as any).released_at ? new Date((escrow as any).released_at) : undefined,
                            slashed_at: (escrow as any).slashed_at ? new Date((escrow as any).slashed_at) : undefined
                        };
                    }
                }

                // Convert transaction dates
                if (data.transactions) {
                    this.state.transactions = data.transactions.map((tx: any) => ({
                        ...tx,
                        timestamp: new Date(tx.timestamp)
                    }));

                    // Update counter
                    this.txCounter = this.state.transactions.length;
                }
            } catch (error) {
                console.error('Failed to load token ledger:', error);
            }
        } else {
            // Initialize with seed balances for testing
            this.seedInitialBalances();
        }
    }

    /**
     * Save ledger state to disk
     */
    private save(): void {
        const data = {
            balances: this.state.balances,
            escrows: Object.fromEntries(
                Object.entries(this.state.escrows).map(([id, escrow]) => [
                    id,
                    {
                        ...escrow,
                        locked_at: escrow.locked_at.toISOString(),
                        released_at: escrow.released_at?.toISOString(),
                        slashed_at: escrow.slashed_at?.toISOString()
                    }
                ])
            ),
            transactions: this.state.transactions.map(tx => ({
                ...tx,
                timestamp: tx.timestamp.toISOString()
            }))
        };

        fs.writeFileSync(this.ledgerFile, JSON.stringify(data, null, 2));
    }

    /**
     * Seed initial balances for testing
     */
    private seedInitialBalances(): void {
        // Give some test wallets initial balances
        this.state.balances = {
            '0x1234567890123456789012345678901234567890': 10000, // Test wallet 1
            '0x0987654321098765432109876543210987654321': 5000,  // Test wallet 2
            '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': 2500   // Test wallet 3
        };

        // Record mint transactions
        for (const [address, amount] of Object.entries(this.state.balances)) {
            this.recordTransaction({
                type: 'mint',
                to: address,
                amount,
                metadata: { reason: 'Initial seed balance' }
            });
        }

        this.save();
    }

    /**
     * Get balance for an address
     */
    getBalance(address: string): number {
        const normalizedAddress = address.toLowerCase();
        return this.state.balances[normalizedAddress] || 0;
    }

    /**
     * Get available balance (total - escrowed)
     */
    getAvailableBalance(address: string): number {
        const normalizedAddress = address.toLowerCase();
        const total = this.getBalance(normalizedAddress);

        // Calculate escrowed amount
        let escrowed = 0;
        for (const escrow of Object.values(this.state.escrows)) {
            if (escrow.owner.toLowerCase() === normalizedAddress && escrow.status === 'locked') {
                escrowed += escrow.amount;
            }
        }

        return total - escrowed;
    }

    /**
     * Get escrowed amount for an address
     */
    getEscrowedAmount(address: string): number {
        const normalizedAddress = address.toLowerCase();
        let escrowed = 0;

        for (const escrow of Object.values(this.state.escrows)) {
            if (escrow.owner.toLowerCase() === normalizedAddress && escrow.status === 'locked') {
                escrowed += escrow.amount;
            }
        }

        return escrowed;
    }

    /**
     * Lock escrow for a mission
     */
    lockEscrow(address: string, amount: number, missionId: string): boolean {
        const normalizedAddress = address.toLowerCase();

        // Check if escrow already exists
        if (this.state.escrows[missionId]) {
            console.error(`Escrow already exists for mission: ${missionId}`);
            return false;
        }

        // Check available balance
        const available = this.getAvailableBalance(normalizedAddress);
        if (available < amount) {
            console.error(`Insufficient balance. Available: ${available}, Required: ${amount}`);
            return false;
        }

        // Create escrow
        this.state.escrows[missionId] = {
            missionId,
            owner: normalizedAddress,
            amount,
            locked_at: new Date(),
            status: 'locked'
        };

        // Record transaction
        this.recordTransaction({
            type: 'escrow_lock',
            from: normalizedAddress,
            amount,
            missionId,
            metadata: { action: 'lock' }
        });

        this.save();
        return true;
    }

    /**
     * Release escrow to recipient
     */
    releaseEscrow(missionId: string, recipient: string): boolean {
        const escrow = this.state.escrows[missionId];

        if (!escrow) {
            console.error(`Escrow not found for mission: ${missionId}`);
            return false;
        }

        if (escrow.status !== 'locked') {
            console.error(`Escrow not in locked state: ${escrow.status}`);
            return false;
        }

        const normalizedRecipient = recipient.toLowerCase();

        // Transfer from owner to recipient
        this.transfer(escrow.owner, normalizedRecipient, escrow.amount);

        // Update escrow status
        escrow.status = 'released';
        escrow.released_to = normalizedRecipient;
        escrow.released_at = new Date();

        // Record transaction
        this.recordTransaction({
            type: 'escrow_release',
            from: escrow.owner,
            to: normalizedRecipient,
            amount: escrow.amount,
            missionId,
            metadata: { action: 'release' }
        });

        this.save();
        return true;
    }

    /**
     * Slash escrow (partial or full)
     */
    slashEscrow(missionId: string, slashAmount: number): boolean {
        const escrow = this.state.escrows[missionId];

        if (!escrow) {
            console.error(`Escrow not found for mission: ${missionId}`);
            return false;
        }

        if (escrow.status !== 'locked') {
            console.error(`Escrow not in locked state: ${escrow.status}`);
            return false;
        }

        if (slashAmount > escrow.amount) {
            console.error(`Slash amount exceeds escrow: ${slashAmount} > ${escrow.amount}`);
            return false;
        }

        // Burn slashed amount (remove from circulation)
        const currentBalance = this.getBalance(escrow.owner);
        this.state.balances[escrow.owner] = currentBalance - slashAmount;

        // Update escrow status
        escrow.status = 'slashed';
        escrow.slashed_amount = slashAmount;
        escrow.slashed_at = new Date();

        // If partial slash, release remainder
        const remainder = escrow.amount - slashAmount;
        if (remainder > 0) {
            // Remainder stays with owner (already in their balance)
        }

        // Record transaction
        this.recordTransaction({
            type: 'escrow_slash',
            from: escrow.owner,
            amount: slashAmount,
            missionId,
            metadata: { action: 'slash', remainder }
        });

        this.save();
        return true;
    }

    /**
     * Transfer tokens between addresses
     */
    transfer(from: string, to: string, amount: number): boolean {
        const normalizedFrom = from.toLowerCase();
        const normalizedTo = to.toLowerCase();

        // Check balance
        const fromBalance = this.getBalance(normalizedFrom);
        if (fromBalance < amount) {
            console.error(`Insufficient balance for transfer. Has: ${fromBalance}, Needs: ${amount}`);
            return false;
        }

        // Update balances
        this.state.balances[normalizedFrom] = fromBalance - amount;
        this.state.balances[normalizedTo] = this.getBalance(normalizedTo) + amount;

        // Record transaction
        this.recordTransaction({
            type: 'transfer',
            from: normalizedFrom,
            to: normalizedTo,
            amount
        });

        this.save();
        return true;
    }

    /**
     * Get escrow status for a mission
     */
    getEscrowStatus(missionId: string): EscrowStatus | null {
        return this.state.escrows[missionId] || null;
    }

    /**
     * Get all escrows for an address
     */
    getEscrowsForAddress(address: string): EscrowStatus[] {
        const normalizedAddress = address.toLowerCase();
        return Object.values(this.state.escrows).filter(
            escrow => escrow.owner === normalizedAddress
        );
    }

    /**
     * Get transaction history for an address
     */
    getTransactionHistory(address: string, limit: number = 50): Transaction[] {
        const normalizedAddress = address.toLowerCase();

        return this.state.transactions
            .filter(tx =>
                tx.from?.toLowerCase() === normalizedAddress ||
                tx.to?.toLowerCase() === normalizedAddress
            )
            .slice(-limit)
            .reverse();
    }

    /**
     * Record a transaction
     */
    private recordTransaction(tx: Omit<Transaction, 'id' | 'timestamp'>): void {
        const transaction: Transaction = {
            ...tx,
            id: `tx_${String(this.txCounter++).padStart(6, '0')}`,
            timestamp: new Date()
        };

        this.state.transactions.push(transaction);
    }

    /**
     * Mint tokens (for testing/admin)
     */
    mint(address: string, amount: number): void {
        const normalizedAddress = address.toLowerCase();
        const currentBalance = this.getBalance(normalizedAddress);
        this.state.balances[normalizedAddress] = currentBalance + amount;

        this.recordTransaction({
            type: 'mint',
            to: normalizedAddress,
            amount,
            metadata: { reason: 'Manual mint' }
        });

        this.save();
    }

    /**
     * Get total supply
     */
    getTotalSupply(): number {
        return Object.values(this.state.balances).reduce((sum, balance) => sum + balance, 0);
    }

    /**
     * Get ledger stats
     */
    getStats() {
        return {
            totalSupply: this.getTotalSupply(),
            totalAccounts: Object.keys(this.state.balances).length,
            totalEscrows: Object.keys(this.state.escrows).length,
            lockedEscrows: Object.values(this.state.escrows).filter(e => e.status === 'locked').length,
            totalTransactions: this.state.transactions.length
        };
    }
}
