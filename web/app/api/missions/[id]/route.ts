import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { ReputationEngine } from '@core/agents/reputation-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';

// Database Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Singletons
const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const taskQueue = new TaskQueue('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');
const tokenLedger = new TokenLedger('../data');
const escrowEngine = new EscrowEngine(tokenLedger);
const assignmentHistory = new AssignmentHistoryTracker('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const reputationEngine = new ReputationEngine('../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(
    tokenLedger,
    bondManager,
    agentAuth,
    jobHistory,
    '../data'
);

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
            status: 'executing',
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
            status: 'settled',
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
            status: 'verifying',
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
 * GET /api/missions/:id
 * Get mission details with bids and timeline (HYBRID: Postgres + File Store)
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // 1. Try fetching from Postgres (Real Mission)
        try {
            const res = await pool.query('SELECT * FROM proposals WHERE id = $1', [id]);
            if (res.rows.length > 0) {
                const row = res.rows[0];
                const mission = {
                    id: row.id,
                    title: row.objective.length > 50 ? row.objective.substring(0, 50) + '...' : row.objective,
                    description: row.objective,
                    status: 'open',
                    reward: parseFloat(row.escrow) / 1e18,
                    currency: 'CLGR',
                    tags: ['blockchain', 'verification'],
                    specialties: ['security', 'auditing'],
                    requirements: ['On-chain verification'], // Added default requirements
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
                    stats: { bids: 0, views: 0 },
                    is_real: true,
                    tx_hash: row.tx_hash,
                    escrow: {
                        locked: true,
                        amount: parseFloat(row.escrow) / 1e18,
                        tx_hash: row.tx_hash
                    }
                };

                return NextResponse.json({
                    mission,
                    bids: [],
                    timeline: [{
                        status: 'posted',
                        timestamp: row.created_at,
                        description: 'Mission posted on-chain'
                    }],
                    assigned_agent: null,
                    escrow_status: {
                        locked: true,
                        amount: parseFloat(row.escrow) / 1e18,
                        tx_hash: row.tx_hash
                    }
                });
            }
        } catch (pgError) {
            console.warn('Failed to fetch from Postgres, falling back to file store:', pgError);
        }

        // 2. Fallback to File Store (Mock/Legacy Missions)
        const mission = missionRegistry.getMission(id);

        if (!mission) {
            // 3. Try Dummy Missions (Hardcoded)
            const dummyMissions = getDummyMissions();
            const dummy = dummyMissions.find(m => m.id === id);
            if (dummy) {
                return NextResponse.json({
                    mission: dummy,
                    bids: [],
                    timeline: [
                        { status: 'posted', timestamp: dummy.posted_at, description: 'Mission posted' },
                        ...(dummy.assigned_at ? [{ status: 'assigned', timestamp: dummy.assigned_at, description: `Assigned to ${dummy.assigned_agent?.agent_name}` }] : []),
                        ...(dummy.executing_started_at ? [{ status: 'executing', timestamp: dummy.executing_started_at, description: 'Execution started' }] : []),
                        ...(dummy.submitted_at ? [{ status: 'submitted', timestamp: dummy.submitted_at, description: 'Work submitted' }] : []),
                        ...(dummy.settled_at ? [{ status: 'settled', timestamp: dummy.settled_at, description: 'Payment settled' }] : [])
                    ],
                    assigned_agent: dummy.assigned_agent ? {
                        id: dummy.assigned_agent.agent_id,
                        name: dummy.assigned_agent.agent_name,
                        // Add mock details as needed
                        type: 'bot',
                        reputation: 95
                    } : null,
                    escrow_status: {
                        locked: true,
                        amount: dummy.reward,
                        tx_hash: '0x123...mock'
                    }
                });
            }

            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Build timeline from mission status history
        const timeline = [];

        if (mission.posted_at) {
            timeline.push({
                status: 'posted',
                timestamp: mission.posted_at,
                description: 'Mission posted'
            });
        }

        if (mission.bidding_window_end) {
            const biddingEndDate = mission.bidding_window_end instanceof Date
                ? mission.bidding_window_end
                : new Date(mission.bidding_window_end);

            timeline.push({
                status: 'bidding_open',
                timestamp: mission.posted_at,
                description: `Bidding window open until ${biddingEndDate.toISOString()}`
            });
        }

        // ✅ CRITICAL: Assigned - check both top-level and nested assigned_at
        const assignedTimestamp = mission.assigned_at ||
            (typeof mission.assigned_agent === 'object' && mission.assigned_agent?.assigned_at);

        if (assignedTimestamp) {
            let agentName = 'Unknown Agent';

            // ✅ CRITICAL: Handle both legacy (string) and new (object) formats
            if (mission.assigned_agent) {
                if (typeof mission.assigned_agent === 'string') {
                    // Legacy format: assigned_agent is just an ID
                    const agent = agentAuth.getById(mission.assigned_agent);
                    agentName = agent?.name || mission.assigned_agent;
                } else {
                    // New format: assigned_agent is AssignmentDetails object
                    agentName = mission.assigned_agent.agent_name;
                }
            } else if (mission.worker_id) {
                // ✅ CRITICAL: Legacy missions use worker_id instead of assigned_agent
                const agent = agentAuth.getById(mission.worker_id);
                agentName = agent?.name || mission.worker_id;
            }

            timeline.push({
                status: 'assigned',
                timestamp: assignedTimestamp,
                description: `Assigned to ${agentName}`,
                agent: mission.assigned_agent || mission.worker_id
            });
        }

        // ✅ CRITICAL: Executing - check both new and legacy fields
        if (mission.executing_started_at || mission.claimed_at) {
            timeline.push({
                status: 'executing',
                timestamp: mission.executing_started_at || mission.claimed_at,
                description: 'Work in progress'
            });
        }

        // ✅ CRITICAL: Verifying - check both new and legacy fields
        if (mission.verifying_started_at || mission.submitted_at) {
            timeline.push({
                status: 'verifying',
                timestamp: mission.verifying_started_at || mission.submitted_at,
                description: 'Under verification'
            });
        }

        // ✅ CRITICAL: Settled - check both new and legacy fields
        if (mission.settled_at || mission.verified_at) {
            timeline.push({
                status: 'settled',
                timestamp: mission.settled_at || mission.verified_at,
                description: 'Mission completed and verified'
            });
        }

        // ✅ CRITICAL: Paid - legacy field only
        if (mission.paid_at) {
            timeline.push({
                status: 'paid',
                timestamp: mission.paid_at,
                description: 'Payment released'
            });
        }

        if (mission.failed_at) {
            timeline.push({
                status: 'failed',
                timestamp: mission.failed_at,
                description: mission.failure_reason || 'Mission failed'
            });
        }

        // Get assigned agent profile if available
        let assigned_agent_profile = null;
        if (mission.assigned_agent) {
            // ✅ CRITICAL: Handle both legacy (string) and new (object) formats
            if (typeof mission.assigned_agent === 'string') {
                // Legacy format: assigned_agent is just an ID
                assigned_agent_profile = agentAuth.getById(mission.assigned_agent);
            } else {
                // New format: assigned_agent is AssignmentDetails object
                assigned_agent_profile = agentAuth.getById(mission.assigned_agent.agent_id);
            }
        }

        return NextResponse.json({
            mission,
            bids: mission.bids || [],
            timeline,
            assigned_agent: assigned_agent_profile,
            escrow_status: mission.escrow ? {
                locked: mission.escrow.locked,
                amount: mission.escrow.amount,
                tx_hash: mission.escrow.tx_hash
            } : null
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
