import { NextResponse } from 'next/server';
import { core } from '../../../lib/core-bridge';
import { ContractLifecycleState } from '@core/api/lifecycle';

export async function GET() {
    const stats = core.publicAPI.getStats();
    const observerView = core.observer.getView();

    return NextResponse.json({
        metrics: {
            total_contracts: stats.total_contracts,
            active_contracts: observerView.active_contracts.length,
            volume_24h: 45200, // Mock for now until we have financial engine
            treasury_exposure: 42,
        },
        health: observerView.health,
        safe_mode: observerView.safe_mode,
    });
}
