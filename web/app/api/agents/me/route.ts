import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { AgentAPI } from '@core/api/agent-api';
import { ReputationEngine } from '@core/agents/reputation-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import path from 'path';

// Initialize singletons
// Initialize singletons
const agentAuth = new AgentAuth();
const notificationQueue = new AgentNotificationQueue();
const agentAPI = new AgentAPI(agentAuth, notificationQueue);
const jobHistory = new JobHistoryManager();
const reputationEngine = new ReputationEngine(jobHistory);



/**
 * Extract Bearer token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.substring(7);
}

/**
 * GET /api/agents/me
 * Get authenticated agent's profile
 */
export async function GET(request: NextRequest) {
    try {
        const apiKey = extractToken(request);
        console.log('[API] /agents/me - Auth check');
        console.log('[API] process.cwd():', process.cwd());
        console.log('[API] Data Dir:', dataDir);
        console.log('[API] API Key provided:', apiKey ? 'YES (len=' + apiKey.length + ')' : 'NO');

        if (!apiKey) {
            console.log('[API] Missing API key');
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'MISSING_AUTH',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const profile = await agentAuth.validate(apiKey);
        console.log('[API] Profile found:', profile ? profile.name : 'NULL');

        if (!profile) {
            console.log('[API] Validation failed for key');
            return NextResponse.json(
                {
                    error: 'Invalid API key',
                    code: 'INVALID_AUTH',
                    hint: 'Check your API key and try again'
                },
                { status: 401 }
            );
        }

        // Calculate real-time reputation breakdown
        const breakdown = await reputationEngine.getReputationBreakdown(profile.id);

        // Get recent job history
        const history = await jobHistory.getHistory(profile.id);
        const recentJobs = history.jobs.slice(0, 10); // Last 10 jobs

        // Return full profile including API key since the user is authenticated with it
        return NextResponse.json({
            ...profile,
            reputation: breakdown.total, // Use real-time total
            reputationBreakdown: breakdown,
            recent_jobs: recentJobs
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to get profile',
                code: 'PROFILE_ERROR'
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/agents/me
 * Update authenticated agent's profile
 */
export async function PATCH(request: NextRequest) {
    try {
        const apiKey = extractToken(request);
        if (!apiKey) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'MISSING_AUTH',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const updatedProfile = agentAPI.updateProfile(apiKey, body);
        if (!updatedProfile) {
            return NextResponse.json(
                {
                    error: 'Invalid API key',
                    code: 'INVALID_AUTH'
                },
                { status: 401 }
            );
        }

        // Return full profile including API key
        return NextResponse.json(updatedProfile);
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Failed to update profile',
                code: 'UPDATE_ERROR',
                hint: 'Check your request parameters'
            },
            { status: 400 }
        );
    }
}
