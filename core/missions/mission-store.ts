import { pool } from '../db';

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
    filename: string;
    original_filename: string;
    url: string;
    size: number;
    mime_type: string;
    uploaded_by: string;
    uploaded_at: Date;
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
    price: number;
    eta_minutes: number;
    bond_offered: number;
    message?: string;
    submitted_at: Date;
    score?: number;
}

export interface AssignmentDetails {
    agent_id: string;
    agent_name: string;
    assigned_at: Date;
    assignment_method: 'autopilot' | 'bidding' | 'manual';
    bid_id?: string;
    reasoning?: any;
}

export interface EscrowStatus {
    locked: boolean;
    amount: number;
    tx_hash?: string;
    locked_at?: Date;
    released_at?: Date;
}

export interface Mission {
    id: string;
    title: string;
    description: string;
    reward: number;
    status: MissionStatus;
    tags: string[];
    specialties: string[];

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

    // Bidding
    bidding_window_seconds?: number;
    bidding_window_end?: Date;
    bids?: Bid[];

    // Direct Hire
    direct_agent_id?: string;
    direct_agent_name?: string;

    // Legacy fields
    worker_id?: string;
    claimed_at?: Date;
    submitted_at?: Date;
    verified_at?: Date;
    paid_at?: Date;

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

    // Legacy fields
    claimed_by?: string;
    requester_type?: 'wallet' | 'agent';
    requester_name?: string;

    // Configuration
    deadline?: Date;
    timeout_seconds?: number;
    crew_required?: boolean;

