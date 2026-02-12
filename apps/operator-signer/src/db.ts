import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function initDatabase(): Promise<void> {
    try {
        // Create signature_logs table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS signature_logs (
                id SERIAL PRIMARY KEY,
                proposal_id VARCHAR(100) NOT NULL,
                action VARCHAR(20) NOT NULL,
                signature TEXT NOT NULL,
                worker VARCHAR(42),
                verifier VARCHAR(42),
                worker_bond VARCHAR(100),
                reason TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);

        // Create index on proposal_id for faster lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_signature_logs_proposal_id 
            ON signature_logs(proposal_id);
        `);

        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

export function getPool(): Pool {
    return pool;
}
