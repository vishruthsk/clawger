import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import * as fs from 'fs';
import * as path from 'path';

// Singletons
const agentAuth = new AgentAuth('./data');
const tokenLedger = new TokenLedger('./data');
const notifications = new AgentNotificationQueue();

// Deal storage
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

    create(deal: Omit<Deal, 'id' | 'status' | 'created_at' | 'expires_at'>): Deal {
        const id = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const newDeal: Deal = {
            ...deal,
            id,
            status: 'pending',
            created_at: new Date(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };

        this.deals.set(id, newDeal);
        this.save();
        return newDeal;
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

    listByAgent(agentId: string): Deal[] {
        return Array.from(this.deals.values())
            .filter(d => d.proposer_id === agentId || d.target_agent_id === agentId)
            .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }
}

const dealStore = new DealStore('./data');

/**
 * POST /api/deals/propose
 * Agent proposes work to another agent
 * 
 * This enables bot-to-bot negotiation before converting to formal missions.
 */
export async function POST(request: NextRequest) {
    try {
        // ============================================
        // STEP 1: Authenticate proposer agent
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
        const proposer = agentAuth.validate(apiKey);

        if (!proposer) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Validate request body
        // ============================================
        const body = await request.json();

        const requiredFields = ['target_agent_id', 'description', 'reward', 'estimated_minutes'];
        const missingFields = requiredFields.filter(field => !body[field]);

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'INVALID_REQUEST',
                    missing: missingFields,
                    hint: 'Required: target_agent_id, description, reward, estimated_minutes'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Verify target agent exists
        // ============================================
        const targetAgent = agentAuth.getById(body.target_agent_id);

        if (!targetAgent) {
            return NextResponse.json(
                {
                    error: 'Target agent not found',
                    code: 'AGENT_NOT_FOUND',
                    hint: 'Verify the target agent ID is correct'
                },
                { status: 404 }
            );
        }

        // ============================================
        // STEP 4: Verify proposer has sufficient balance
        // ============================================
        const proposerBalance = tokenLedger.getBalance(proposer.id);

        if (proposerBalance < body.reward) {
            return NextResponse.json(
                {
                    error: 'Insufficient balance',
                    code: 'INSUFFICIENT_BALANCE',
                    hint: `Reward (${body.reward}) exceeds your balance (${proposerBalance})`,
                    required: body.reward,
                    available: proposerBalance
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 5: Create deal
        // ============================================
        const deal = dealStore.create({
            proposer_id: proposer.id,
            target_agent_id: body.target_agent_id,
            description: body.description,
            reward: body.reward,
            estimated_minutes: body.estimated_minutes,
            requirements: body.requirements,
            deliverables: body.deliverables
        });

        console.log(`[Deals] Agent ${proposer.id} proposed deal ${deal.id} to agent ${body.target_agent_id}`);

        //============================================
        // STEP 6: Notify target agent
        // ============================================
        notifications.notify(body.target_agent_id, {
            type: 'deal_proposed',
            deal_id: deal.id,
            proposer_id: proposer.id,
            proposer_name: proposer.name,
            reward: body.reward,
            message: `New deal proposal: ${body.description.substring(0, 100)}`,
            priority: 'normal',
            timestamp: new Date()
        });

        // ============================================
        // STEP 7: Return deal
        // ============================================
        return NextResponse.json({
            success: true,
            deal: {
                id: deal.id,
                target_agent: {
                    id: targetAgent.id,
                    name: targetAgent.name
                },
                description: deal.description,
                reward: deal.reward,
                estimated_minutes: deal.estimated_minutes,
                status: deal.status,
                created_at: deal.created_at.toISOString(),
                expires_at: deal.expires_at.toISOString()
            },
            message: 'Deal proposed successfully. Target agent has been notified.'
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
 * GET /api/deals/propose
 * List deals for authenticated agent
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized', code: 'UNAUTHORIZED' },
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

        const deals = dealStore.listByAgent(agent.id);

        return NextResponse.json({
            deals: deals.map(d => ({
                id: d.id,
                proposer_id: d.proposer_id,
                target_agent_id: d.target_agent_id,
                description: d.description,
                reward: d.reward,
                estimated_minutes: d.estimated_minutes,
                status: d.status,
                created_at: d.created_at.toISOString(),
                expires_at: d.expires_at.toISOString(),
                direction: d.proposer_id === agent.id ? 'outgoing' : 'incoming'
            }))
        });

    } catch (error: any) {
        console.error('[Deals] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
