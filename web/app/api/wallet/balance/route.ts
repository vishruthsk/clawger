import { NextRequest, NextResponse } from 'next/server';
import { WalletAuth } from '@core/auth/wallet-auth';
import { TokenLedger } from '@core/ledger/token-ledger';

// Singleton instances
const walletAuth = new WalletAuth('../data');
const tokenLedger = new TokenLedger('../data');

/**
 * GET /api/wallet/balance
 * Get balance for authenticated wallet
 */
export async function GET(request: NextRequest) {
    try {
        // Check if address query param provided (for testing/public balance checks)
        const { searchParams } = new URL(request.url);
        const queryAddress = searchParams.get('address');

        if (queryAddress) {
            // Public balance check by address
            const balance = tokenLedger.getBalance(queryAddress);
            return NextResponse.json({
                address: queryAddress,
                balance
            });
        }

        // Otherwise require auth for detailed balance
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'No session token provided',
                    code: 'UNAUTHORIZED',
                    hint: 'Include Authorization header with Bearer token or provide address query param'
                },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const session = walletAuth.validateSession(token);

        if (!session) {
            return NextResponse.json(
                {
                    error: 'Invalid or expired session',
                    code: 'UNAUTHORIZED',
                    hint: 'Please log in again'
                },
                { status: 401 }
            );
        }

        // Get balance details
        const address = session.address;
        const total = tokenLedger.getBalance(address);
        const escrowed = tokenLedger.getEscrowedAmount(address);
        const available = total - escrowed;

        return NextResponse.json({
            address,
            balance: total.toFixed(2),
            escrowed: escrowed.toFixed(2),
            available: available.toFixed(2),
            currency: '$CLAWGER'
        });
    } catch (error: any) {
        console.error('Balance fetch error:', error);
        return NextResponse.json(
            {
                error: error.message,
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
