import * as fs from 'fs';
import * as path from 'path';

export type MissionStatus =
    | 'posted'           // Initial state
    | 'bidding_open'     // Accepting bids
    | 'assigned'         // Agent assigned
    | 'executing'        // Work in progress
    | 'verifying'        // Under verification
    | 'settled'          // Completed and paid
    | 'failed'           // Failed or rejected
    // Legacy states for backward compatibility
    | 'open' | 'claimed' | 'submitted' | 'verified' | 'rejected' | 'paid';

export type AssignmentMode = 'autopilot' | 'bidding';

export interface Bid {
    id: string;
    agent_id: string;
    agent_name: string;
    price: number;           // In $CLAWGER
    eta_minutes: number;     // Estimated completion time
    bond_offered: number;    // Bond willing to stake
    message?: string;        // Optional pitch
    submitted_at: Date;
    score?: number;          // Calculated by bidding engine
}

export interface AssignmentDetails {
    agent_id: string;
    agent_name: string;
    assigned_at: Date;
    assignment_method: 'autopilot' | 'bidding' | 'manual';
    bid_id?: string;         // If assigned via bidding
}

export interface EscrowStatus {
    locked: boolean;
    amount: number;          // In $CLAWGER
    tx_hash?: string;
    locked_at?: Date;
    released_at?: Date;
}

export interface Mission {
    id: string;
    title: string;
    description: string;
    reward: number;                      // $CLAWGER
    status: MissionStatus;
    tags: string[];
    specialties: string[];               // Required agent specialties

    // Assignment
    assignment_mode: AssignmentMode;
    assigned_agent?: AssignmentDetails;

    // Bidding (if assignment_mode === 'bidding')
    bidding_window_seconds?: number;     // Default 60
    bidding_window_end?: Date;
    bids?: Bid[];

    // Escrow
    escrow: EscrowStatus;

    // Lifecycle timestamps
    posted_at: Date;
    assigned_at?: Date;
    executing_started_at?: Date;
    verifying_started_at?: Date;
    settled_at?: Date;
    failed_at?: Date;

    // Legacy fields (backward compatibility)
    claimed_at?: Date;
    claimed_by?: string;
    submitted_at?: Date;
    verified_at?: Date;
    paid_at?: Date;

    // Actors
    requester_id: string;                // "human" or agent_id

    // Configuration
    deadline?: Date;
    timeout_seconds?: number;            // Auto-fail if not submitted in time
    crew_required?: boolean;             // Multi-agent coordination

    // Crew Mission Fields (only populated if crew_required === true)
    crew_config?: {
        min_agents: number;
        max_agents: number;
        required_roles: string[];
        coordination_mode: 'sequential' | 'parallel' | 'hybrid';
    };
    task_graph?: {
        nodes: { [key: string]: any };   // SubTask nodes (JSON serializable)
        edges: { [key: string]: string[] }; // Dependencies
    };
    crew_assignments?: {
        agent_id: string;
        agent_name: string;
        role: string;
        current_tasks: string[];
        joined_at: Date;
        status: 'active' | 'idle' | 'dropped';
    }[];
    mission_artifacts?: {
        id: string;
        subtask_id: string;
        agent_id: string;
        url: string;
        type: string;
        uploaded_at: Date;
        metadata: Record<string, any>;
        description?: string;
    }[];
    event_stream?: {
        id: string;
        type: string;
        timestamp: Date;
        agent_id?: string;
        subtask_id?: string;
        details: Record<string, any>;
    }[];
    blockers?: {
        id: string;
        agent_id: string;
        subtask_id: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        reported_at: Date;
        resolved: boolean;
        resolved_at?: Date;
        resolution?: string;
    }[];

    // Data
    requirements: string[];              // List of specific requirements
    deliverables: string[];              // Expected outputs

    // Work submission
    submission?: {
        content: string;
        artifacts: string[];             // Links to proof
        submitted_at: Date;
    };

    // Verification
    verification?: {
        verifier_id: string;
        approved: boolean;
        feedback: string;
        verified_at: Date;
    };

    // Failure details
    failure_reason?: string;
    bond_slashed?: number;
}

export class MissionStore {
    private missions: Map<string, Mission> = new Map();
    private readonly dataDir: string;
    private readonly dataFile: string;

    constructor(dataDir: string = './data') {
        this.dataDir = dataDir;
        this.dataFile = path.join(dataDir, 'missions.json');
        this.load();
    }

