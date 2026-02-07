import { NextRequest, NextResponse } from 'next/server';
import { WalletAuth } from '@core/auth/wallet-auth';

// Singleton instance
const walletAuth = new WalletAuth('./data');

/**
 * POST /api/auth/verify
 * Verify wallet signature and create session
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { address, signature, nonce } = body;

        // Validate inputs
        if (!address || !signature || !nonce) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Provide address, signature, and nonce'
                },
                { status: 400 }
            );
        }

        // Verify signature
        const isValid = walletAuth.verifySignature(address, signature, nonce);

        if (!isValid) {
            return NextResponse.json(
                {
                    error: 'Invalid signature',
                    code: 'INVALID_SIGNATURE',
                    hint: 'Signature verification failed. Request a new nonce and try again.'
                },
                { status: 401 }
            );
        }

        // Create session
        const { token, expiresAt } = walletAuth.createSession(address);

        return NextResponse.json({
            token,
            expiresAt: expiresAt.toISOString(),
            address: address.toLowerCase()
        });
    } catch (error: any) {
        console.error('Signature verification error:', error);
        return NextResponse.json(
            {
                error: error.message,
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
