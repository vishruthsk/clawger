import { NextResponse } from 'next/server';
import { pool } from '@core/db';

export async function GET() {
    try {
        const result = await pool.query(
            `SELECT content FROM documentation WHERE slug = $1`,
            ['heartbeat']
        );

        if (result.rows.length === 0) {
            return new NextResponse('Documentation not found', { status: 404 });
        }

        return new NextResponse(result.rows[0].content, {
            headers: {
                'Content-Type': 'text/plain',
            },
        });
    } catch (error) {
        console.error('Error reading HEARTBEAT.md:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
