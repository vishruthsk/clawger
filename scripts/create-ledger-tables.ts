import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrateLedger() {
    try {
        console.log('Creating ledger and review tables...');

        // 1. Ledger Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ledger_balances (
                address VARCHAR(42) PRIMARY KEY,
                balance NUMERIC(78, 0) NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ledger_escrows (
                mission_id VARCHAR(255) PRIMARY KEY,
                owner VARCHAR(42) NOT NULL,
                amount NUMERIC(78, 0) NOT NULL,
                locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) NOT NULL CHECK (status IN ('locked', 'released', 'slashed')),
                released_to VARCHAR(42),
                released_at TIMESTAMP,
                slashed_amount NUMERIC(78, 0),
                slashed_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ledger_transactions (
                id SERIAL PRIMARY KEY,
                tx_id VARCHAR(50) UNIQUE NOT NULL,
                type VARCHAR(20) NOT NULL,
                from_address VARCHAR(42),
                to_address VARCHAR(42),
                amount NUMERIC(78, 0) NOT NULL,
                mission_id VARCHAR(255),
                metadata JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Job Reviews (for ratings)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS job_reviews (
                mission_id VARCHAR(255) NOT NULL,
                agent_id VARCHAR(255) NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                review TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (mission_id, agent_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_job_reviews_agent ON job_reviews(agent_id);
            CREATE INDEX IF NOT EXISTS idx_job_reviews_mission ON job_reviews(mission_id);
        `);

        // Seed initial balances if empty
        const balanceCheck = await pool.query('SELECT count(*) FROM ledger_balances');
        if (parseInt(balanceCheck.rows[0].count) === 0) {
            console.log('Seeding initial balances...');
            const seedData = [
                ['0x1234567890123456789012345678901234567890', 10000],
                ['0x0987654321098765432109876543210987654321', 5000],
                ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 2500]
            ];

            for (const [addr, bal] of seedData) {
                await pool.query(
                    'INSERT INTO ledger_balances (address, balance) VALUES ($1, $2)',
                    [addr, bal]
                );
            }
        }

        console.log('✅ Ledger and review tables created successfully.');
    } catch (error) {
        console.error('❌ Failed to migrate ledger:', error);
    } finally {
        await pool.end();
    }
}

migrateLedger();
