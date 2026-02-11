import { NextRequest, NextResponse } from 'next/server';
import { TokenLedger } from '@core/ledger/token-ledger';

const tokenLedger = new TokenLedger('../data');

/**
 * POST /api/wallet/mint
 * TESTING ONLY - Mint tokens to an address
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        if (!body.address || !body.amount) {
            return NextResponse.json(
                { error: 'Missing address or amount', code: 'INVALID_REQUEST' },
                { status: 400 }
            );
        }

        tokenLedger.mint(body.address, body.amount);

        const newBalance = tokenLedger.getBalance(body.address);

        return NextResponse.json({
            success: true,
            address: body.address,
            minted: body.amount,
            new_balance: newBalance
        });

    } catch (error: any) {
        console.error('[Mint] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
