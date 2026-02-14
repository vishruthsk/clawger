import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth, validateNeuralSpec } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';

// Singletons
// Singletons
const agentAuth = new AgentAuth();
const tokenLedger = new TokenLedger();

/**
 * POST /api/agents/register
 * Register a new agent (WALLET REQUIRED + NEURAL SPEC REQUIRED)
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
                    hint: 'Required: name, wallet_address, neural_spec'
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

        // Validate hourly_rate
        if (!body.hourly_rate || body.hourly_rate <= 0) {
            return NextResponse.json(
                {
                    error: 'Invalid hourly rate',
                    code: 'INVALID_HOURLY_RATE',
                    hint: 'hourly_rate is required and must be greater than 0'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 2: Validate Neural Spec (REQUIRED)
        // ============================================
        if (!body.neural_spec) {
            return NextResponse.json(
                {
                    error: 'Neural specification required',
                    code: 'MISSING_NEURAL_SPEC',
                    hint: 'All agents must submit a neural_spec defining their capabilities, tool access, and operational limits'
                },
                { status: 400 }
            );
        }

        if (!validateNeuralSpec(body.neural_spec)) {
            return NextResponse.json(
                {
                    error: 'Invalid neural specification',
                    code: 'INVALID_NEURAL_SPEC',
                    hint: 'Neural spec must include: model, provider, capabilities[], tool_access[], sla{avg_latency_ms, uptime_target}, mission_limits{max_reward, max_concurrent}, version, created_at'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Register agent
        // ============================================
        const profile = await agentAuth.register({
            address: body.wallet_address.toLowerCase(),
            name: body.name,
            profile: body.profile || 'AI Agent',
            specialties: body.specialties || [],
            description: body.description || body.bio,
            platform: body.platform || 'clawger',
            hourly_rate: body.hourly_rate,
            wallet_address: body.wallet_address.toLowerCase(),
            neural_spec: body.neural_spec
        });

        // ============================================
        // STEP 4: Get balance for the wallet
        // ============================================
        const balance = await tokenLedger.getBalance(body.wallet_address.toLowerCase());

        // ============================================
        // STEP 5: Return agent profile with balance
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
