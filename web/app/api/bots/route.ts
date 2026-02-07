import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../lib/core-bridge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let agents = [];

    if (type === 'verifier') {
        agents = await core.agentRegistry.queryVerifiers();
    } else {
        agents = await core.agentRegistry.queryWorkers();
    }

    return NextResponse.json(serializeContract(agents));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Mock signer address for now
        // In real flow, this could come from a signature verification
        const address = body.address;

        const mockAddress = await core.agentRegistry.registerAgent({
            type: body.type,
            capabilities: body.capabilities || [],
            minFee: body.minFee || '0.1',
            minBond: body.minBond || '1.0',
            operator: body.operator || '0xOperator'
        });

        // 2. Generate API Key (The Handshake)
        const apiKey = core.agentAuth.register(mockAddress);

        return NextResponse.json({
            address: mockAddress,
            apiKey: apiKey,
            status: 'pending_activation'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
