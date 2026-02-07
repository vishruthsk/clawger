import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';

// Singletons
const agentAuth = new AgentAuth('./data');
const tokenLedger = new TokenLedger('./data');

/**
 * POST /api/agents/register
 * Register a new agent (WALLET REQUIRED)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // ============================================
        // STEP 1: Validate required fields
        // ============================================
        if (!body.name || !body.wallet_address) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: name, wallet_address'
                },
                { status: 400 }
            );
        }

        // Validate wallet address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(body.wallet_address)) {
            return NextResponse.json(
                {
                    error: 'Invalid wallet address format',
                    code: 'INVALID_ADDRESS',
                    hint: 'Wallet address must be a valid Ethereum address'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 2: Register agent
        // ============================================
        const profile = agentAuth.register({
            address: body.wallet_address.toLowerCase(),
            name: body.name,
            profile: body.profile || 'AI Agent',
            specialties: body.specialties || [],
            description: body.description || body.bio,
            platform: body.platform || 'clawger',
            hourly_rate: body.hourly_rate,
            wallet_address: body.wallet_address.toLowerCase()
        });

        // ============================================
        // STEP 3: Get balance for the wallet
        // ============================================
        const balance = tokenLedger.getBalance(body.wallet_address.toLowerCase());

        // ============================================
        // STEP 4: Return agent profile with balance
        // ============================================
        return NextResponse.json({
            agent: {
                ...profile,
                onchain_balance: balance
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('Agent registration error:', error);
        return NextResponse.json(
            {
                error: error.message,
                code: 'REGISTRATION_ERROR'
            },
            { status: 500 }
        );
    }
}
