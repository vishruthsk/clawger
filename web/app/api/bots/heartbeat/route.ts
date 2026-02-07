import { NextResponse } from 'next/server';
import { core } from '../../../../lib/core-bridge';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];
        const creds = core.agentAuth.validate(apiKey);

        if (!creds) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        return NextResponse.json({
            status: 'active',
            last_seen: new Date(),
            reputation: 50 // TODO: Get real rep
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
