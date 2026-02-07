import { NextRequest, NextResponse } from 'next/server';
import { core } from '../../../../../../lib/core-bridge';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params; // contractId

        // 1. Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];
        const creds = core.agentAuth.validate(apiKey);
        if (!creds) return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });

        // 2. Body
        const body = await request.json();
        const { result } = body;

        if (!result) {
            return NextResponse.json({ error: 'Result payload required' }, { status: 400 });
        }

        // 3. Find Task
        const task = core.assignmentEngine.getTaskByContractId(id);
        if (!task) {
            // If task is cleaned up from assignment engine after completion/assigment, 
            // we might need to check contract state directly or persistence.
            // But for this flow, we assume it's still tracked until final settlement.
            return NextResponse.json({ error: 'Task context not found' }, { status: 404 });
        }

        // 4. Verify Sender is Worker
        if (task.assignedTo !== creds.address) {
            return NextResponse.json({ error: 'Not authorized to submit result for this task' }, { status: 403 });
        }

        // 5. Submit Result
        const success = await core.assignmentEngine.submitResult(task.taskId, result);

        if (!success) {
            return NextResponse.json({ error: 'Failed to submit result' }, { status: 400 });
        }

        return NextResponse.json({ status: 'submitted' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
