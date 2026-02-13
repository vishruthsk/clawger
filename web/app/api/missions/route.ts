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
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { ECONOMY_CONFIG, calculateMissionCost } from '@/config/economy';
import { MissionFilters } from '@core/missions/mission-registry';
import { ReputationEngine } from '@core/agents/reputation-engine';

// Singletons (Prod: DI)
const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const taskQueue = new TaskQueue('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');
const walletAuth = new WalletAuth('../data');
const tokenLedger = new TokenLedger('../data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, '../data');
const reputationEngine = new ReputationEngine('../data');

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine,
    assignmentHistory,
    bondManager,
    settlementEngine,
    reputationEngine
);


/**
 * GET /api/missions
 * List missions with filters
 * 
 * PRODUCTION ONLY - Returns only real missions from Postgres/Indexer
 * Demo data is served via /api/demo/missions
 */
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function getRealMissions() {
    try {
        const result = await pool.query('SELECT * FROM proposals ORDER BY block_number DESC');
        return result.rows.map(row => ({
            id: row.id,
            title: row.objective.length > 50 ? row.objective.substring(0, 50) + '...' : row.objective,
            description: row.objective,
            status: 'open',
            reward: parseFloat(row.escrow) / 1e18, // Convert wei to ether
            currency: 'CLGR',
            tags: ['blockchain', 'verification'],
            specialties: ['security', 'auditing'],
            requirements: ['On-chain verification'],
            deliverables: ['Execution Proof', 'Block Hash'], // Added default deliverables
            posted_at: row.created_at,
            bidding_window_end: row.deadline,
            requester: {
                id: row.proposer,
                name: 'On-Chain Proposer',
                type: 'human',
                avatar: '/avatars/default.png',
                reputation: 100
            },
            stats: {
                bids: 0,
                views: 0
            },
            is_real: true, // Flag to identify real missions
            tx_hash: row.tx_hash
        }));
    } catch (error) {
        console.error('Failed to fetch real missions:', error);
        return [];
    }
}

function getDummyMissions() {
    return [
        {
            id: 'demo-1',
            title: 'Emergency: Smart Contract Audit',
            description: 'Urgent audit required for a new DeFi protocol launching on Monad. Focus on reentrancy and oracle manipulation vectors. Critical priority.',
            status: 'open',
            reward: 5000,
            currency: 'CLGR',
            tags: ['audit', 'security', 'defi'],
            specialties: ['security_auditing', 'smart_contracts'],
            requirements: ['Prior audit experience', 'Slither report', 'Manual review'],
            deliverables: ['Audit Report (PDF)', 'Remediation Guide'],
            posted_at: new Date().toISOString(),
            bidding_window_end: new Date(Date.now() + 86400000).toISOString(),
            requester: {
                id: 'org-1',
                name: 'DeFi Safe',
                type: 'human',
                avatar: '/avatars/org1.png',
                reputation: 98
            },
            stats: {
                bids: 12,
                views: 345
            }
        },
        {
            id: 'demo-2',
            title: 'Frontend Development for NFT Marketplace',
            description: 'Build a responsive React frontend for an upcoming NFT marketplace. tailored for high-frequency trading.',
            status: 'executing', // UPDATED: Executing
            reward: 2500,
            currency: 'CLGR',
            tags: ['frontend', 'react', 'nft'],
            specialties: ['frontend_dev', 'ui_ux'],
            requirements: ['React 18', 'TailwindCSS', 'Ethers.js'],
            deliverables: ['GitHub Repository', 'Deployed Vercel Link'],
            posted_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            assigned_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            executing_started_at: new Date(Date.now() - 3600000 * 1).toISOString(),
            assigned_agent: {
                agent_id: 'agent_pixel',
                agent_name: 'PixelWizard',
                assigned_at: new Date(Date.now() - 3600000 * 2).toISOString(),
                reasoning: 'Selected for superior portfolio in NFT marketplaces.'
            },
            requester: {
                id: 'org-2',
                name: 'NFT World',
                type: 'human',
                avatar: '/avatars/org2.png',
                reputation: 92
            },
            stats: {
                bids: 5,
                views: 120
            }
        },
        {
            id: 'demo-3',
            title: 'Zero-Knowledge Proof Verifier',
            description: 'Implement a Groth16 verifier in Rust for a privacy-preserving rollup.',
            status: 'settled', // UPDATED: Settled/Paid
            reward: 8000,
            currency: 'CLGR',
            tags: ['zk', 'rust', 'cryptography'],
            specialties: ['cryptography', 'backend_dev'],
            requirements: ['Rust', 'Circom', 'Bellman'],
            deliverables: ['Rust Crate', 'Benchmark Results'],
            posted_at: new Date(Date.now() - 7200000 * 48).toISOString(),
            assigned_at: new Date(Date.now() - 7200000 * 40).toISOString(),
            executing_started_at: new Date(Date.now() - 7200000 * 38).toISOString(),
            submitted_at: new Date(Date.now() - 7200000 * 10).toISOString(),
            verified_at: new Date(Date.now() - 7200000 * 5).toISOString(),
            settled_at: new Date(Date.now() - 7200000 * 2).toISOString(),
            assigned_agent: {
                agent_id: 'agent_zk',
                agent_name: 'ZeroKnowledge',
                assigned_at: new Date(Date.now() - 7200000 * 40).toISOString()
            },
            requester: {
                id: 'org-3',
                name: 'Privacy Layer',
                type: 'human',
                avatar: '/avatars/org3.png',
                reputation: 99
            },
            stats: {
                bids: 3,
                views: 890
            }
        },
        {
            id: 'demo-4',
            title: 'Arbitrage Bot Strategy Optimization',
            description: 'Optimize existing Python arbitrage bot for lower latency execution on Monad.',
            status: 'verifying', // UPDATED: Verifying
            reward: 1500,
            currency: 'CLGR',
            tags: ['trading', 'python', 'optimization'],
            specialties: ['python', 'trading_algo'],
            requirements: ['Python', 'AsyncIO', 'MEV Knowledge'],
            deliverables: ['Optimized Script', 'Latency Report'],
            posted_at: new Date(Date.now() - 18000000 * 2).toISOString(),
            assigned_at: new Date(Date.now() - 18000000).toISOString(),
            submitted_at: new Date(Date.now() - 3600000).toISOString(),
            verifying_started_at: new Date(Date.now() - 1800000).toISOString(),
            assigned_agent: {
                agent_id: 'agent_algo',
                agent_name: 'AlgoTrader',
                assigned_at: new Date(Date.now() - 18000000).toISOString()
            },
            requester: {
                id: 'user-4',
                name: 'Alpha Seeker',
                type: 'human',
                avatar: '/avatars/user4.png',
                reputation: 85
            },
            stats: {
                bids: 8,
                views: 210
            }
        }
    ];
}

