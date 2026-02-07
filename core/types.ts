/**
 * Core type definitions for CLAWGER system
 * Updated Phase 20
 */

// ============ Proposals ============

export type ProposalStatus =
    | 'pending'
    | 'accepted'
    | 'countered'
    | 'rejected'
    | 'expired'
    | 'closed';

export type RiskTolerance = 'low' | 'medium' | 'high';

export interface Proposal {
    id: string;
    proposer: string; // Wallet address
    objective: string;
    budget: string; // MON amount
    deadline: string; // ISO timestamp or duration
    risk_tolerance: RiskTolerance;
    constraints?: string[];
    status: ProposalStatus;
    bond_amount: string;
    submission_time: Date;
    decision_time?: Date;
    counter_expiration?: Date;
}

export interface ProposalSubmission {
    objective: string;
    budget: string;
    deadline: string;
    risk_tolerance: RiskTolerance;
    constraints?: string[];
}

// ============ Decisions ============

export type DecisionType = 'ACCEPT' | 'COUNTER' | 'REJECT';

export interface AcceptTerms {
    escrow: string;
    clawger_fee: string;
    worker_bond: string;
    expected_completion: string;
    task_id?: string;
}

export interface CounterTerms {
    budget?: string;
    deadline?: string;
    constraints?: string[];
}

export interface ClawgerResponse {
    proposal_id: string;
    decision: DecisionType;
    timestamp: string;

    // If ACCEPT
    terms?: AcceptTerms;

    // If COUNTER
    counter_terms?: CounterTerms;
    counter_expiration?: string;

    // If REJECT
    rejection_reason?: string;
    bond_burned?: string;
    bond_to_clawger?: string;

    // Always included
    reasoning: string[];
    risk_assessment: 'low' | 'medium' | 'high';
    estimated_success_probability?: number;
}

// ============ Clawbot Integration ============

export interface ClawbotDecision {
    risk_assessment: 'low' | 'medium' | 'high';
    feasibility: 'viable' | 'challenging' | 'impossible';
    estimated_cost: string;
    expected_margin: string;
    decision: DecisionType;
    reasoning: string[];
    counter_terms?: CounterTerms;
}

// ============ Evaluation Context ============

export interface TreasuryState {
    total: string;
    allocated: string;
    available: string;
}

export interface RecentPerformance {
    total_tasks: number;
    successful: number;
    failed: number;
    success_rate: number;
    total_profit: string;
    total_loss: string;
    net_pnl: string;
}

export interface WorkerAvailability {
    trusted: number; // rep >= 70
    probation: number; // rep 30-69
    total: number;
    avg_success_rate: number;
}

export interface EvaluationContext {
    proposal: Proposal;
    treasury: TreasuryState;
    recent_performance: RecentPerformance;
    worker_availability: WorkerAvailability;
    current_exposure: string;
    current_exposure_percent: number;
}

// ============ Tasks ============

export type TaskStatus =
    | 'created'
    | 'assigned'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'verified';

export interface Task {
    id: string;
    proposal_id: string;
    worker: string;
    verifier: string;
    escrow: string;
    worker_bond: string;
    clawger_fee: string;
    status: TaskStatus;
    created_at: Date;
    completed_at?: Date;
}

// ============ Agents ============

export type AgentStatus = 'trusted' | 'probation' | 'fired';

export interface AgentProfile {
    address: string;
    reputation: number; // 0-100
    tasks_completed: number;
    tasks_assigned: number;
    total_earned: string;
    total_slashed: string;
    success_rate: number;
    last_active: Date;
    status: AgentStatus;
}

// ============ Rejection Ledger ============

export interface RejectionRecord {
    proposal_id: string;
    timestamp: Date;
    objective: string;
    budget: string;
    deadline: string;
    reason: string;
    bond_burned: string;
    bond_to_clawger: string;
    proposer: string;
}

// ============ CLAWGER State ============

export interface RiskProfile {
    max_task_budget: string;
    max_agent_exposure: string;
    min_agent_reputation: number;
    current_failure_threshold: number;
}

export interface ClawgerState {
    treasury: TreasuryState;
    agents: Map<string, AgentProfile>;
    proposals: Map<string, Proposal>;
    tasks: Map<string, Task>;
    risk_profile: RiskProfile;
    rejection_ledger: RejectionRecord[];
}

// ============ Events ============

export interface ProposalSubmittedEvent {
    type: 'proposal_submitted';
    proposal_id: string;
    proposer: string;
    timestamp: Date;
}

export interface DecisionMadeEvent {
    type: 'decision_made';
    proposal_id: string;
    decision: DecisionType;
    timestamp: Date;
}

export interface CounterExpiredEvent {
    type: 'counter_expired';
    proposal_id: string;
    timestamp: Date;
}

export interface TaskCreatedEvent {
    type: 'task_created';
    task_id: string;
    proposal_id: string;
    timestamp: Date;
}

