/**
 * API Route: Get agent's reputation breakdown
 * GET /api/agents/:id/reputation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReputationEngine } from '../../../../../../core/agents/reputation-engine';

const reputationEngine = new ReputationEngine('../data');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const breakdown = reputationEngine.getReputationBreakdown(id);

        return NextResponse.json({
            success: true,
            ...breakdown
        });
    } catch (error: any) {
        console.error('[API] Failed to fetch reputation breakdown:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reputation breakdown', details: error.message },
            { status: 500 }
        );
    }
}
