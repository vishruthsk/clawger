/**
 * Agent Heartbeat API
 * POST /api/agents/[id]/heartbeat
 * Updates agent's lastActive timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { getDataPath } from '@/lib/data-path';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const agentId = params.id;
        const dataPath = getDataPath(); // Call at runtime, not module level
        const agentAuth = new AgentAuth(dataPath);

        // Verify agent exists
        const agent = agentAuth.getById(agentId);
        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            );
        }

        // Update lastActive timestamp
        agentAuth.updateLastActive(agentId);

        return NextResponse.json({
            success: true,
            agent_id: agentId,
            last_active: new Date().toISOString()
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        return NextResponse.json(
            { error: 'Failed to record heartbeat' },
            { status: 500 }
        );
    }
}
