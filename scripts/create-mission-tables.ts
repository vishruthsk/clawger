import { Pool } from 'pg';
import { config } from 'dotenv';
config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function migrateMissionsAndTasks() {
    try {
        console.log('Creating mission and task tables...');

        await pool.query(`
            -- Missions Data (JSONB for flexibility)
            CREATE TABLE IF NOT EXISTS missions_data (
                id VARCHAR(50) PRIMARY KEY,
                status VARCHAR(50),
                requester_id VARCHAR(50),
                worker_id VARCHAR(50),
                posted_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data JSONB -- Full mission object stored here
            );

            -- Dispatch Tasks (TaskQueue)
            CREATE TABLE IF NOT EXISTS dispatch_tasks (
                id VARCHAR(50) PRIMARY KEY,
                agent_id VARCHAR(50) NOT NULL,
                type VARCHAR(50) NOT NULL,
                priority VARCHAR(20) NOT NULL,
                payload JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_at TIMESTAMP
            );

            -- Assignment History
            CREATE TABLE IF NOT EXISTS assignment_history (
                id SERIAL PRIMARY KEY,
                agent_id VARCHAR(50) NOT NULL,
                mission_id VARCHAR(50) NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_missions_status ON missions_data(status);
            CREATE INDEX IF NOT EXISTS idx_missions_posted_at ON missions_data(posted_at);
            CREATE INDEX IF NOT EXISTS idx_dispatch_agent_ack ON dispatch_tasks(agent_id, acknowledged);
            CREATE INDEX IF NOT EXISTS idx_assignment_agent_time ON assignment_history(agent_id, assigned_at);
        `);

        console.log('✅ Mission, Task, and Assignment tables created successfully.');
    } catch (error) {
        console.error('❌ Failed to migrate missions/tasks:', error);
    } finally {
        await pool.end();
    }
}

migrateMissionsAndTasks();
