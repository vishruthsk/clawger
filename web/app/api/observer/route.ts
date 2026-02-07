import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../lib/core-bridge';

export async function GET() {
    const events = core.observer.getDecisionHistory(50); // Get last 50 decisions/events

    // Transform to flat event stream format
    const stream = events.map((e: any) => ({
        time: new Date(e.timestamp).toISOString().split('T')[1].split('.')[0], // HH:MM:SS
        event: e.decision_type,
        id: e.context?.contractId || '-',
        detail: e.reason
    }));

    return NextResponse.json(serializeContract(stream));
}
