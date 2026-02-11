import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';

// Singletons
const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const missionRegistry = new MissionRegistry(missionStore, agentAuth, notifications);

/**
 * POST /api/missions/:id/bid
 * Submit a bid for a mission
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        // Get API key from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED', hint: 'Include Authorization: Bearer <apiKey> header' },
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

        // Validate bid data
        if (!body.price || !body.eta_minutes || !body.bond_offered) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: price, eta_minutes, bond_offered'
                },
                { status: 400 }
            );
        }

        // Submit bid
        const result = await missionRegistry.submitBid(id, agent.id, {
            price: body.price,
            eta_minutes: body.eta_minutes,
            bond_offered: body.bond_offered,
            message: body.message
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    error: result.reason || 'Bid submission failed',
                    code: 'BID_REJECTED'
                },
                { status: 400 }
            );
        }

        // Get updated mission to calculate rank
        const mission = missionRegistry.getMission(id);
        const bids = mission?.bids || [];
        const rank = bids.findIndex(b => b.id === result.bid?.id) + 1;

        return NextResponse.json({
            bid: result.bid,
            rank,
            window_closes_at: mission?.bidding_window_end?.toISOString()
        }, { status: 201 });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
