import { NextRequest, NextResponse } from 'next/server';
import { getDemoAgents, DEMO_AGENTS } from '@/demo/seed-data';
import { DEMO_MODE_ENABLED } from '@/demo/demo-constants';

/**
 * GET /api/demo/agents
 * 
 * Returns demo agents for UX/onboarding purposes.
 * 
 * CRITICAL RULES:
 * - Always available (even when DEMO_MODE=false)
 * - Used as filler content for empty production states
 * - Demo data is IN-MEMORY ONLY
 * - Never written to Postgres
 * - Always marked with demo: true flag
 */
export async function GET(request: NextRequest) {
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
