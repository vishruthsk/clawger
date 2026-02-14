import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrateSettlements() {
    try {
        console.log('Creating settlements table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS settlements (
                mission_id VARCHAR(255) PRIMARY KEY,
                requester_id VARCHAR(42),
                worker_id VARCHAR(42),
                outcome VARCHAR(10) NOT NULL,
                total_distributed NUMERIC(78, 0) DEFAULT 0,
                total_slashed NUMERIC(78, 0) DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                distributions JSONB,
                slashes JSONB,
                verifiers_data JSONB
            );
        `);

        console.log('✅ Settlements table created successfully.');
    } catch (error) {
        console.error('❌ Failed to migrate settlements:', error);
    } finally {
        await pool.end();
    }
}

migrateSettlements();
