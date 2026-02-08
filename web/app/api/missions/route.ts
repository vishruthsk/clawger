import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { WalletAuth } from '@core/auth/wallet-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { ECONOMY_CONFIG, calculateMissionCost } from '@/config/economy';
import { MissionFilters } from '@core/missions/mission-registry';

// Singletons (Prod: DI)
const agentAuth = new AgentAuth('./data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('./data');
const taskQueue = new TaskQueue('./data');
const heartbeatManager = new HeartbeatManager(agentAuth, './data');
const walletAuth = new WalletAuth('./data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('./data');
const bondManager = new BondManager(tokenLedger, './data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, './data');

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine,
    assignmentHistory,
    bondManager,
    settlementEngine
);


/**
 * GET /api/missions
 * List missions with filters
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const filters: MissionFilters = {
        status: searchParams.get('status') || undefined,
        specialty: searchParams.get('specialty') || undefined,
        min_reward: searchParams.get('min_reward')
            ? parseFloat(searchParams.get('min_reward')!)
            : undefined,
        max_reward: searchParams.get('max_reward')
            ? parseFloat(searchParams.get('max_reward')!)
            : undefined,
        assignment_mode: (searchParams.get('assignment_mode') as 'autopilot' | 'bidding') || undefined,
        requester_id: searchParams.get('requester_id') || undefined,
        type: (searchParams.get('type') as 'crew' | 'solo') || undefined,
        scope: (searchParams.get('scope') as 'all' | 'mine' | 'assigned_to_me') || undefined,
        viewer_id: undefined // Will be set if auth header exists
    };

    // Extract viewer_id from auth header if scope filtering is requested
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // We need a simple way to get address from token without full validation overhead if possible
        // or just use walletAuth
        const session = walletAuth.validateSession(token);
        if (session) {
            filters.viewer_id = session.address;
        }
    }

    const missions = missionRegistry.getMissionBoard(filters);
    return NextResponse.json(missions);
}

/**
 * POST /api/missions
 * Create a new mission (WALLET GATED + ESCROW ENFORCED)
 */
export async function POST(request: NextRequest) {
    try {
        // ============================================
        // STEP 1: Authenticate (DUAL: Wallet OR Agent)
        // ============================================
        const authHeader = request.headers.get('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        let requesterId: string;
        let requesterType: 'human' | 'agent';

        // Try wallet session first
        const session = walletAuth.validateSession(token);
        if (session) {
            requesterId = session.address;
            requesterType = 'human';
        } else {
            // Try agent API key
            const agent = agentAuth.validate(token);
            if (!agent) {
                return NextResponse.json(
                    { error: 'Invalid token', code: 'UNAUTHORIZED' },
                    { status: 401 }
                );
            }
            // CRITICAL: Use wallet_address for balance lookups
            requesterId = agent.wallet_address || agent.id;
            requesterType = 'agent';
        }

        // ============================================
        // STEP 2: Validate request body
        // ============================================
        const body = await request.json();

        if (!body.title || !body.reward) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    hint: 'Required: title, reward, specialties'
                },
                { status: 400 }
            );
        }

        if (!body.specialties || body.specialties.length === 0) {
            return NextResponse.json(
                {
                    error: 'At least one specialty required',
                    code: 'INVALID_REQUEST',
                    hint: 'Provide specialties array with at least one item'
                },
                { status: 400 }
            );
        }

        const reward = parseFloat(body.reward);
        if (isNaN(reward) || reward <= 0) {
            return NextResponse.json(
                {
                    error: 'Invalid reward amount',
                    code: 'INVALID_REQUEST',
                    hint: 'Reward must be a positive number'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Pre-validate balance (reward + protocol fee)
        // ============================================
        const missionCost = calculateMissionCost(reward);
        console.log('[API] Calculated mission cost:', missionCost);
        const available = tokenLedger.getAvailableBalance(requesterId);
        console.log('[API] Available balance for', requesterId, ':', available);

        if (available < missionCost.totalCost) {
            return NextResponse.json(
                {
                    error: `Insufficient funds. You need ${missionCost.totalCost} $CLAWGER (${reward} reward + ${missionCost.platformFee} platform fee).`,
                    code: 'INSUFFICIENT_FUNDS',
                    details: {
                        required: missionCost.totalCost,
                        reward: missionCost.bounty,
                        protocolFee: missionCost.platformFee,
                        available,
                        shortfall: missionCost.totalCost - available
                    }
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 4: Create mission
        // ============================================
        console.log('[API] About to create mission:', { requesterId, requesterType, reward, title: body.title });
        const result = await missionRegistry.createMission({
            requester_id: requesterId, // Use wallet address as requester
            title: body.title,
            description: body.description || '',
            reward,
            specialties: body.specialties,
            requirements: body.requirements || [],
            deliverables: body.deliverables || [],
            tags: body.tags || [],
            deadline: body.deadline ? new Date(body.deadline) : undefined,
            timeout_seconds: body.timeout_seconds,
            force_bidding: body.force_bidding
        });

        const missionId = result.mission.id;

        // ============================================
        // STEP 5: Return success (escrow already locked by MissionRegistry)
        // ============================================
        return NextResponse.json({
            ...result,
            escrow: {
                locked: true,
                amount: reward,
                wallet: requesterId
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('[POST /api/missions] Full error:', error);
        console.error('[POST /api/missions] Stack:', error.stack);
        return NextResponse.json(
            {
                error: error.message,
                code: 'CREATE_ERROR',
                hint: 'Check your request parameters',
                stack: error.stack?.split('\n').slice(0, 5).join('\n')
            },
            { status: 400 }
        );
    }
}
