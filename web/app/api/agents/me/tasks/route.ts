import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { TaskQueue } from '@core/dispatch/task-queue';

// Initialize singletons
const agentAuth = new AgentAuth('../data');
const taskQueue = new TaskQueue('../data');

/**
 * GET /api/agents/me/tasks
 * Poll for pending tasks assigned to the authenticated agent
 * 
 * Query params:
 * - limit: number (default: 10, max: 50)
 */
export async function GET(request: NextRequest) {
    try {
        // ============================================
        // STEP 1: Authenticate agent
        // ============================================
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Parse query parameters
        // ============================================
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        let limit = 10;

        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (isNaN(parsedLimit) || parsedLimit < 1) {
                return NextResponse.json(
                    { error: 'Invalid limit parameter. Must be a positive integer.' },
                    { status: 400 }
                );
            }
            limit = Math.min(parsedLimit, 50); // Cap at 50
        }

        // ============================================
        // STEP 3: Poll tasks from TaskQueue
        // ============================================
        console.log(`\n[Task Dispatch] ========== POLLING FOR AGENT ${agent.id} (${agent.name}) ==========`);
        console.log(`[Task Dispatch] Limit: ${limit}`);

        const result = taskQueue.poll(agent.id, limit);

        console.log(`[Task Dispatch] Tasks found: ${result.tasks.length}`);
        console.log(`[Task Dispatch] Has more: ${result.has_more}`);

        if (result.tasks.length > 0) {
            console.log(`[Task Dispatch] Task details:`);
            result.tasks.forEach((task, idx) => {
                console.log(`  ${idx + 1}. Type: ${task.type}, Mission: ${task.payload.mission_id || 'N/A'}, Priority: ${task.priority}`);
                console.log(`     Created: ${task.created_at}, Acknowledged: ${task.acknowledged}`);
            });
        } else {
            console.log(`[Task Dispatch] No tasks available for agent ${agent.id}`);
        }

        // ============================================
        // STEP 4: Auto-acknowledge tasks
        // ============================================
        const taskIds = result.tasks.map(t => t.id);
        if (taskIds.length > 0) {
            taskQueue.acknowledge(taskIds);
            console.log(`[Task Dispatch] Acknowledged ${taskIds.length} tasks: ${taskIds.join(', ')}`);
        }

        console.log(`[Task Dispatch] ========== END POLL ==========\n`);

        // ============================================
        // STEP 5: Return tasks
        // ============================================
        return NextResponse.json({
            success: true,
            agent_id: agent.id,
            tasks: result.tasks,
            has_more: result.has_more,
            count: result.tasks.length,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Task Poll] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
