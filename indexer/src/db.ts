import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export function getPool(): Pool {
    return pool;
}

export async function getLastBlockNumbers(): Promise<{ lastBlockRegistry: number; lastBlockManager: number }> {
    const result = await pool.query('SELECT last_block_registry, last_block_manager FROM indexer_state WHERE id = 1');
    if (result.rows.length === 0) {
        return { lastBlockRegistry: 0, lastBlockManager: 0 };
    }
    return {
        lastBlockRegistry: result.rows[0].last_block_registry,
        lastBlockManager: result.rows[0].last_block_manager,
    };
}

export async function updateLastBlockNumber(contract: 'registry' | 'manager', blockNumber: number): Promise<void> {
    const column = contract === 'registry' ? 'last_block_registry' : 'last_block_manager';
    await pool.query(`UPDATE indexer_state SET ${column} = $1, updated_at = NOW() WHERE id = 1`, [blockNumber]);
}
