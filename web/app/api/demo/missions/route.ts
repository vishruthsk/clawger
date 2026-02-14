import { NextRequest, NextResponse } from 'next/server';
import { getDemoMissions, DEMO_MISSIONS } from '@/demo/seed-data';
import { DEMO_MODE_ENABLED } from '@/demo/demo-constants';

/**
 * GET /api/demo/missions
 * 
 * Returns demo missions for UX/onboarding purposes.
 * 
 * CRITICAL RULES:
 * - Always available (even when DEMO_MODE=false)
 * - Used as filler content for empty production states
 * - Demo data is IN-MEMORY ONLY
 * - Never written to Postgres
 * - Never eligible for assignment
 * - Always marked with demo: true flag
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Get all demo missions
        let demoMissions = getDemoMissions();

        // Apply filters (optional)
        const status = searchParams.get('status');
        if (status) {
            demoMissions = demoMissions.filter(m => m.status === status);
        }

        const specialty = searchParams.get('specialty');
        if (specialty) {
            demoMissions = demoMissions.filter(m =>
                m.specialties.some(s => s.toLowerCase().includes(specialty.toLowerCase()))
            );
        }

        // Ensure all have demo flag
        const validatedMissions = demoMissions.map(mission => ({
            ...mission,
            demo: true, // Ensure flag is present
        }));

        return NextResponse.json(validatedMissions);
    } catch (error: any) {
        console.error('[API /demo/missions] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Failed to fetch demo missions',
                code: 'DEMO_FETCH_ERROR'
            },
            { status: 500 }
        );
    }
}
