import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { AgentAuth } from '@core/registry/agent-auth';

const agentAuth = new AgentAuth();

/**
 * GET /api/missions/:id/result
 * 
 * Download the result/artifacts for a completed mission.
 * 
 * CRITICAL RULES:
 * - Only requester, worker, or verifier can download
 * - Mission must be completed/verified/settled
 * - Returns mission result data as downloadable file
 * - Enforces strict permission checks
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

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
                    console.log(`[Download] Bot authenticated: ${agent.name} (${agent.address})`);
                }
            }
        }

        // Also check for x-wallet-address header
        if (!userAddress) {
            userAddress = request.headers.get('x-wallet-address')?.toLowerCase() || null;
        }

        if (!userAddress) {
            return NextResponse.json(
                {
                    error: 'Authentication required',
                    code: 'UNAUTHORIZED',
                    message: 'Please authenticate with a wallet or API key to download mission results'
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
                p.objective,
                p.escrow,
                p.status as proposal_status,
                p.created_at,
                t.id as task_id,
                t.worker,
                t.verifier,
                t.status as task_status,
                t.settled,
                t.completed_at
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

        const requester = mission.proposer?.toLowerCase();
        const worker = mission.worker?.toLowerCase();
        const verifier = mission.verifier?.toLowerCase();

        const hasPermission =
            userAddress === requester ||
            userAddress === worker ||
            userAddress === verifier;

        if (!hasPermission) {
            return NextResponse.json(
                {
                    error: 'Permission denied',
                    code: 'FORBIDDEN',
                    message: 'Only the requester, worker, or verifier can download results'
                },
                { status: 403 }
            );
        }

        // ========================================
        // STEP 4: Check Mission Status
        // ========================================

        const validStatuses = ['completed', 'verified', 'settled'];
        const taskStatus = mission.task_status?.toLowerCase() || '';

        if (!validStatuses.includes(taskStatus) && !mission.settled) {
            return NextResponse.json(
                {
                    error: 'Mission not completed',
                    code: 'INVALID_STATE',
                    message: 'Results are only available for completed missions'
                },
                { status: 400 }
            );
        }

        // ========================================
        // STEP 5: Fetch Result Data
        // ========================================

        // In a real implementation, you might have a separate artifacts table
        // For now, we'll construct a result object from the mission data
        const resultData = {
            mission_id: mission.id,
            title: mission.objective?.substring(0, 100) || `Mission #${mission.id}`,
            status: mission.task_status || mission.proposal_status,
            completed_at: mission.completed_at || mission.created_at,
            worker: mission.worker,
            verifier: mission.verifier,
            settled: mission.settled,

            // In production, you'd fetch actual work artifacts here
            // For example, from a separate artifacts table or file storage
            artifacts: [],

            metadata: {
                downloaded_by: userAddress,
                downloaded_at: new Date().toISOString(),
                download_role: userAddress === requester ? 'requester' :
                    userAddress === worker ? 'worker' : 'verifier'
            }
        };

        // TODO: If you have actual artifacts stored in a table, fetch them here:
        // const artifactsResult = await pool.query(
        //     'SELECT * FROM mission_artifacts WHERE mission_id = $1',
        //     [id]
        // );
        // resultData.artifacts = artifactsResult.rows;

        // ========================================
        // STEP 6: Return as Downloadable File
        // ========================================

        const jsonContent = JSON.stringify(resultData, null, 2);
        const filename = `mission_${id}_result.json`;

        return new NextResponse(jsonContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Mission-ID': id.toString(),
                'X-Download-Role': resultData.metadata.download_role
            }
        });

    } catch (error: any) {
        console.error('[API /missions/:id/result] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch mission result',
                code: 'INTERNAL_ERROR',
                details: error.message
            },
            { status: 500 }
        );
    }
}
