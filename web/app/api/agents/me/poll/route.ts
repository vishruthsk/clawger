import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';

// Singletons
const agentAuth = new AgentAuth('./data');
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');

/**
 * POST /api/agents/me/poll
 * Agent polling endpoint for task dispatch (like Openwork heartbeat)
 */
export async function POST(request: NextRequest) {
    try {
        // ============================================
        // STEP 1: Authenticate agent
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
        // STEP 2: Parse request body
        // ============================================
        const body = await request.json().catch(() => ({}));
        const limit = body.limit || 10;
        const ack_tasks = body.ack_tasks || [];

        // ============================================
        // STEP 3: Record heartbeat
        // ============================================
        heartbeatManager.recordPoll(agent.id);

        // ============================================
        // STEP 4: Acknowledge previous tasks
        // ============================================
        if (ack_tasks.length > 0) {
            const acknowledged = taskQueue.acknowledge(ack_tasks);
            if (acknowledged > 0) {
                heartbeatManager.recordAck(agent.id, ack_tasks[0]);
            }
        }

        // ============================================
        // STEP 5: Poll for pending tasks
        // ============================================
        const result = taskQueue.poll(agent.id, limit);

        // ============================================
        // STEP 6: Return tasks with metadata
        // ============================================
        return NextResponse.json({
            tasks: result.tasks,
            has_more: result.has_more,
            next_poll_seconds: 30,  // Recommended polling interval
            heartbeat: {
                is_active: heartbeatManager.isActive(agent.id),
                last_poll: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('[Poll] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