    private load() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (fs.existsSync(this.dataFile)) {
            try {
                const rawData = fs.readFileSync(this.dataFile, 'utf-8');
                const data = JSON.parse(rawData);

                // Hydrate dates
                for (const item of data) {
                    item.posted_at = new Date(item.posted_at);
                    if (item.claimed_at) item.claimed_at = new Date(item.claimed_at);
                    if (item.submitted_at) item.submitted_at = new Date(item.submitted_at);
                    if (item.verified_at) item.verified_at = new Date(item.verified_at);
                    if (item.paid_at) item.paid_at = new Date(item.paid_at);

                    this.missions.set(item.id, item);
                }
            } catch (error) {
                console.error('Failed to load missions:', error);
            }
        }

        // Seed mocks if empty
        if (this.missions.size === 0) {
            this.seedMocks();
        }
    }

    private seedMocks() {
        const mocks: Mission[] = [
            {
                id: 'mission_genesis_01',
                title: 'Deploy CLAWGER Protocol V1',
                description: 'Initial deployment and verification of the core protocol contracts.',
                requirements: ['Solidity', 'Security Audit'],
                deliverables: ['Deployed Address', 'Verification Proof'],
                reward: 5000,
                status: 'paid',
                assignment_mode: 'autopilot',
                requester_id: 'system',
                posted_at: new Date(Date.now() - 86400000 * 5), // 5 days ago
                escrow: { locked: true, amount: 5000 },
                tags: ['protocol', 'critical'],
                specialties: ['Smart Contracts'],
                worker_id: 'agent_claw_001',
                assigned_at: new Date(Date.now() - 86400000 * 4),
                verified_at: new Date(Date.now() - 86400000 * 2),
                paid_at: new Date(Date.now() - 86400000 * 1)
            } as any, // Lazy casting for mock
            {
                id: 'mission_data_02',
                title: 'Scrape Competitor Pricing',
                description: 'Analyze pricing models of top 5 competitors and structuralize data.',
                reward: 450,
                status: 'executing',
                assignment_mode: 'autopilot',
                requester_id: 'human_buyer_01',
                posted_at: new Date(Date.now() - 3600000 * 2),
                escrow: { locked: true, amount: 450 },
                tags: ['data', 'scraping'],
                specialties: ['Data Analysis'],
                worker_id: 'agent_claw_007',
                assigned_agent: {
                    agent_id: 'agent_claw_007',
                    agent_name: 'DataMiner X',
                    assigned_at: new Date(),
                    assignment_method: 'autopilot'
                },
                requirements: [], deliverables: []
            } as any,
            {
                id: 'mission_design_03',
                title: 'Generate Marketing Assets',
                description: 'Create a suite of social media banners for the Q1 campaign.',
                reward: 1200,
                status: 'open',
                assignment_mode: 'bidding',
                requester_id: 'human_marketing',
                posted_at: new Date(Date.now() - 1800000),
                escrow: { locked: true, amount: 1200 },
                tags: ['design', 'creative'],
                specialties: ['Graphic Design'],
                requirements: [], deliverables: []
            } as any,
            {
                id: 'mission_audit_04',
                title: 'Security Vulnerability Scan',
                description: 'Run automated penetration tests on the staging infrastructure.',
                reward: 2500,
                status: 'bidding_open',
                assignment_mode: 'bidding',
                requester_id: 'system_security',
                posted_at: new Date(Date.now() - 900000),
                escrow: { locked: true, amount: 2500 },
                tags: ['security', 'audit'],
                specialties: ['Cybersecurity'],
                bids: [
                    {
                        id: 'bid_1',
                        agent_id: 'sec_bot_9000',
                        agent_name: 'SecBot 9000',
                        price: 2400,
                        submitted_at: new Date()
                    }
                ],
                requirements: [], deliverables: []
            } as any,
            {
                id: 'mission_content_05',
                title: 'Write Technical Documentation',
                description: 'Document the new API endpoints for the Agent Registry module.',
                reward: 300,
                status: 'open',
                assignment_mode: 'autopilot',
                requester_id: 'dev_team',
                posted_at: new Date(),
                escrow: { locked: true, amount: 300 },
                tags: ['writing', 'docs'],
                specialties: ['Technical Writing'],
                requirements: [], deliverables: []
            } as any,
            {
                id: 'mission_security_06',
                title: 'Emergency: Smart Contract Audit',
                description: 'Urgent comprehensive audit of the new Staking V2 vault before mainnet launch. Critical priority.',
                reward: 15000,
                status: 'open',
                assignment_mode: 'bidding',
                requester_id: 'core_team_lead',
                posted_at: new Date(),
                escrow: { locked: true, amount: 15000 },
                tags: ['security', 'audit', 'critical'],
                specialties: ['Security Research', 'Solidity'],
                requirements: ['Report', 'PoC'],
                deliverables: ['Audit PDF'],
                timeout_seconds: 3600
            } as any,
            {
                id: 'mission_monitor_07',
                title: 'Monitor Competitor DEX Volume',
                description: 'Real-time monitoring of volume spikes on Uniswap V3 pools for the next 24 hours.',
                reward: 800,
                status: 'executing',
                assignment_mode: 'autopilot',
                requester_id: 'trader_bot_alpha',
                posted_at: new Date(Date.now() - 7200000),
                escrow: { locked: true, amount: 800 },
                tags: ['monitoring', 'defi', 'data'],
                specialties: ['Data Analysis'],
                worker_id: 'agent_claw_009',
                assigned_agent: {
                    agent_id: 'agent_claw_009',
                    agent_name: 'MarketWatcher',
                    assigned_at: new Date(Date.now() - 7000000),
                    assignment_method: 'autopilot'
                },
                requirements: [], deliverables: []
            } as any
        ];

        mocks.forEach(m => this.missions.set(m.id, m));
        this.save();
    }

    private save() {
        try {
            const data = Array.from(this.missions.values());
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Failed to save missions:', error);
        }
    }

    create(params: Omit<Mission, 'id' | 'status' | 'posted_at'>): Mission {
        const id = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const mission: Mission = {
            ...params,
            id,
            status: 'posted',
            posted_at: new Date(),
            // Initialize escrow if not provided
            escrow: params.escrow || {
                locked: false,
                amount: params.reward
            },
            // Initialize bids array if bidding mode
            bids: params.assignment_mode === 'bidding' ? [] : undefined
        };

        this.missions.set(id, mission);
        this.save();
        return mission;
    }

    get(id: string): Mission | null {
        if (!this.missions.has(id)) {
            this.load(); // Try reloading in case created by another instance
        }
        return this.missions.get(id) || null;
    }

    update(id: string, updates: Partial<Mission>): Mission | null {
        const mission = this.missions.get(id);
        if (!mission) return null;

        Object.assign(mission, updates);
        this.save();
        return mission;
    }

    list(filters?: { status?: string; tag?: string; claimed_by?: string }): Mission[] {
        let results = Array.from(this.missions.values());

        if (filters?.status) {
            results = results.filter(m => m.status === filters.status);
        }

        if (filters?.tag) {
            results = results.filter(m => m.tags.includes(filters.tag!));
        }

        if (filters?.claimed_by) {
            results = results.filter(m => m.claimed_by === filters.claimed_by);
        }

        return results.sort((a, b) => b.posted_at.getTime() - a.posted_at.getTime());
    }

    // Transition helpers

    claim(id: string, agentId: string): Mission | null {
        const mission = this.get(id);
        if (!mission || mission.status !== 'open') throw new Error('Mission not available');

        if (mission.crew_required) {
            // Logic for multi-claim would go here
            throw new Error('Crew missions not fully implemented');
        }

        return this.update(id, {
            status: 'claimed',
            claimed_by: agentId,
            claimed_at: new Date()
        });
    }

    submit(id: string, agentId: string, content: string, artifacts: string[]): Mission | null {
        const mission = this.get(id);
        if (!mission) throw new Error('Mission not found');
        if (mission.claimed_by !== agentId) throw new Error('Not authorized to submit');
        if (mission.status !== 'claimed') throw new Error('Mission not in claimed state');

        return this.update(id, {
            status: 'submitted',
            submitted_at: new Date(),
            submission: {
                content,
                artifacts,
                submitted_at: new Date()
            }
        });
    }

    verify(id: string, verifierId: string, approved: boolean, feedback: string): Mission | null {
        const mission = this.get(id);
        if (!mission) throw new Error('Mission not found');
        if (mission.status !== 'submitted') throw new Error('Mission not ready for verification');

        const newStatus = approved ? 'verified' : 'rejected';

        return this.update(id, {
            status: newStatus,
            verified_at: new Date(),
            verification: {
                verifier_id: verifierId,
                approved,
                feedback,
                verified_at: new Date()
            }
        });
    }

    payout(id: string): Mission | null {
        const mission = this.get(id);
        if (!mission) throw new Error('Mission not found');
        if (mission.status !== 'verified') throw new Error('Mission not verified');

        return this.update(id, {
            status: 'paid',
            paid_at: new Date()
        });
    }
}
