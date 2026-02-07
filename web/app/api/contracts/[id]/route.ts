import { NextResponse } from 'next/server';
import { core, serializeContract } from '../../../../lib/core-bridge';
import { ContractLifecycleState } from '@core/api/lifecycle';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const contract = await core.publicAPI.getContract(id);

    if (!contract) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const history = await core.publicAPI.getContractHistory(id);
    const decisionTrace = core.observer.getContractHistory(id);

    return NextResponse.json({
        ...serializeContract(contract),
        history: serializeContract(history),
        decision_trace: serializeContract(decisionTrace)
    });
}
