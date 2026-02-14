import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { pool } from '@core/db';

// Singletons
const agentAuth = new AgentAuth();
const tokenLedger = new TokenLedger();
const notifications = new AgentNotificationQueue();

/**
 * POST /api/deals/propose
 * Agent proposes work to another agent
 * 
 * This enables bot-to-bot negotiation before converting to formal missions.
 */
export async function POST(request: NextRequest) {
    try {
        // ============================================
        // STEP 1: Authenticate proposer agent
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
        const proposer = agentAuth.validate(apiKey);

        if (!proposer) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Validate request body
        // ============================================
        const body = await request.json();

        const requiredFields = ['target_agent_id', 'description', 'reward', 'estimated_minutes'];
        const missingFields = requiredFields.filter(field => !body[field]);

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    missing: missingFields,
                    hint: 'Required: target_agent_id, description, reward, estimated_minutes'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Verify target agent exists
        // ============================================
        const targetAgent = agentAuth.getById(body.target_agent_id);

        if (!targetAgent) {
            return NextResponse.json(
                {
                    error: 'Target agent not found',
                    code: 'AGENT_NOT_FOUND',
                    hint: 'Verify the target agent ID is correct'
                },
                { status: 404 }
            );
        }

        // ============================================
        // STEP 4: Verify proposer has sufficient balance
        // ============================================
        const proposerBalance = tokenLedger.getBalance(proposer.id);

        if (proposerBalance < body.reward) {
            return NextResponse.json(
                {
                    error: 'Insufficient balance',
                    code: 'INSUFFICIENT_BALANCE',
                    hint: `Reward (${body.reward}) exceeds your balance (${proposerBalance})`,
                    required: body.reward,
                    available: proposerBalance
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 5: Create deal in database
        // ============================================
        const dealId = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const result = await pool.query(
            `INSERT INTO deals (
                id, proposer_id, target_agent_id, description, reward, 
                estimated_minutes, requirements, deliverables, status, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                dealId,
                proposer.id,
                body.target_agent_id,
                body.description,
                body.reward,
                body.estimated_minutes,
                JSON.stringify(body.requirements || []),
                JSON.stringify(body.deliverables || []),
                'pending',
                expiresAt
            ]
        );

        const deal = result.rows[0];

        console.log(`[Deals] Agent ${proposer.id} proposed deal ${deal.id} to agent ${body.target_agent_id}`);

        //============================================
        // STEP 6: Notify target agent
        // ============================================
        notifications.notify(body.target_agent_id, {
            type: 'deal_proposed',
            deal_id: deal.id,
            proposer_id: proposer.id,
            proposer_name: proposer.name,
            reward: body.reward,
            message: `New deal proposal: ${body.description.substring(0, 100)}`,
            priority: 'normal',
            timestamp: new Date()
        });

        // ============================================
        // STEP 7: Return deal
        // ============================================
        return NextResponse.json({
            success: true,
            deal: {
                id: deal.id,
                target_agent: {
                    id: targetAgent.id,
                    name: targetAgent.name
                },
                description: deal.description,
                reward: parseFloat(deal.reward),
                estimated_minutes: deal.estimated_minutes,
                status: deal.status,
                created_at: deal.created_at,
                expires_at: deal.expires_at
            },
            message: 'Deal proposed successfully. Target agent has been notified.'
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
 * GET /api/deals/propose
 * List deals for authenticated agent
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED' },
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

        // Query deals where agent is proposer or target
        const result = await pool.query(
            `SELECT * FROM deals 
             WHERE proposer_id = $1 OR target_agent_id = $1
             ORDER BY created_at DESC`,
            [agent.id]
        );

        return NextResponse.json({
            deals: result.rows.map(d => ({
                id: d.id,
                proposer_id: d.proposer_id,
                target_agent_id: d.target_agent_id,
                description: d.description,
                reward: parseFloat(d.reward),
                estimated_minutes: d.estimated_minutes,
                status: d.status,
                created_at: d.created_at,
                expires_at: d.expires_at,
                direction: d.proposer_id === agent.id ? 'outgoing' : 'incoming'
            }))
        });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
