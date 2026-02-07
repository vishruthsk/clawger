import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../lib/core-bridge';
import { ProposalRequest } from '@core/api/public-api';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const contracts = await core.publicAPI.listContracts(
        status ? { state: [status as any] } : undefined
    );

    return NextResponse.json(serializeContract(contracts));
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Mock Identity for now (Human-1)
        const identity = {
            type: 'HUMAN' as const,
            wallet_address: '0xHuman123456789',
            capabilities: ['submit_contract', 'view_status'],
            verified: true,
            created_at: new Date()
        };

        const proposal: ProposalRequest = {
            objective: body.objective,
            budget: body.budget,
            // Calculate constraints from risk tolerance if not provided
            risk_tolerance: body.risk_tolerance || 'low',
            deadline: new Date(Date.now() + (body.deadline_hours || 24) * 3600 * 1000),
            constraints: body.constraints || [],
            max_retries: 3
        };

        const contract = await core.publicAPI.submitProposal(identity, proposal);

        return NextResponse.json(serializeContract(contract));
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
