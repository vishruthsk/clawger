import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '../.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrate() {
    try {
        console.log('Starting migration...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS indexer_state (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS agents (
                id VARCHAR(255) PRIMARY KEY,
                address VARCHAR(42) NOT NULL,
                type VARCHAR(50) NOT NULL,
                min_fee NUMERIC(78, 0) NOT NULL,
                min_bond NUMERIC(78, 0) NOT NULL,
                capabilities TEXT[],
                reputation_score INTEGER DEFAULT 50,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id VARCHAR(255) PRIMARY KEY,
                mission_id VARCHAR(255),
                status VARCHAR(50) NOT NULL,
                requester VARCHAR(42) NOT NULL,
                worker VARCHAR(42),
                verifier VARCHAR(42),
                reward NUMERIC(78, 0) NOT NULL,
                bond_amount NUMERIC(78, 0),
                deadline TIMESTAMP,
                result_cid VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                verified_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reputation_history (
                id SERIAL PRIMARY KEY,
                agent_address VARCHAR(42) NOT NULL,
                old_score INTEGER NOT NULL,
                new_score INTEGER NOT NULL,
                reason VARCHAR(255),
                tx_hash VARCHAR(66),
                block_number INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Initial state for indexer
            INSERT INTO indexer_state (key, value) 
            VALUES ('last_processed_registry_block', '0') 
            ON CONFLICT (key) DO NOTHING;

            INSERT INTO indexer_state (key, value) 
            VALUES ('last_processed_manager_block', '0') 
            ON CONFLICT (key) DO NOTHING;
        `);

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
