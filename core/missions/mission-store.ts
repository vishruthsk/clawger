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

export type AssignmentMode = 'autopilot' | 'bidding' | 'crew' | 'direct_hire';

export interface ArtifactMetadata {
    filename: string;              // Sanitized filename with timestamp prefix
    original_filename: string;     // Original uploaded filename
    url: string;                   // Download URL
    size: number;                  // File size in bytes
    mime_type: string;             // MIME type
    uploaded_by: string;           // Agent ID or wallet address
    uploaded_at: Date;             // Upload timestamp
}


export interface Subtask {
    id: string;
    title: string;
    description: string;
    required_specialty: string;
    claimed_by?: string;
    claimed_by_name?: string;
    claimed_at?: Date;
    status: 'pending' | 'claimed' | 'in_progress' | 'completed' | 'failed';
    artifacts?: ArtifactMetadata[];
    completion_percentage?: number;
}

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
    reasoning?: any;         // Assignment reasoning/breakdown
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
    assignment_analysis?: {
        base_score: number;
        recent_wins: number;
        diminishing_multiplier: number;
        adjusted_score: number;
        rank_in_pool: number;
        pool_size: number;
        reputation_multiplier: number;
        explanation_text?: string;
    };

    // Bidding (if assignment_mode === 'bidding')
    bidding_window_seconds?: number;     // Default 60
    bidding_window_end?: Date;
    bids?: Bid[];

    // Direct Hire (if assignment_mode === 'direct_hire')
    direct_agent_id?: string;
    direct_agent_name?: string;

    // Legacy fields for backward compatibility
    worker_id?: string;                      // Legacy: agent ID (replaced by assigned_agent)
    claimed_at?: Date;                       // Legacy: when agent claimed (replaced by executing_started_at)
    submitted_at?: Date;                     // Legacy: when work submitted (replaced by verifying_started_at)
    verified_at?: Date;                      // Legacy: when verified (replaced by settled_at)
    paid_at?: Date;                          // Legacy: when paid

    // Escrow
    escrow: EscrowStatus;

    // Lifecycle timestamps
    requester_id: string;
    posted_at: Date;
    assigned_at?: Date;
    executing_started_at?: Date;
    verifying_started_at?: Date;
    settled_at?: Date;
    failed_at?: Date;

    // Legacy fields (backward compatibility)
    claimed_by?: string;
    submitted_at?: Date;
    verified_at?: Date;
    paid_at?: Date;

    // Actors
    requester_id: string;                // "human" or agent_id or wallet address
    requester_type?: 'wallet' | 'agent'; // Track if mission created by human or bot
    requester_name?: string;             // Agent name if bot requester

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
        artifacts: string[];             // Legacy: Links to proof
        submitted_at: Date;
    };

    // Work Artifacts (real file uploads)
    work_artifacts?: ArtifactMetadata[];

    // Revision tracking
    revision_count?: number;
    revision_history?: {
        revision_number: number;
        feedback: string;
        requested_by: string;
        requested_at: Date;
        revised_content?: string;
        revised_at?: Date;
    }[];

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

                // Clear existing missions to prevent stale data
                this.missions.clear();

                // ✅ CRITICAL: Hydrate ALL date fields (top-level and nested)
                for (const item of data) {
                    // Top-level dates
                    if (item.posted_at) item.posted_at = new Date(item.posted_at);
                    if (item.bidding_window_end) item.bidding_window_end = new Date(item.bidding_window_end);
                    if (item.assigned_at) item.assigned_at = new Date(item.assigned_at);
                    if (item.executing_started_at) item.executing_started_at = new Date(item.executing_started_at);
                    if (item.verifying_started_at) item.verifying_started_at = new Date(item.verifying_started_at);
                    if (item.settled_at) item.settled_at = new Date(item.settled_at);
                    if (item.failed_at) item.failed_at = new Date(item.failed_at);

                    // Legacy dates (backward compatibility)
                    if (item.claimed_at) item.claimed_at = new Date(item.claimed_at);
                    if (item.submitted_at) item.submitted_at = new Date(item.submitted_at);
                    if (item.verified_at) item.verified_at = new Date(item.verified_at);
                    if (item.paid_at) item.paid_at = new Date(item.paid_at);

                    // Nested dates in escrow
                    if (item.escrow?.locked_at) item.escrow.locked_at = new Date(item.escrow.locked_at);
                    if (item.escrow?.released_at) item.escrow.released_at = new Date(item.escrow.released_at);

                    // Nested dates in assigned_agent
                    if (item.assigned_agent?.assigned_at) {
                        item.assigned_agent.assigned_at = new Date(item.assigned_agent.assigned_at);
                    }

                    // Nested dates in submission
                    if (item.submission?.submitted_at) {
                        item.submission.submitted_at = new Date(item.submission.submitted_at);
                    }

                    // Nested dates in work_artifacts
                    if (item.work_artifacts) {
                        item.work_artifacts = item.work_artifacts.map((artifact: any) => ({
                            ...artifact,
                            uploaded_at: artifact.uploaded_at ? new Date(artifact.uploaded_at) : artifact.uploaded_at
                        }));
                    }

                    // Nested dates in bids
                    if (item.bids) {
                        item.bids = item.bids.map((bid: any) => ({
                            ...bid,
                            submitted_at: bid.submitted_at ? new Date(bid.submitted_at) : bid.submitted_at
                        }));
                    }

                    // Nested dates in subtasks
                    if (item.subtasks) {
                        item.subtasks = item.subtasks.map((subtask: any) => ({
                            ...subtask,
                            claimed_at: subtask.claimed_at ? new Date(subtask.claimed_at) : subtask.claimed_at
                        }));
                    }

                    // Nested dates in revision_history
                    if (item.revision_history) {
                        item.revision_history = item.revision_history.map((revision: any) => ({
                            ...revision,
                            requested_at: revision.requested_at ? new Date(revision.requested_at) : revision.requested_at,
                            revised_at: revision.revised_at ? new Date(revision.revised_at) : revision.revised_at
                        }));
                    }

                    // Nested dates in verification
                    if (item.verification?.verified_at) {
                        item.verification.verified_at = new Date(item.verification.verified_at);
                    }

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

    /**
     * Reload missions from disk to ensure fresh data across API route instances
     */
    private ensureFresh() {
        this.load();
    }

    private seedMocks() {
        const mocks: Mission[] = [
            {
                id: 'mx7k2p',
                title: 'Deploy CLAWGER Protocol V1',
                description: 'Initial deployment and verification of the core protocol contracts.',
                requirements: ['Solidity expertise', 'Security audit experience', 'Gas optimization'],
                deliverables: ['Contract Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 'Etherscan Verification Link', 'Gas Optimization Report', 'Security Audit Summary'],
                reward: 5000,
                status: 'paid',
                assignment_mode: 'autopilot',
                requester_id: 'system',
                posted_at: new Date(Date.now() - 86400000 * 10), // 10 days ago
                assigned_at: new Date(Date.now() - 86400000 * 9),
                executing_started_at: new Date(Date.now() - 86400000 * 8),
                verifying_started_at: new Date(Date.now() - 86400000 * 7),
                settled_at: new Date(Date.now() - 86400000 * 6),
                paid_at: new Date(Date.now() - 86400000 * 6),
                escrow: { locked: true, amount: 5000, locked_at: new Date(Date.now() - 86400000 * 10), released_at: new Date(Date.now() - 86400000 * 6) },
                tags: ['Coding', 'Security', 'DeFi'],
                specialties: ['Smart Contracts', 'Solidity', 'Security Audit'],
                worker_id: 'ag7x2m',
                assigned_agent: {
                    agent_id: 'ag7x2m',
                    agent_name: '[Test Bot] CodeCraft AI',
                    assigned_at: new Date(Date.now() - 86400000 * 9),
                    assignment_method: 'autopilot'
                },
                verification: {
                    verifier_id: 'cx8t5w',
                    approved: true,
                    feedback: 'Excellent work. All contracts deployed successfully with optimal gas usage.',
                    verified_at: new Date(Date.now() - 86400000 * 7)
                }
            } as any,
            {
                id: 'p8w2n5',
                title: 'Scrape Competitor Pricing',
                description: 'Analyze pricing models of top 5 competitors and structuralize data into actionable insights.',
                reward: 450,
                status: 'executing',
                assignment_mode: 'autopilot',
                requester_id: 'human_buyer_01',
                posted_at: new Date(Date.now() - 3600000 * 36), // 36 hours ago
                assigned_at: new Date(Date.now() - 3600000 * 30),
                executing_started_at: new Date(Date.now() - 3600000 * 29),
                escrow: { locked: true, amount: 450, locked_at: new Date(Date.now() - 3600000 * 36) },
                tags: ['Research', 'Analytics', 'Automation'],
                specialties: ['Data Analysis', 'Web Scraping'],
                worker_id: 'dm5x3r',
                assigned_agent: {
                    agent_id: 'dm5x3r',
                    agent_name: '[Test Bot] DataMiner X',
                    assigned_at: new Date(Date.now() - 3600000 * 30),
                    assignment_method: 'autopilot'
                },
                requirements: ['Structured JSON output', 'Price comparison charts', 'Trend analysis'],
                deliverables: ['Pricing Data (JSON format)', 'Competitor Analysis Report (PDF)', 'Interactive Visualization Dashboard', 'Recommendations Summary']
            } as any,
            {
                id: 'n6y4z2',
                title: 'Generate Marketing Assets',
                description: 'Create a suite of social media banners for the Q1 campaign with brand consistency.',
                reward: 1200,
                status: 'open',
                assignment_mode: 'bidding',
                requester_id: 'human_marketing',
                posted_at: new Date(Date.now() - 1800000), // 30 min ago
                escrow: { locked: true, amount: 1200, locked_at: new Date(Date.now() - 1800000) },
                tags: ['Design'],
                specialties: ['Graphic Design', 'Branding'],
                requirements: ['4K resolution', 'Brand guidelines compliance', 'Multiple format exports'],
                deliverables: ['10 Social Media Banners (PNG/JPG)', 'Source Files (PSD/Figma)', 'Brand Asset Kit', 'Usage Guidelines Document']
            } as any,
            {
                id: 'k9r3x6',
                title: 'Security Vulnerability Scan',
                description: 'Run automated penetration tests on the staging infrastructure and identify vulnerabilities.',
                reward: 2500,
                status: 'bidding_open',
                assignment_mode: 'bidding',
                requester_id: 'system_security',
                posted_at: new Date(Date.now() - 900000), // 15 min ago
                bidding_window_end: new Date(Date.now() + 3600000 * 24), // 24 hours from now
                escrow: { locked: true, amount: 2500, locked_at: new Date(Date.now() - 900000) },
                tags: ['Security', 'Research'],
                specialties: ['Cybersecurity', 'Penetration Testing'],
                bids: [
                    {
                        id: 'bid_1',
                        agent_id: 'sb2k7x',
                        agent_name: '[Test Bot] SecBot 9000',
                        price: 2400,
                        submitted_at: new Date(Date.now() - 300000),
                        eta_minutes: 180,
                        bond_offered: 500,
                        message: 'Specialized in OWASP Top 10 testing with 98% success rate'
                    }
                ],
                requirements: ['OWASP Top 10 coverage', 'Penetration test report', 'Remediation timeline'],
                deliverables: ['Comprehensive Vulnerability Report (PDF)', 'Remediation Recommendations', 'Risk Assessment Matrix', 'Executive Summary']
            } as any,
            {
                id: 'q1w5e8',
                title: 'Write Technical Documentation',
                description: 'Document the new API endpoints for the Agent Registry module with code examples.',
                reward: 300,
                status: 'open',
                assignment_mode: 'autopilot',
                requester_id: 'dev_team',
                posted_at: new Date(Date.now() - 600000), // 10 min ago
                escrow: { locked: true, amount: 300, locked_at: new Date(Date.now() - 600000) },
                tags: ['Research', 'Coding'],
                specialties: ['Technical Writing', 'API Documentation'],
                requirements: ['OpenAPI 3.0 specification', 'Code examples in multiple languages', 'Interactive examples'],
                deliverables: ['API Documentation (Markdown)', 'OpenAPI 3.0 Spec File', 'Integration Guide', 'Code Examples Repository']
            } as any,
            {
                id: 'h2t8v9',
                title: 'Emergency: Smart Contract Audit',
                description: 'Urgent comprehensive audit of the new Staking V2 vault before mainnet launch. Critical priority - potential vulnerabilities must be identified.',
                reward: 15000,
                status: 'open',
                assignment_mode: 'bidding',
                requester_id: 'core_team_lead',
                posted_at: new Date(Date.now() - 300000), // 5 min ago
                bidding_window_end: new Date(Date.now() + 3600000 * 12), // 12 hours from now
                escrow: { locked: true, amount: 15000, locked_at: new Date(Date.now() - 300000) },
                tags: ['Security', 'Coding', 'DeFi'],
                specialties: ['Security Research', 'Solidity', 'Smart Contract Auditing'],
                requirements: ['Full audit report', 'Proof of Concept for vulnerabilities', 'Gas optimization suggestions'],
                deliverables: ['Comprehensive Audit Report (PDF)', 'Proof of Concept Exploits (if found)', 'Gas Optimization Analysis', 'Security Score & Recommendations'],
                timeout_seconds: 43200 // 12 hours
            } as any,
            {
                id: 'v4m7q1',
                title: 'Monitor Competitor DEX Volume',
                description: 'Real-time monitoring of volume spikes on Uniswap V3 pools for the next 24 hours with instant alerts.',
                reward: 800,
                status: 'executing',
                assignment_mode: 'autopilot',
                requester_id: 'trader_bot_alpha',
                posted_at: new Date(Date.now() - 7200000), // 2 hours ago
                assigned_at: new Date(Date.now() - 7000000),
                executing_started_at: new Date(Date.now() - 6900000),
                escrow: { locked: true, amount: 800, locked_at: new Date(Date.now() - 7200000) },
                tags: ['DeFi', 'Analytics', 'Automation'],
                specialties: ['Data Analysis', 'DeFi Analytics', 'Real-time Monitoring'],
                worker_id: 'dm5x3r',
                assigned_agent: {
                    agent_id: 'dm5x3r',
                    agent_name: '[Test Bot] DataMiner X',
                    assigned_at: new Date(Date.now() - 7000000),
                    assignment_method: 'autopilot'
                },
                requirements: ['Real-time alerts for volume spikes >20%', 'Volume threshold detection', 'Historical comparison'],
                deliverables: ['Live Monitoring Dashboard', 'Alert Logs with Timestamps', 'Volume Spike Analysis Report', 'Trading Recommendations']
            } as any
        ];

        mocks.forEach(m => this.missions.set(m.id, m));
        this.save();
    }

    private save() {
        try {
            const data = Array.from(this.missions.values());
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
            console.log(`[PERSIST] missions.json flushed (${data.length} missions)`);
        } catch (error) {
            console.error('[MissionStore] CRITICAL: Failed to save missions:', error);
            throw new Error(`[MissionStore] CRITICAL: Persistence failure - ${error}`);
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
        this.ensureFresh();
        return this.missions.get(id) || null;
    }

    update(id: string, updates: Partial<Mission>): Mission | null {
        // ✅ CRITICAL: Reload from disk to ensure fresh data
        this.ensureFresh();

        const mission = this.missions.get(id);
        if (!mission) {
            console.error(`[MissionStore] CRITICAL: Mission ${id} not found for update`);
            return null;
        }

        // ✅ CRITICAL: Auto-attach lifecycle timestamps when status changes
        // This is the BULLETPROOF fix - no matter WHERE status is changed,
        // the corresponding timestamp will always be set.
        if (updates.status && updates.status !== mission.status) {
            const now = new Date();
            switch (updates.status) {
                case 'assigned':
                    if (!updates.assigned_at && !mission.assigned_at) {
                        updates.assigned_at = now;
                        console.log(`[MissionStore] Auto-attached assigned_at for ${id}`);
                    }
                    break;
                case 'executing':
                    if (!updates.executing_started_at && !mission.executing_started_at) {
                        updates.executing_started_at = now;
                        console.log(`[MissionStore] Auto-attached executing_started_at for ${id}`);
                    }
                    // Also backfill assigned_at if missing
                    if (!updates.assigned_at && !mission.assigned_at) {
                        updates.assigned_at = now;
                        console.log(`[MissionStore] Auto-backfilled assigned_at for ${id}`);
                    }
                    break;
                case 'verifying':
                    if (!updates.verifying_started_at && !mission.verifying_started_at) {
                        updates.verifying_started_at = now;
                        console.log(`[MissionStore] Auto-attached verifying_started_at for ${id}`);
                    }
                    // Also backfill executing_started_at if missing
                    if (!updates.executing_started_at && !mission.executing_started_at) {
                        updates.executing_started_at = now;
                        console.log(`[MissionStore] Auto-backfilled executing_started_at for ${id}`);
                    }
                    // Also backfill assigned_at if missing
                    if (!updates.assigned_at && !mission.assigned_at) {
                        updates.assigned_at = now;
                        console.log(`[MissionStore] Auto-backfilled assigned_at for ${id}`);
                    }
                    break;
                case 'settled':
                    if (!updates.settled_at && !mission.settled_at) {
                        updates.settled_at = now;
                        console.log(`[MissionStore] Auto-attached settled_at for ${id}`);
                    }
                    // Also backfill verifying_started_at if missing
                    if (!updates.verifying_started_at && !mission.verifying_started_at) {
                        updates.verifying_started_at = now;
                        console.log(`[MissionStore] Auto-backfilled verifying_started_at for ${id}`);
                    }
                    // Also backfill executing_started_at if missing
                    if (!updates.executing_started_at && !mission.executing_started_at) {
                        updates.executing_started_at = now;
                        console.log(`[MissionStore] Auto-backfilled executing_started_at for ${id}`);
                    }
                    // Also backfill assigned_at if missing
                    if (!updates.assigned_at && !mission.assigned_at) {
                        updates.assigned_at = now;
                        console.log(`[MissionStore] Auto-backfilled assigned_at for ${id}`);
                    }
                    break;
                case 'paid':
                    if (!updates.paid_at && !mission.paid_at) {
                        updates.paid_at = now;
                        console.log(`[MissionStore] Auto-attached paid_at for ${id}`);
                    }
                    if (!updates.settled_at && !mission.settled_at) {
                        updates.settled_at = now;
                        console.log(`[MissionStore] Auto-backfilled settled_at for ${id}`);
                    }
                    if (!updates.verifying_started_at && !mission.verifying_started_at) {
                        updates.verifying_started_at = now;
                        console.log(`[MissionStore] Auto-backfilled verifying_started_at for ${id}`);
                    }
                    if (!updates.executing_started_at && !mission.executing_started_at) {
                        updates.executing_started_at = now;
                        console.log(`[MissionStore] Auto-backfilled executing_started_at for ${id}`);
                    }
                    if (!updates.assigned_at && !mission.assigned_at) {
                        updates.assigned_at = now;
                        console.log(`[MissionStore] Auto-backfilled assigned_at for ${id}`);
                    }
                    break;
                case 'failed':
                    if (!updates.failed_at && !mission.failed_at) {
                        updates.failed_at = now;
                        console.log(`[MissionStore] Auto-attached failed_at for ${id}`);
                    }
                    break;
            }
        }

        // Apply updates
        Object.assign(mission, updates);

        // ✅ CRITICAL: Explicit set to ensure map is updated
        this.missions.set(id, mission);

        // ✅ CRITICAL: Persist immediately
        this.save();

        // ✅ Log persistence
        console.log(`[MissionStore] Persisted update: ${id}`, Object.keys(updates));

        // ✅ CRITICAL: Verify persistence by reloading
        this.ensureFresh();
        const verified = this.missions.get(id);

        if (!verified) {
            throw new Error(`[MissionStore] CRITICAL: Update failed to persist for mission ${id}`);
        }

        // Verify critical fields persisted
        for (const key of Object.keys(updates)) {
            if (updates[key as keyof Mission] !== undefined && verified[key as keyof Mission] === undefined) {
                throw new Error(
                    `[MissionStore] CRITICAL: Field ${key} failed to persist for mission ${id}`
                );
            }
        }

        console.log(`[PERSIST] Mission ${id} verified successfully`);
        return verified;
    }

    list(filters?: { status?: string; tag?: string; claimed_by?: string }): Mission[] {
        this.ensureFresh();
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

    submit(id: string, agentId: string, content: string, artifacts: ArtifactMetadata[]): Mission | null {
        const mission = this.get(id);
        if (!mission) throw new Error('Mission not found');
        if (mission.claimed_by !== agentId) throw new Error('Not authorized to submit');
        if (mission.status !== 'claimed') throw new Error('Mission not in claimed state');

        return this.update(id, {
            status: 'submitted',
            submitted_at: new Date(),
            submission: {
                content,
                artifacts: [],  // Legacy field
                submitted_at: new Date()
            },
            work_artifacts: artifacts  // Real artifacts
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
