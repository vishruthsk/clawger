import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { MissionStore } from '@core/missions/mission-store';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { TokenLedger } from '@core/ledger/token-ledger';
import * as fs from 'fs';
import * as path from 'path';

// Singletons
const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const tokenLedger = new TokenLedger('./data');
const escrowEngine = new EscrowEngine(tokenLedger);

// Simplified Deal interface (matching propose endpoint)
interface Deal {
    id: string;
    proposer_id: string;
    target_agent_id: string;
    description: string;
    reward: number;
    estimated_minutes: number;
    requirements?: string[];
    deliverables?: string[];
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    created_at: Date;
    expires_at: Date;
    accepted_at?: Date;
}

// Simple deal store (shares same storage as propose endpoint)
class DealStore {
    private deals: Map<string, Deal> = new Map();
    private dataFile: string;

    constructor(dataDir: string = './data') {
        this.dataFile = path.join(dataDir, 'deals.json');
        this.load();
    }

    private load() {
        if (fs.existsSync(this.dataFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
                data.forEach((deal: any) => {
                    deal.created_at = new Date(deal.created_at);
                    deal.expires_at = new Date(deal.expires_at);
                    if (deal.accepted_at) deal.accepted_at = new Date(deal.accepted_at);
                    this.deals.set(deal.id, deal);
                });
            } catch (error) {
                console.error('[DealStore] Failed to load:', error);
            }
        }
    }

    private save() {
        try {
            const data = Array.from(this.deals.values());
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[DealStore] Failed to save:', error);
        }
    }

    get(id: string): Deal | null {
        return this.deals.get(id) || null;
    }

    update(id: string, updates: Partial<Deal>): Deal | null {
        const deal = this.deals.get(id);
        if (!deal) return null;

        Object.assign(deal, updates);
        this.save();
        return deal;
    }
}

const dealStore = new DealStore('./data');

/**
 * POST /api/deals/:id/accept
 * Accept a proposed deal and convert to mission
 * 
 * Flow:
 * 1. Verify target agent is authenticated
 * 2. Lock proposer's escrow
 * 3. Create mission with agent as requester
 * 4. Auto-assign to acceptor
 * 5. Update deal status
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await context.params;

        // ============================================
        // STEP 1: Authenticate target agent
        // ============================================
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Get deal and validate
        // ============================================
        const deal = dealStore.get(dealId);

        if (!deal) {
            return NextResponse.json(
                { error: 'Deal not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        // Verify agent is the target
        if (deal.target_agent_id !== agent.id) {
            return NextResponse.json(
                {
                    error: 'Not authorized',
                    code: 'FORBIDDEN',
                    hint: 'Only the target agent can accept this deal'
                },
                { status: 403 }
            );
        }

        // Verify deal is pending
        if (deal.status !== 'pending') {
            return NextResponse.json(
                {
                    error: `Deal is ${deal.status}`,
                    code: 'INVALID_STATE',
                    hint: 'Can only accept pending deals'
                },
                { status: 400 }
            );
        }

        // Check if expired
        if (new Date() > deal.expires_at) {
            dealStore.update(dealId, { status: 'expired' });
            return NextResponse.json(
                {
                    error: 'Deal expired',
                    code: 'DEAL_EXPIRED',
                    expired_at: deal.expires_at.toISOString()
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Create mission with proposer as requester
        // ============================================
        const mission = missionStore.create({
            title: `[DEAL] ${deal.description.substring(0, 50)}`,
            description: deal.description,
            reward: deal.reward,
            tags: ['deal', 'agent-to-agent'],
            specialties: [],
            assignment_mode: 'autopilot',
            requester_id: deal.proposer_id, // Proposer is the requester
            requirements: deal.requirements || [],
            deliverables: deal.deliverables || [],
            escrow: {
                locked: false,
                amount: deal.reward
            }
        });

        console.log(`[Deals] Created mission ${mission.id} from deal ${dealId}`);

        // ============================================
        // STEP 4: Lock proposer's escrow
        // ============================================
        const escrowLocked = escrowEngine.lockEscrow(
            deal.proposer_id,
            mission.id,
            deal.reward
        );

        if (!escrowLocked) {
            // Rollback mission creation
            return NextResponse.json(
                {
                    error: 'Failed to lock escrow',
                    code: 'ESCROW_ERROR',
                    hint: 'Proposer may have insufficient balance'
                },
                { status: 400 }
            );
        }

        missionStore.update(mission.id, {
            escrow: {
                locked: true,
                amount: deal.reward,
                locked_at: new Date()
            }
        });

        // ============================================
        // STEP 5: Auto-assign mission to acceptor
        // ============================================
        const proposer = agentAuth.getById(deal.proposer_id);

        missionStore.update(mission.id, {
            status: 'assigned',
            assigned_at: new Date(),
            assigned_agent: {
                agent_id: agent.id,
                agent_name: agent.name,
                assigned_at: new Date(),
                assignment_method: 'manual'
            }
        });

        console.log(`[Deals] Assigned mission ${mission.id} to agent ${agent.id}`);

        // ============================================
        // STEP 6: Update deal status
        // ============================================
        dealStore.update(dealId, {
            status: 'accepted',
            accepted_at: new Date()
        });

        // ============================================
        // STEP 7: Return mission details
        // ============================================
        const updatedMission = missionStore.get(mission.id);

        return NextResponse.json({
            success: true,
            deal_id: dealId,
            mission_id: mission.id,
            mission: updatedMission,
            proposer: {
                id: proposer?.id,
                name: proposer?.name
            },
            message: 'Deal accepted. Mission created and assigned to you.'
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/deals/:id/accept
 * Get deal details
 */
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await context.params;

        const deal = dealStore.get(dealId);

        if (!deal) {
            return NextResponse.json(
                { error: 'Deal not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            deal: {
                id: deal.id,
                proposer_id: deal.proposer_id,
                target_agent_id: deal.target_agent_id,
                description: deal.description,
                reward: deal.reward,
                estimated_minutes: deal.estimated_minutes,
                requirements: deal.requirements,
                deliverables: deal.deliverables,
                status: deal.status,
                created_at: deal.created_at.toISOString(),
                expires_at: deal.expires_at.toISOString(),
                accepted_at: deal.accepted_at?.toISOString()
            }
        });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
