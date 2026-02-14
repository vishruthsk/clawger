import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { MissionStore } from '@core/missions/mission-store';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { TokenLedger } from '@core/ledger/token-ledger';
import { pool } from '@core/db';

// Singletons
const agentAuth = new AgentAuth();
const missionStore = new MissionStore();
const tokenLedger = new TokenLedger();
const escrowEngine = new EscrowEngine(tokenLedger);

/**
 * POST /api/deals/:id/accept
 * Accept a proposed deal and convert to mission
 * 
 * Flow:
 * 1. Verify target agent is authenticated
 * 2. Lock proposer's escrow
 * 3. Create mission with agent as requester
 * 4. Auto-assign to acceptor
 * 5. Update deal status
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await context.params;

        // ============================================
        // STEP 1: Authenticate target agent
        // ============================================
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Get deal from database and validate
        // ============================================
        const result = await pool.query(
            `SELECT * FROM deals WHERE id = $1`,
            [dealId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Deal not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const deal = result.rows[0];

        // Verify agent is the target
        if (deal.target_agent_id !== agent.id) {
            return NextResponse.json(
                {
                    error: 'Not authorized',
                    code: 'FORBIDDEN',
                    hint: 'Only the target agent can accept this deal'
                },
                { status: 403 }
            );
        }

        // Verify deal is pending
        if (deal.status !== 'pending') {
            return NextResponse.json(
                {
                    error: `Deal is ${deal.status}`,
                    code: 'INVALID_STATE',
                    hint: 'Can only accept pending deals'
                },
                { status: 400 }
            );
        }

        // Check if expired
        if (new Date() > new Date(deal.expires_at)) {
            await pool.query(
                `UPDATE deals SET status = $1 WHERE id = $2`,
                ['expired', dealId]
            );
            return NextResponse.json(
                {
                    error: 'Deal expired',
                    code: 'DEAL_EXPIRED',
                    expired_at: deal.expires_at
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Create mission with proposer as requester
        // ============================================
        const mission = missionStore.create({
            title: `[DEAL] ${deal.description.substring(0, 50)}`,
            description: deal.description,
            reward: parseFloat(deal.reward),
            tags: ['deal', 'agent-to-agent'],
            specialties: [],
            assignment_mode: 'autopilot',
            requester_id: deal.proposer_id, // Proposer is the requester
            requirements: deal.requirements || [],
            deliverables: deal.deliverables || [],
            escrow: {
                locked: false,
                amount: parseFloat(deal.reward)
            }
        });

        console.log(`[Deals] Created mission ${mission.id} from deal ${dealId}`);

        // ============================================
        // STEP 4: Lock proposer's escrow
        // ============================================
        const escrowLocked = escrowEngine.lockEscrow(
            deal.proposer_id,
            mission.id,
            parseFloat(deal.reward)
        );

        if (!escrowLocked) {
            // Rollback mission creation
            return NextResponse.json(
                {
                    error: 'Failed to lock escrow',
                    code: 'ESCROW_ERROR',
                    hint: 'Proposer may have insufficient balance'
                },
                { status: 400 }
            );
        }

        missionStore.update(mission.id, {
            escrow: {
                locked: true,
                amount: parseFloat(deal.reward),
                locked_at: new Date()
            }
        });

        // ============================================
        // STEP 5: Auto-assign mission to acceptor
        // ============================================
        const proposer = agentAuth.getById(deal.proposer_id);

        missionStore.update(mission.id, {
            status: 'assigned',
            assigned_at: new Date(),
            assigned_agent: {
                agent_id: agent.id,
                agent_name: agent.name,
                assigned_at: new Date(),
                assignment_method: 'manual'
            }
        });

        console.log(`[Deals] Assigned mission ${mission.id} to agent ${agent.id}`);

        // ============================================
        // STEP 6: Update deal status in database
        // ============================================
        await pool.query(
            `UPDATE deals SET status = $1, accepted_at = NOW() WHERE id = $2`,
            ['accepted', dealId]
        );

        // ============================================
        // STEP 7: Return mission details
        // ============================================
        const updatedMission = missionStore.get(mission.id);

        return NextResponse.json({
            success: true,
            deal_id: dealId,
            mission_id: mission.id,
            mission: updatedMission,
            proposer: {
                id: proposer?.id,
                name: proposer?.name
            },
            message: 'Deal accepted. Mission created and assigned to you.'
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/deals/:id/accept
 * Get deal details
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await context.params;

        const result = await pool.query(
            `SELECT * FROM deals WHERE id = $1`,
            [dealId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Deal not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        const deal = result.rows[0];

        return NextResponse.json({
            deal: {
                id: deal.id,
                proposer_id: deal.proposer_id,
                target_agent_id: deal.target_agent_id,
                description: deal.description,
                reward: parseFloat(deal.reward),
                estimated_minutes: deal.estimated_minutes,
                requirements: deal.requirements,
                deliverables: deal.deliverables,
                status: deal.status,
                created_at: deal.created_at,
                expires_at: deal.expires_at,
                accepted_at: deal.accepted_at
            }
        });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
