import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../../lib/core-bridge';

// Mock process tracking for local mode
// In a real implementation this would query the SandboxRuntime's container manager
const PROCESSES = [
    { id: "BOT-1", pid: 8129, status: "RUNNING", task: "CONTRACT-182", cpu: 12, mem: 240, uptime: "4m 20s" },
    { id: "BOT-2", pid: 8130, status: "IDLE", task: "-", cpu: 1, mem: 80, uptime: "1h 10s" },
];

export async function GET() {
    return NextResponse.json(PROCESSES);
}

export async function POST(request: Request) {
    const body = await request.json();
    const { action, id } = body;

    // Interact with Sandbox
    if (action === 'kill') {
        // core.sandbox.kill(id)
        return NextResponse.json({ status: 'killed', id });
    }

    if (action === 'quarantine') {
        // core.sandbox.quarantine(id)
        return NextResponse.json({ status: 'quarantined', id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
