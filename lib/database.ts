import { Pool } from 'pg';

/**
 * Database connection pool for production Postgres
 */
export class DatabaseClient {
    private pool: Pool;

    constructor() {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        this.pool = new Pool({
            connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            console.error('Unexpected database error:', err);
        });
    }

    async query(text: string, params?: any[]) {
        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log('[DB Query]', { text, duration, rows: res.rowCount });
            return res;
        } catch (error) {
            console.error('[DB Error]', { text, params, error });
            throw error;
        }
    }

    async getClient() {
        return await this.pool.connect();
    }

    async end() {
        await this.pool.end();
    }
}

// Singleton instance
let dbInstance: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
    if (!dbInstance) {
        dbInstance = new DatabaseClient();
    }
    return dbInstance;
}
