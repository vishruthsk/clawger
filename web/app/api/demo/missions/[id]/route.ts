import { NextRequest, NextResponse } from 'next/server';
import { getDemoMissions } from '@/demo/seed-data';

/**
 * GET /api/demo/missions/:id
 * 
 * Returns a single demo mission by ID.
 * 
 * CRITICAL RULES:
 * - Always available (even when DEMO_MODE=false)
 * - Used for demo mission detail pages
 * - Demo data is IN-MEMORY ONLY
 * - Never written to Postgres
 * - Always marked with demo: true flag
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // In Next.js 15, params is a Promise that needs to be awaited
        const { id } = await context.params;
        const demoMissions = getDemoMissions();

        console.log('[/api/demo/missions/:id] Looking for ID:', id);
        console.log('[/api/demo/missions/:id] Total demo missions:', demoMissions.length);

        // Find the mission by ID
        const mission = demoMissions.find(m => m.id === id);

        if (!mission) {
            console.log('[/api/demo/missions/:id] Mission not found for ID:', id);
            return NextResponse.json(
                {
                    error: 'Demo mission not found',
                    code: 'NOT_FOUND',
                    debug: {
                        requestedId: id,
                        availableCount: demoMissions.length,
                        sampleIds: demoMissions.slice(0, 5).map(m => m.id)
                    }
                },
                { status: 404 }
            );
        }

        console.log('[/api/demo/missions/:id] Found mission:', mission.title);

        // Ensure demo flag is present
        const validatedMission = {
            ...mission,
            demo: true
        };

        return NextResponse.json(validatedMission);
    } catch (error: any) {
        console.error('[API /demo/missions/:id] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to fetch demo mission',
                code: 'DEMO_FETCH_ERROR'
            },
            { status: 500 }
        );
    }
}
