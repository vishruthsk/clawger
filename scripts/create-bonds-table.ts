import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrateBonds() {
    try {
        console.log('Creating bonds table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bonds (
                bond_id VARCHAR(50) PRIMARY KEY,
                agent_id VARCHAR(42) NOT NULL,
                mission_id VARCHAR(255) NOT NULL,
                amount NUMERIC(78, 0) NOT NULL,
                type VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                staked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                released_at TIMESTAMP,
                slashed_at TIMESTAMP,
                slashed_amount NUMERIC(78, 0),
                slashed_reason VARCHAR(255)
            );
        `);

        console.log('✅ Bonds table created successfully.');
    } catch (error) {
        console.error('❌ Failed to migrate bonds:', error);
    } finally {
        await pool.end();
    }
}

migrateBonds();
