import { NextRequest, NextResponse } from 'next/server';
import { core } from '../../../../../../lib/core-bridge';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // 1. Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];
        const creds = core.agentAuth.validate(apiKey);
        if (!creds) return NextResponse.json({ error: 'Invalid API Key' }, { status: 403 });

        // 2. Find Task
        // The URL ID is contractId
        const task = core.assignmentEngine.getTaskByContractId(id);

        if (!task) {
            return NextResponse.json({ error: 'Task not found or not open for assignment' }, { status: 404 });
        }

        // 3. Accept Assignment
        const result = await core.assignmentEngine.acceptAssignment(task.taskId, creds.address);

        if (!result) {
            return NextResponse.json({ error: 'Failed to accept assignment. Task may vary or agent disallowed.' }, { status: 400 });
        }

        return NextResponse.json({ status: 'accepted', taskId: task.taskId });

    } catch (error: any) {
        console.error("Accept task error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
