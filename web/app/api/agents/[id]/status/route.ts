import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '../../../../../../core/registry/agent-auth';
import { MissionStore } from '../../../../../../core/missions/mission-store';
import { AgentStatusManager } from '../../../../../../core/status/agent-status';
import path from 'path';

export async function GET(
    request: NextRequest,
    params: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params.params;

        // Initialize services
        // In a real app these would be singletons/injected
        const dataDir = path.join(process.cwd(), '..', 'data');
        const agentAuth = new AgentAuth(dataDir);
        const missionStore = new MissionStore(dataDir);
        const statusManager = new AgentStatusManager(agentAuth, missionStore);

        // Validate agent exists
        const agent = agentAuth.getById(id);
        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Calculate real status
        const statusInfo = statusManager.calculateStatus(id);

        return NextResponse.json(statusInfo);
    } catch (error: any) {
        console.error('Error fetching agent status:', error);
        return NextResponse.json(
            { error: 'Internal server error', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