export interface AgentSlashedEvent {
    type: 'agent_slashed';
    agent: string;
    amount: string;
    reason: string;
    timestamp: Date;
}

export type ClawgerEvent =
    | ProposalSubmittedEvent
    | DecisionMadeEvent
    | CounterExpiredEvent
    | TaskCreatedEvent
    | AgentSlashedEvent;

// ============ Agent Registry ============

export type AgentType = 'worker' | 'verifier';

export interface RegisteredAgent {
    address: string;
    type: AgentType;
    capabilities: string[];
    minFee: string;
    minBond: string;
    operator?: string; // For LOCAL mode agents
    reputation: number; // 0-100
    active: boolean;
    registeredAt: Date;
}

export interface AgentRegistration {
    type: AgentType;
    capabilities: string[];
    minFee: string;
    minBond: string;
    operator?: string;
}

// ============ Multi-Verifier ============

export interface VerificationVote {
    verifier: string;
    vote: boolean; // true = pass, false = fail
    timestamp: Date;
    evidence?: string;
}

export interface VerificationResult {
    taskId: string;
    verifiers: string[];
    votes: VerificationVote[];
    consensus: boolean | null; // true = pass, false = fail, null = pending
    outliers: string[];
    finalized: boolean;
}

export interface VerifierSelection {
    count: number; // 1-3
    verifiers: string[];
    reasoning: string[];
}

// ============ Dual Operating Modes ============

export type ClawgerMode = 'PUBLIC' | 'LOCAL';

export interface ModeConfig {
    requireProposals: boolean;
    requireStaking: boolean;
    onChainEnforcement: boolean;
    negotiation: boolean;
    processManagement?: boolean;
}

// ============ LOCAL Mode ============

export interface Order {
    id: string;
    operator: string;
    objective: string;
    priority: 'low' | 'medium' | 'high';
    timeout: number; // milliseconds
    constraints?: string[];
    createdAt: Date;
    status: 'pending' | 'assigned' | 'executing' | 'completed' | 'failed';
}

export interface LocalAgent {
    pid: number;
    address: string;
    type: AgentType;
    status: 'running' | 'idle' | 'working' | 'quarantined' | 'terminated';
    cpu: number; // percentage
    memory: number; // MB
    tasksCompleted: number;
    tasksFailed: number;
    lastHeartbeat: Date;
    quarantineUntil?: Date;
}

export interface ProcessMetrics {
    pid: number;
    cpu: number;
    memory: number;
    uptime: number; // seconds
}

export interface EnforcementAction {
    type: 'kill' | 'restart' | 'quarantine' | 'reassign';
    agent: string;
    reason: string;
    timestamp: Date;
    taskId?: string;
}

// ============ Extended Task with Multi-Verifier ============

export interface TaskWithVerification extends Task {
    verifiers: string[]; // Multiple verifiers
    verification?: VerificationResult;
}

// ============ Crew Missions ============

export interface CrewConfig {
    min_agents: number;
    max_agents: number;
    required_roles: string[]; // e.g., ['frontend', 'backend', 'reviewer']
    coordination_mode: 'sequential' | 'parallel' | 'hybrid';
}

export type SubTaskStatus = 'available' | 'claimed' | 'in_progress' | 'completed' | 'blocked';

export interface SubTask {
    id: string;
    description: string;
    role: string;
    dependencies: string[]; // IDs of prerequisite subtasks
    status: SubTaskStatus;
    assigned_agent?: string;
    estimated_duration_minutes: number;
    artifacts: string[];
    started_at?: Date;
    completed_at?: Date;
}

export interface TaskGraph {
    nodes: Map<string, SubTask>;
    edges: Map<string, string[]>; // task_id -> dependent_task_ids
}

export interface CrewAssignment {
    agent_id: string;
    agent_name: string;
    role: string;
    current_tasks: string[]; // SubTask IDs
    joined_at: Date;
    status: 'active' | 'idle' | 'dropped';
}

export interface MissionArtifact {
    id: string;
    subtask_id: string;
    agent_id: string;
    url: string;
    type: string;
    uploaded_at: Date;
    metadata: Record<string, any>;
    description?: string;
}

export type MissionEventType =
    | 'task_claimed'
    | 'task_completed'
    | 'artifact_uploaded'
    | 'blocker_added'
    | 'blocker_resolved'
    | 'crew_joined'
    | 'crew_left'
    | 'task_reassigned';

export interface MissionEvent {
    id: string;
    type: MissionEventType;
    timestamp: Date;
    agent_id?: string;
    subtask_id?: string;
    details: Record<string, any>;
}

export interface Blocker {
    id: string;
    agent_id: string;
    subtask_id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    reported_at: Date;
    resolved: boolean;
    resolved_at?: Date;
    resolution?: string;
}
