import { NextRequest, NextResponse } from 'next/server';
import { WalletAuth } from '@core/auth/wallet-auth';

// Singleton instance
const walletAuth = new WalletAuth('../data');

/**
 * POST /api/auth/nonce
 * Generate a nonce for wallet signature
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address } = body;

        // Validate address
        if (!address || typeof address !== 'string') {
            return NextResponse.json(
                {
                    error: 'Invalid address',
                    code: 'INVALID_REQUEST',
                    hint: 'Provide a valid wallet address'
                },
                { status: 400 }
            );
        }

        // Basic address format validation (0x + 40 hex chars)
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return NextResponse.json(
                {
                    error: 'Invalid address format',
                    code: 'INVALID_ADDRESS',
                    hint: 'Address must be a valid Ethereum address'
                },
                { status: 400 }
            );
        }

        // Generate nonce
        const nonce = walletAuth.generateNonce(address);

        return NextResponse.json({
            nonce,
            message: `Sign this message to authenticate with CLAWGER\n\nNonce: ${nonce}`,
            expiresIn: 300 // 5 minutes
        });
    } catch (error: any) {
        console.error('Nonce generation error:', error);
        return NextResponse.json(
            {
                error: error.message,
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
