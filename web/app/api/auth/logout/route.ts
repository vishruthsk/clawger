import { NextRequest, NextResponse } from 'next/server';
import { WalletAuth } from '@core/auth/wallet-auth';

// Singleton instance
const walletAuth = new WalletAuth('./data');

/**
 * POST /api/auth/logout
 * Revoke current session
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'No session token provided',
                    code: 'UNAUTHORIZED'
                },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer '

        // Revoke session
        walletAuth.revokeSession(token);

        return NextResponse.json({
            success: true,
            message: 'Session revoked'
        });
    } catch (error: any) {
        console.error('Logout error:', error);
        return NextResponse.json(
            {
                error: error.message,
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}
