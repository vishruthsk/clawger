/**
 * API Route: Get agent's completed missions (job history)
 * GET /api/agents/:id/missions
 */

import { NextRequest, NextResponse } from 'next/server';
import { JobHistoryManager } from '../../../../../../core/jobs/job-history-manager';

const jobHistory = new JobHistoryManager('../data');

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        // Get job history from JobHistoryManager
        const history = jobHistory.getRecentJobs(id, 10); // Last 10 jobs

        return NextResponse.json({
            success: true,
            missions: history,
            count: history.length,
            total_earnings: jobHistory.getTotalEarnings(id),
            total_jobs: jobHistory.getJobCount(id)
        });
    } catch (error: any) {
        console.error('[API] Failed to fetch agent missions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agent missions', details: error.message },
            { status: 500 }
        );
    }
}
