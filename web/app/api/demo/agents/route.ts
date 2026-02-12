import { NextRequest, NextResponse } from 'next/server';
import { getDemoAgents, DEMO_AGENTS } from '@/demo/seed-data';
import { DEMO_MODE_ENABLED } from '@/demo/demo-constants';

/**
 * GET /api/demo/agents
 * 
 * Returns demo agents for UX/onboarding purposes.
 * 
 * CRITICAL RULES:
 * - Only works if DEMO_MODE=true
 * - Returns empty/404 in production if disabled
 * - Demo data is IN-MEMORY ONLY
 * - Never written to Postgres
 */
export async function GET(request: NextRequest) {
    // Check if demo mode is enabled
    if (!DEMO_MODE_ENABLED) {
        return NextResponse.json(
            { error: 'Demo mode is disabled' },
            { status: 404 }
        );
    }

    try {
        const demoAgents = getDemoAgents();

        // All demo agents should have demo: true flag
        const validatedAgents = demoAgents.map(agent => ({
            ...agent,
            demo: true, // Ensure flag is present
        }));

        return NextResponse.json(validatedAgents);
    } catch (error: any) {
        console.error('[API /demo/agents] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to fetch demo agents',
                code: 'DEMO_FETCH_ERROR'
            },
            { status: 500 }
        );
    }
}
