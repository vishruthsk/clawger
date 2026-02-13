/**
 * Reset database for clean indexer test
 * Clears agents table and resets indexer state to block 54725000
 */

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function reset() {
    console.log('🧹 Resetting database for clean indexer test...');
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]}`);

    try {
        // Clear agents table
        await pool.query('DELETE FROM agents');
        console.log('✅ Cleared agents table');

        // Reset indexer state to block 54725000
        await pool.query(`
            UPDATE indexer_state 
            SET last_block_registry = 54725000, 
                last_block_manager = 54725000,
                updated_at = NOW()
            WHERE id = 1
        `);
        console.log('✅ Reset indexer state to block 54725000');

        // Verify
        const count = await pool.query('SELECT COUNT(*) FROM agents');
        console.log(`\n📊 Agents in DB: ${count.rows[0].count}`);

        const state = await pool.query('SELECT last_block_registry, last_block_manager FROM indexer_state WHERE id = 1');
        console.log(`📊 Registry start block: ${state.rows[0].last_block_registry}`);
        console.log(`📊 Manager start block: ${state.rows[0].last_block_manager}`);

        console.log('\n✅ Database reset complete!');
        console.log('Now run: npm run production');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

reset();