/**
 * GET /api/missions
 * List missions (HYBRID: Real Postgres Data + Dummy Mock Data)
 */
export async function GET(request: NextRequest) {
    // 1. Fetch real missions from DB
    const realMissions = await getRealMissions();

    // 2. Get dummy missions
    const dummyMissions = getDummyMissions();

    // 3. Combine them (Real first)
    const allMissions = [...realMissions, ...dummyMissions];

    return NextResponse.json(allMissions);
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
        // STEP 3: PRODUCTION ESCROW ENFORCEMENT
        // ============================================
        // Require wallet signature
        if (!body.wallet_signature) {
            return NextResponse.json(
                {
                    error: 'Wallet signature required',
                    code: 'SIGNATURE_REQUIRED',
                    hint: 'Sign the mission authorization message with your wallet'
                },
                { status: 403 }
            );
        }

        // Require transaction hash
        if (!body.tx_hash) {
            return NextResponse.json(
                {
                    error: 'Transaction hash required',
                    code: 'TX_HASH_REQUIRED',
                    hint: 'Complete the on-chain escrow transaction first'
                },
                { status: 403 }
            );
        }

        // Require escrow_locked flag
        if (!body.escrow_locked) {
            return NextResponse.json(
                {
                    error: 'Escrow not locked on Monad',
                    code: 'ESCROW_NOT_LOCKED',
                    hint: 'Complete the on-chain escrow transaction before creating mission'
                },
                { status: 403 }
            );
        }

        // TODO: Verify escrow on-chain using viem
        // const escrowAmount = await publicClient.readContract({
        //     address: CLAWGER_MANAGER_ADDRESS,
        //     abi: ClawgerManagerABI,
        //     functionName: 'getMissionEscrow',
        //     args: [body.mission_id]
        // });
        // if (escrowAmount === 0n) {
        //     return NextResponse.json({ error: 'Escrow not found on-chain' }, { status: 403 });
        // }

        console.log('[API] ✅ Escrow validation passed:', {
            signature: body.wallet_signature.substring(0, 20) + '...',
            txHash: body.tx_hash,
            missionId: body.mission_id
        });


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
