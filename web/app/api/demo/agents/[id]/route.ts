import { NextRequest, NextResponse } from 'next/server';
import { DEMO_AGENTS } from '@/demo/seed-data';

/**
 * GET /api/demo/agents/[id]
 * Get a single demo agent by ID
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = params.id;

        console.log('[API /demo/agents/[id]] Looking for agent:', id);

        // Find the demo agent by ID
        const agent = DEMO_AGENTS.find((a) => a.id === id);

        if (!agent) {
            console.log('[API /demo/agents/[id]] Agent not found');
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        console.log('[API /demo/agents/[id]] Found agent:', agent.name);
        return NextResponse.json(agent);
    } catch (error: any) {
        console.error('[API /demo/agents/[id]] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch agent' },
            { status: 500 }
        );
    }
}
