import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { AgentAuth } from '@core/registry/agent-auth';

const agentAuth = new AgentAuth();

/**
 * POST /api/missions/:id/rate
 * 
 * Submit a rating for a completed mission.
 * 
 * CRITICAL RULES:
 * - Only the mission requester can rate
 * - Mission must be completed/settled
 * - Rating stored in Postgres job_reviews table
 * - Agent reputation updated in agents table
 * - Worker/verifier cannot self-rate
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { score, review } = body;

        // Validate score
        if (!score || score < 1 || score > 5) {
            return NextResponse.json(
                { error: 'Invalid score. Must be between 1 and 5.' },
                { status: 400 }
            );
        }

        // ========================================
        // STEP 1: Extract User Identity
        // ========================================
        const authHeader = request.headers.get('authorization');
        let userAddress: string | null = null;

        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            // Check if it's a wallet address
            if (token.match(/^0x[a-fA-F0-9]{40}$/)) {
                userAddress = token.toLowerCase();
            }
            // Check if it's a bot API key
            else if (token.startsWith('claw_sk_')) {
                const agent = await agentAuth.validate(token);
                if (agent) {
                    userAddress = agent.address.toLowerCase();
                    console.log(`[Rating] Bot authenticated: ${agent.name} (${agent.address})`);
                }
            }
        }

        // Also check for x-wallet-address header (ONLY in development)
        // In production, this header is disabled for security
        if (!userAddress && process.env.NODE_ENV !== 'production') {
            userAddress = request.headers.get('x-wallet-address')?.toLowerCase() || null;
            if (userAddress) {
                console.warn('[Rating] Using x-wallet-address header (DEVELOPMENT ONLY)');
            }
        }

        // TODO: In production, implement proper JWT/session authentication
        // Example: Verify signed message from wallet or validate session token

        if (!userAddress) {
            return NextResponse.json(
                {
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED',
                    message: 'Please connect your wallet or provide a valid API key to rate missions'
                },
                { status: 401 }
            );
        }

        // ========================================
        // STEP 2: Fetch Mission Data
        // ========================================
        const missionResult = await pool.query(`
            SELECT 
                p.id,
                p.proposer,
                p.status as proposal_status,
                t.id as task_id,
                t.worker,
                t.verifier,
                t.status as task_status,
                t.settled
            FROM proposals p
            LEFT JOIN tasks t ON p.id = t.proposal_id
            WHERE p.id = $1::integer
        `, [id]);

        if (missionResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const mission = missionResult.rows[0];

        // ========================================
        // STEP 3: Enforce Permissions
        // ========================================

        // Only the requester can rate
        if (mission.proposer.toLowerCase() !== userAddress) {
            return NextResponse.json(
                {
                    error: 'Permission denied',
                    code: 'FORBIDDEN',
                    message: 'Only the mission requester can submit ratings'
                },
                { status: 403 }
            );
        }

        // Mission must have a task (be assigned)
        if (!mission.task_id || !mission.worker) {
            return NextResponse.json(
                {
                    error: 'Mission not assigned',
                    code: 'INVALID_STATE',
                    message: 'Cannot rate a mission that has no assigned worker'
                },
                { status: 400 }
            );
        }

        // Mission must be completed or settled
        const validStatuses = ['completed', 'verified', 'settled'];
        const taskStatus = mission.task_status?.toLowerCase() || '';

        if (!validStatuses.includes(taskStatus) && !mission.settled) {
            return NextResponse.json(
                {
                    error: 'Mission not completed',
                    code: 'INVALID_STATE',
                    message: 'Can only rate completed or settled missions'
                },
                { status: 400 }
            );
        }

        // ========================================
        // STEP 4: Check if Rating Already Exists
        // ========================================
        const existingRating = await pool.query(
            'SELECT rating FROM job_reviews WHERE mission_id = $1 AND agent_id = $2',
            [id, mission.worker]
        );

        const isNewRating = existingRating.rows.length === 0;

        // ========================================
        // STEP 5: Store Rating in job_reviews
        // ========================================
        if (isNewRating) {
            // Insert new rating
            await pool.query(`
                INSERT INTO job_reviews (mission_id, agent_id, rating, review, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
            `, [id, mission.worker, score, review || null]);
        } else {
            // Update existing rating (no reputation change)
            await pool.query(`
                UPDATE job_reviews 
                SET rating = $1, review = $2, updated_at = NOW()
                WHERE mission_id = $3 AND agent_id = $4
            `, [score, review || null, id, mission.worker]);
        }

        // ========================================
        // STEP 6: Update Agent Reputation (ONLY on new ratings)
        // ========================================
        let reputationChange = 0;
        let newRep = null;

        if (isNewRating) {
            // Fetch current reputation
            const agentResult = await pool.query(
                'SELECT reputation FROM agents WHERE address = $1',
                [mission.worker]
            );

            let currentRep = 50; // Default if agent not found
            if (agentResult.rows.length > 0) {
                currentRep = agentResult.rows[0].reputation;
            }

            // Calculate reputation change
            if (score >= 4) {
                reputationChange = 2; // Good rating
            } else if (score <= 2) {
                reputationChange = -2; // Poor rating
            }
            // score === 3 has no change (neutral)

            newRep = Math.max(0, Math.min(100, currentRep + reputationChange));

            // Update agent reputation
            await pool.query(
                'UPDATE agents SET reputation = $1, updated_at = NOW() WHERE address = $2',
                [newRep, mission.worker]
            );

            console.log(`[Rating] NEW rating for mission ${id}: ${mission.worker} reputation ${currentRep} -> ${newRep} (score: ${score})`);
        } else {
            // Fetch current reputation for response (no change)
            const agentResult = await pool.query(
                'SELECT reputation FROM agents WHERE address = $1',
                [mission.worker]
            );
            newRep = agentResult.rows.length > 0 ? agentResult.rows[0].reputation : 50;

            console.log(`[Rating] UPDATED rating for mission ${id}: reputation unchanged at ${newRep} (score: ${score})`);
        }

        return NextResponse.json({
            success: true,
            message: isNewRating ? 'Rating submitted successfully' : 'Rating updated successfully',
            data: {
                mission_id: id,
                agent_id: mission.worker,
                rating: score,
                reputation_change: reputationChange,
                new_reputation: newRep,
                is_new_rating: isNewRating
            }
        });

    } catch (error: any) {
        console.error('[API /missions/:id/rate] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to submit rating',
                code: 'INTERNAL_ERROR',
                details: error.message
            },
            { status: 500 }
        );
    }
}
