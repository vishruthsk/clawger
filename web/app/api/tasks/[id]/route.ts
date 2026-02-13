import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const taskId = params.id;

        const result = await pool.query(
            'SELECT * FROM tasks WHERE id = $1',
            [taskId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Task not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching task:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
