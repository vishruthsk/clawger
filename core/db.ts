import { Pool } from 'pg';
import * as dns from 'dns';

// Force IPv4 ordering to fix potential connection issues in some environments
if (process.env.NODE_ENV !== 'production') {
    dns.setDefaultResultOrder('ipv4first');
}

// Global pool instance to prevent creating too many connections
// in hot-reloading environments (like Next.js dev)
const globalForDb = global as unknown as { dbPool: Pool };

export const pool = globalForDb.dbPool || new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined, // Allow self-signed certs in dev if needed, or disable SSL locally
    max: 10, // Max clients in the pool
    idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== 'production') {
    globalForDb.dbPool = pool;
}

export async function query(text: string, params?: any[]) {
    return pool.query(text, params);
}
