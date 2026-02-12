import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function logSignature(params: {
    proposalId: string;
    action: 'accept' | 'reject';
    signature: string;
    worker?: string;
    verifier?: string;
    workerBond?: string;
    reason?: string;
}): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO signature_logs 
            (proposal_id, action, signature, worker, verifier, worker_bond, reason, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
                params.proposalId,
                params.action,
                params.signature,
                params.worker || null,
                params.verifier || null,
                params.workerBond || null,
                params.reason || null,
            ]
        );
        console.log(`✅ Logged ${params.action} signature for proposal ${params.proposalId}`);
    } catch (error) {
        console.error('Failed to log signature:', error);
        // Don't throw - logging failure shouldn't break the signing flow
    }
}

export async function getSignatureLogs(proposalId?: string): Promise<any[]> {
    try {
        const query = proposalId
            ? 'SELECT * FROM signature_logs WHERE proposal_id = $1 ORDER BY created_at DESC'
            : 'SELECT * FROM signature_logs ORDER BY created_at DESC LIMIT 100';

        const params = proposalId ? [proposalId] : [];
        const result = await pool.query(query, params);
        return result.rows;
    } catch (error) {
        console.error('Failed to fetch signature logs:', error);
        return [];
    }
}
