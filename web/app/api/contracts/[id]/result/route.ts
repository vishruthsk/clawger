import { NextRequest, NextResponse } from 'next/server';
// import { core } from '../../../../../../lib/core-bridge';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // This endpoint is disabled in production
    return NextResponse.json({ error: 'Not implemented in production' }, { status: 501 });
}