    // Crew Mission Fields
    crew_config?: {
        min_agents: number;
        max_agents: number;
        required_roles: string[];
        coordination_mode: 'sequential' | 'parallel' | 'hybrid';
    };
    task_graph?: {
        nodes: { [key: string]: any };
        edges: { [key: string]: string[] };
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
    requirements: string[];
    deliverables: string[];

    // Work submission
    submission?: {
        content: string;
        artifacts: string[];
        submitted_at: Date;
    };

    // Work Artifacts
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
    constructor() {
        console.log('[MissionStore] Initialized with PostgreSQL persistence');
    }

    private hydrate(item: any): Mission {
        if (!item) return item;

        // Hydrate dates
        if (item.posted_at) item.posted_at = new Date(item.posted_at);
        if (item.bidding_window_end) item.bidding_window_end = new Date(item.bidding_window_end);
        if (item.assigned_at) item.assigned_at = new Date(item.assigned_at);
        if (item.executing_started_at) item.executing_started_at = new Date(item.executing_started_at);
        if (item.verifying_started_at) item.verifying_started_at = new Date(item.verifying_started_at);
        if (item.settled_at) item.settled_at = new Date(item.settled_at);
        if (item.failed_at) item.failed_at = new Date(item.failed_at);

        // Legacy dates
        if (item.claimed_at) item.claimed_at = new Date(item.claimed_at);
        if (item.submitted_at) item.submitted_at = new Date(item.submitted_at);
        if (item.verified_at) item.verified_at = new Date(item.verified_at);
        if (item.paid_at) item.paid_at = new Date(item.paid_at);
        if (item.deadline) item.deadline = new Date(item.deadline);

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

        return item as Mission;
    }

    async create(params: Omit<Mission, 'id' | 'status' | 'posted_at'>): Promise<Mission> {
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

        await pool.query(
            `INSERT INTO missions_data (
                id, status, requester_id, posted_at, updated_at, data
            ) VALUES ($1, $2, $3, $4, NOW(), $5)`,
            [id, mission.status, mission.requester_id, mission.posted_at, JSON.stringify(mission)]
        );

        return mission;
    }

    async get(id: string): Promise<Mission | null> {
        const res = await pool.query('SELECT data FROM missions_data WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        return this.hydrate(res.rows[0].data);
    }

    async update(id: string, updates: Partial<Mission>): Promise<Mission | null> {
        const current = await this.get(id);
        if (!current) {
            console.error(`[MissionStore] Mission ${id} not found for update`);
            return null;
        }

        // Auto-attach lifecycle timestamps based on status change
        if (updates.status && updates.status !== current.status) {
            const now = new Date();
            // ... (keeping simplified timestamp logic for brevity, but crucial ones below)
            switch (updates.status) {
                case 'assigned':
                    if (!updates.assigned_at && !current.assigned_at) updates.assigned_at = now;
                    break;
                case 'executing':
                    if (!updates.executing_started_at && !current.executing_started_at) updates.executing_started_at = now;
                    break;
                case 'verifying':
                    if (!updates.verifying_started_at && !current.verifying_started_at) updates.verifying_started_at = now;
                    break;
                case 'settled':
                    if (!updates.settled_at && !current.settled_at) updates.settled_at = now;
                    break;
                case 'paid':
                    if (!updates.paid_at && !current.paid_at) updates.paid_at = now;
                    break;
                case 'failed':
                    if (!updates.failed_at && !current.failed_at) updates.failed_at = now;
                    break;
            }
        }

        const updated = { ...current, ...updates };

        // Extract fields for columns
        const status = updated.status;
        const requester_id = updated.requester_id;
        const worker_id = updated.assigned_agent?.agent_id || updated.worker_id;

        await pool.query(
            `UPDATE missions_data 
             SET status = $1, requester_id = $2, worker_id = $3, updated_at = NOW(), data = $4
             WHERE id = $5`,
            [status, requester_id, worker_id, JSON.stringify(updated), id]
        );

        return updated;
    }

    async list(filters?: { status?: string; tag?: string; claimed_by?: string }): Promise<Mission[]> {
        let query = 'SELECT data FROM missions_data';
        const params: any[] = [];
        const whereClauses: string[] = [];

        if (filters?.status) {
            whereClauses.push(`status = $${params.length + 1}`);
            params.push(filters.status);
        }

        // Tags and claimed_by are inside JSONB data, might need specialized query or filtering in memory if volume is low.
        // For Postgres JSONB: data->'tags' ? 'tag_name'
        if (filters?.tag) {
            // Basic JSONB containment for tags array
            whereClauses.push(`data->'tags' ? $${params.length + 1}`);
            params.push(filters.tag);
        }

        // claimed_by is legacy, but if used:
        if (filters?.claimed_by) {
            whereClauses.push(`data->>'claimed_by' = $${params.length + 1}`);
            params.push(filters.claimed_by);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY posted_at DESC';

        const res = await pool.query(query, params);
        return res.rows.map(row => this.hydrate(row.data));
    }

    // Transition helpers
    async claim(id: string, agentId: string): Promise<Mission | null> {
        const mission = await this.get(id);
        if (!mission || mission.status !== 'open') throw new Error('Mission not available');

        return this.update(id, {
            status: 'claimed',
            claimed_by: agentId,
            claimed_at: new Date()
        });
    }

    async submit(id: string, agentId: string, content: string, artifacts: ArtifactMetadata[]): Promise<Mission | null> {
        const mission = await this.get(id);
        if (!mission) throw new Error('Mission not found');
        // Check authorization logic here if needed (e.g. against worker_id)

        return this.update(id, {
            status: 'submitted',
            submitted_at: new Date(),
            submission: {
                content,
                artifacts: [],
                submitted_at: new Date()
            },
            work_artifacts: artifacts
        });
    }

    async verify(id: string, verifierId: string, approved: boolean, feedback: string): Promise<Mission | null> {
        const mission = await this.get(id);
        if (!mission) throw new Error('Mission not found');

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

    async payout(id: string): Promise<Mission | null> {
        const mission = await this.get(id);
        if (!mission) throw new Error('Mission not found');

        return this.update(id, {
            status: 'paid',
            paid_at: new Date()
        });
    }
}
