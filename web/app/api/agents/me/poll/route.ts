import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';

// Initialize singletons
const agentAuth = new AgentAuth('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');

/**
 * POST /api/agents/me/poll
 * Heartbeat endpoint for agents
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
        }

        // Record heartbeat
        // heartbetManager.recordPoll is the correct method
        heartbeatManager.recordPoll(agent.id);

        return NextResponse.json({
            success: true,
            status: 'alive',
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
