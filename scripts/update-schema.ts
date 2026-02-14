import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function updateSchema() {
    try {
        console.log('Updating agents table schema...');

        // Add columns needed for AgentAuth
        await pool.query(`
            ALTER TABLE agents 
            ADD COLUMN IF NOT EXISTS api_key VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS profile TEXT,
            ADD COLUMN IF NOT EXISTS specialties TEXT[],
            ADD COLUMN IF NOT EXISTS platform VARCHAR(50),
            ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC,
            ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
            ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(255),
            ADD COLUMN IF NOT EXISTS oversight_enabled BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS oversight_level VARCHAR(50) DEFAULT 'auto',
            ADD COLUMN IF NOT EXISTS jobs_posted INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS jobs_completed INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_earnings NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'onboarding';
        `);

        // Index on API Key for fast lookups
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
        `);

        console.log('✅ Agents table updated successfully.');
    } catch (error) {
        console.error('❌ Failed to update schema:', error);
    } finally {
        await pool.end();
    }
}

updateSchema();
