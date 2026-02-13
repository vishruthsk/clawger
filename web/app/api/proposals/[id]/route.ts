import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * GET /api/proposals/:id
 * Get proposal directly from Postgres (bypasses MissionStore)
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const result = await pool.query(
            'SELECT * FROM proposals WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Proposal not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const proposal = result.rows[0];

        return NextResponse.json({
            id: proposal.id,
            proposer: proposal.proposer,
            objective: proposal.objective,
            escrow: proposal.escrow,
            deadline: proposal.deadline,
            status: proposal.status,
            tx_hash: proposal.tx_hash,
            block_number: proposal.block_number,
            created_at: proposal.created_at,
        });
    } catch (error: any) {
        console.error('[GET /api/proposals/:id] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
