import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = (await params);
        const lowerAddress = address.toLowerCase();

        // Create pool for this request
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });

        const result = await pool.query(
            'SELECT old_score, new_score, reason, updated_at, block_number, tx_hash FROM reputation_updates WHERE agent = $1 ORDER BY updated_at DESC LIMIT 50',
            [address]
        );

        await pool.end();

        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching reputation history:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
