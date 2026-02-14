/**
 * Mission Registry
 * 
 * Orchestrates mission creation, assignment, and lifecycle management.
 * Determines assignment mode and triggers appropriate engine.
 * 
 * Refactored for PostgreSQL persistence (Async/Await)
 */

import { MissionStore, Mission, Bid, AssignmentDetails, MissionStatus, ArtifactMetadata, MissionFilters } from './mission-store';
import { AssignmentEngine, AssignmentResult } from './assignment-engine';
import { BiddingEngine } from './bidding-engine';
import { AgentAuth } from '../registry/agent-auth';
import { AgentNotificationQueue } from '../tasks/agent-notification-queue';
import { TaskQueue } from '../dispatch/task-queue';
import { HeartbeatManager } from '../dispatch/heartbeat-manager';
import { EscrowEngine } from '../escrow/escrow-engine';
import { AssignmentHistoryTracker } from './assignment-history';
import { BondManager } from '../bonds/bond-manager';
import { SettlementEngine } from '../settlement/settlement-engine';
import { ReputationEngine } from '../agents/reputation-engine';
import { ECONOMY_CONFIG, calculateBondRequirements } from '../../config/economy';

export interface MissionCreationParams {
    requester_id: string;
    requester_type?: 'wallet' | 'agent';  // Track if mission created by human or bot
    requester_name?: string;               // Agent name if bot requester
    title: string;
    description: string;
    reward: number;                  // In $CLAWGER
    specialties: string[];
    requirements: string[];
    deliverables: string[];
    tags?: string[];
    deadline?: Date;
    timeout_seconds?: number;
    force_bidding?: boolean;         // Override threshold
    crew_enabled?: boolean;          // Enable multi-agent crew coordination
    // Direct hire params
    direct_hire?: boolean;           // Enable direct hire mode
    direct_agent_id?: string;        // Agent to hire directly
    direct_agent_name?: string;      // Agent name for direct hire
}

export interface MissionCreationResult {
    mission: Mission;
    assignment_mode: 'autopilot' | 'bidding' | 'crew' | 'direct_hire';
    bidding_window_end?: Date;
    assigned_agent?: {
        agent_id: string;
        agent_name: string;
    };
    crew_subtasks?: {
        id: string;
        title: string;
        required_specialty: string;
    }[];
    assignment_reasoning?: {
        base_score: number;
        recent_wins: number;
        diminishing_multiplier: number;
        adjusted_score: number;
        rank_in_pool: number;
        pool_size: number;
        reputation_multiplier: number;
        explanation_text: string;
    };
}

export class MissionRegistry {
    private missionStore: MissionStore;
    private readonly BIDDING_THRESHOLD = 500;
    private assignmentEngine: AssignmentEngine;
    private biddingEngine: BiddingEngine;
    private agentAuth: AgentAuth;
    private notifications: AgentNotificationQueue;
    private taskQueue: TaskQueue;
    private heartbeatManager: HeartbeatManager;
    private escrowEngine: EscrowEngine;
    private assignmentHistory: AssignmentHistoryTracker;
    private bondManager: BondManager;
    private settlementEngine: SettlementEngine;
    private reputationEngine: ReputationEngine;

    constructor(
        missionStore: MissionStore,
        agentAuth: AgentAuth,
        notifications: AgentNotificationQueue,
        taskQueue: TaskQueue,
        heartbeatManager: HeartbeatManager,
        escrowEngine: EscrowEngine,
        assignmentHistory: AssignmentHistoryTracker,
        bondManager: BondManager,
        settlementEngine: SettlementEngine,
        reputationEngine: ReputationEngine
    ) {
        this.missionStore = missionStore;
        this.agentAuth = agentAuth;
        this.notifications = notifications;
        this.taskQueue = taskQueue;
        this.heartbeatManager = heartbeatManager;
        this.escrowEngine = escrowEngine;
        this.assignmentHistory = assignmentHistory;
        this.bondManager = bondManager;
        this.settlementEngine = settlementEngine;
        this.reputationEngine = reputationEngine;

        // Pass reputationEngine to AssignmentEngine
        this.assignmentEngine = new AssignmentEngine(
            agentAuth,
            assignmentHistory,
            missionStore,
            reputationEngine
        );
        this.biddingEngine = new BiddingEngine(agentAuth, notifications);
    }

    /**
     * ✅ CRITICAL: Canonical lifecycle transition method
     * Guarantees persistence and consistency.
     */
    private async transitionMission(
        missionId: string,
        nextStatus: MissionStatus,
        additionalUpdates: Partial<Mission> = {}
    ): Promise<Mission> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) {
            throw new Error(`[LIFECYCLE] CRITICAL: Mission ${missionId} not found`);
        }

        // Auto-attach timestamps based on status
        const updates: Partial<Mission> = { ...additionalUpdates, status: nextStatus };

        switch (nextStatus) {
            case 'bidding_open':
                console.log(`[LIFECYCLE] ${missionId} → bidding_open`);
                break;
            case 'assigned':
                updates.assigned_at = updates.assigned_at || new Date();
                console.log(`[LIFECYCLE] ${missionId} → assigned`);
                break;
            case 'executing':
                updates.executing_started_at = new Date();
                console.log(`[LIFECYCLE] ${missionId} → executing`);
                break;
            case 'verifying':
                updates.verifying_started_at = new Date();
                console.log(`[LIFECYCLE] ${missionId} → verifying`);
                break;
            case 'settled':
                updates.settled_at = new Date();
                console.log(`[LIFECYCLE] ${missionId} → settled`);
                break;
            case 'paid':
                updates.settled_at = updates.settled_at || new Date();
                console.log(`[LIFECYCLE] ${missionId} → paid`);
                break;
            case 'failed':
                updates.failed_at = new Date();
                console.log(`[LIFECYCLE] ${missionId} → failed`);
                break;
        }

        // Persist immediately
        const updated = await this.missionStore.update(missionId, updates);
        if (!updated) {
            throw new Error(`[LIFECYCLE] CRITICAL: Failed to persist ${missionId} → ${nextStatus}`);
        }

        // Verify persistence
        const verified = await this.missionStore.get(missionId);
        if (!verified) {
            throw new Error(`[LIFECYCLE] CRITICAL: Mission ${missionId} disappeared after persist`);
        }

        if (verified.status !== nextStatus) {
            throw new Error(
                `[LIFECYCLE] CRITICAL: Status mismatch after persist. ` +
                `Expected ${nextStatus}, got ${verified.status} for mission ${missionId}`
            );
        }

        console.log(`[PERSIST] ${missionId} status=${nextStatus} verified successfully`);
        return verified;
    }

    /**
     * Create new mission and trigger assignment
     */
    async createMission(params: MissionCreationParams): Promise<MissionCreationResult> {
        console.log(`[MissionRegistry] Creating mission: ${params.title}`);

        // Determine assignment mode - direct_hire and crew take priority
        let assignment_mode: 'autopilot' | 'bidding' | 'crew' | 'direct_hire';

        if (params.direct_hire && params.direct_agent_id) {
            assignment_mode = 'direct_hire';
        } else if (params.crew_enabled) {
            assignment_mode = 'crew';
        } else if (params.force_bidding || params.reward >= this.BIDDING_THRESHOLD) {
            assignment_mode = 'bidding';
        } else {
            assignment_mode = 'autopilot';
        }

        console.log(`[MissionRegistry] Assignment mode: ${assignment_mode}`);

        // Create mission
        const mission = await this.missionStore.create({
            requester_id: params.requester_id,
            title: params.title,
            description: params.description,
            reward: params.reward,
            specialties: params.specialties,
            requirements: params.requirements,
            deliverables: params.deliverables,
            tags: params.tags || [],
            deadline: params.deadline,
            timeout_seconds: params.timeout_seconds,
            assignment_mode,
            crew_required: params.crew_enabled,
            direct_agent_id: params.direct_agent_id,
            direct_agent_name: params.direct_agent_name,
            escrow: {
                locked: false,
                amount: params.reward
            }
        });

        // Lock Escrow
        const escrowResult = await this.escrowEngine.validateAndLock(params.requester_id, params.reward, mission.id);

        if (!escrowResult.success) {
            console.error(`[MissionRegistry] Failed to lock escrow: ${escrowResult.error}`);
            await this.missionStore.update(mission.id, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: 'Escrow lock failed: ' + escrowResult.error
            });
            return {
                mission: (await this.missionStore.get(mission.id))!,
                assignment_mode
            };
        } else {
            // Update mission to reflect locked status
            await this.missionStore.update(mission.id, {
                escrow: {
                    locked: true,
                    amount: params.reward,
                    locked_at: new Date()
                }
            });
        }

        // Route to appropriate handler
        if (assignment_mode === 'direct_hire') {
            return await this.handleDirectHire(mission, params.direct_agent_id!, params.direct_agent_name!);
        } else if (params.crew_enabled) {
            return await this.handleCrewAssignment(mission);
        } else if (assignment_mode === 'autopilot') {
            return await this.handleAutopilotAssignment(mission);
        } else {
            return this.handleBiddingMode(mission);
        }
    }

    /**
     * Handle autopilot assignment
     */
    private async handleAutopilotAssignment(mission: Mission): Promise<MissionCreationResult> {
        const result = await this.assignmentEngine.assignAgent(mission);

        if (result.success && result.assigned_agent) {
            const assignmentDetails: AssignmentDetails = {
                agent_id: result.assigned_agent.agent_id,
                agent_name: result.assigned_agent.agent_name,
                assigned_at: new Date(),
                assignment_method: 'autopilot'
            };

            await this.missionStore.update(mission.id, {
                status: 'assigned',
                assigned_at: new Date(),
                assigned_agent: assignmentDetails
            });

            this.dispatchMissionToAgent(mission.id, result.assigned_agent.agent_id);

            this.notifications.createTask(
                result.assigned_agent.agent_id,
                'mission_available',
                {
                    mission_id: mission.id,
                    title: mission.title,
                    reward: mission.reward,
                    action: 'Start work on assigned mission'
                },
                'high'
            );

            console.log(`[MissionRegistry] Mission ${mission.id} assigned to ${result.assigned_agent.agent_name}`);

            return {
                mission: (await this.missionStore.get(mission.id))!,
                assignment_mode: 'autopilot',
                assigned_agent: result.assigned_agent,
                assignment_reasoning: result.assignment_reasoning
            };
        } else {
            const detailedReason = result.reason || 'No suitable agent found';
            const scoresSummary = result.scores?.map(s =>
                `${s.agent_name}: ${s.final_score.toFixed(3)}`
            ).join(', ') || 'No candidates evaluated';

            await this.missionStore.update(mission.id, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: `${detailedReason}. Candidates: ${scoresSummary}`
            });

            console.error(`[MissionRegistry] Mission ${mission.id} assignment failed`);

            return {
                mission: (await this.missionStore.get(mission.id))!,
                assignment_mode: 'autopilot'
            };
        }
    }

    /**
     * Handle direct hire assignment
     */
    private async handleDirectHire(mission: Mission, agentId: string, agentName: string): Promise<MissionCreationResult> {
        console.log(`[MissionRegistry] Direct hire: assigning mission ${mission.id} to ${agentName} (${agentId})`);

        const agent = await this.agentAuth.getById(agentId);
        if (!agent) {
            console.error(`[MissionRegistry] Direct hire failed: agent ${agentId} not found`);
            await this.missionStore.update(mission.id, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: `Direct hire failed: agent ${agentId} not found`
            });

            return {
                mission: (await this.missionStore.get(mission.id))!,
                assignment_mode: 'direct_hire'
            };
        }

        const assignmentDetails: AssignmentDetails = {
            agent_id: agentId,
            agent_name: agentName || agent.name,
            assigned_at: new Date(),
            assignment_method: 'manual'
        };

        await this.missionStore.update(mission.id, {
            status: 'assigned',
            assigned_at: new Date(),
            assigned_agent: assignmentDetails
        });

        this.dispatchMissionToAgent(mission.id, agentId);

        console.log(`[MissionRegistry] Direct hire complete: mission ${mission.id} assigned to ${agentName}`);

        return {
            mission: (await this.missionStore.get(mission.id))!,
            assignment_mode: 'direct_hire',
            assigned_agent: {
                agent_id: agentId,
                agent_name: agentName || agent.name
            }
        };
    }

    /**
     * Handle bidding mode
     */
    private async handleBiddingMode(mission: Mission): Promise<MissionCreationResult> {
        // Open bidding window
        const windowEnd = await this.biddingEngine.openBiddingWindow(mission, (missionId) => {
            this.closeBiddingAndAssign(missionId);
        });

        await this.missionStore.update(mission.id, {
            status: 'bidding_open',
            bidding_window_end: windowEnd
        });

        console.log(`[MissionRegistry] Bidding window opened for mission ${mission.id} until ${windowEnd.toISOString()}`);

        return {
            mission: (await this.missionStore.get(mission.id))!,
            assignment_mode: 'bidding',
            bidding_window_end: windowEnd
        };
    }

    /**
     * Submit bid for mission
     */
    async submitBid(missionId: string, agentId: string, bidData: {
        price: number;
        eta_minutes: number;
        bond_offered: number;
        message?: string;
    }): Promise<{ success: boolean; reason?: string; bid?: Bid }> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) {
            return { success: false, reason: 'Mission not found' };
        }

        const result = await this.biddingEngine.submitBid(mission, agentId, bidData);

        if (result.success && result.bid) {
            // Add bid to mission
            const bids = mission.bids || [];
            bids.push(result.bid);

            await this.missionStore.update(missionId, { bids });

            console.log(`[MissionRegistry] Bid added to mission ${missionId}`);
        }

        return result;
    }

    /**
     * Close bidding window and assign winner
     */
    private async closeBiddingAndAssign(missionId: string): Promise<void> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) {
            console.error(`[MissionRegistry] Mission ${missionId} not found`);
            return;
        }

        console.log(`[MissionRegistry] Closing bidding for mission ${missionId}`);

        const result = this.biddingEngine.selectWinner(mission);

        if (result.success && result.winner) {
            const assignmentDetails: AssignmentDetails = {
                agent_id: result.winner.agent_id,
                agent_name: result.winner.agent_name,
                assigned_at: new Date(),
                assignment_method: 'bidding',
                bid_id: result.winner.id
            };

            try {
                await this.transitionMission(missionId, 'assigned', {
                    assigned_agent: assignmentDetails
                });
            } catch (error: any) {
                console.error(`[MissionRegistry] CRITICAL: Failed to assign mission ${missionId}:`, error);
                return;
            }

            this.dispatchMissionToAgent(missionId, result.winner.agent_id);

            this.notifications.createTask(
                result.winner.agent_id,
                'mission_available',
                {
                    mission_id: missionId,
                    title: mission.title,
                    reward: result.winner.price,
                    action: 'You won the bid! Start work on mission'
                },
                'urgent'
            );

            console.log(`[MissionRegistry] Mission ${missionId} assigned to ${result.winner.agent_name}`);
        } else {
            try {
                await this.transitionMission(missionId, 'failed', {
                    failure_reason: result.reason || 'No valid bids'
                });
            } catch (error: any) {
                console.error(`[MissionRegistry] CRITICAL: Failed to mark mission ${missionId} as failed:`, error);
            }

            console.error(`[MissionRegistry] Mission ${missionId} failed: ${result.reason}`);
        }
    }

    /**
     * Manually assign mission (admin only)
     */
    async manualAssignment(missionId: string, agentId: string, reason: string): Promise<boolean> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) return false;

        const agent = await this.agentAuth.getById(agentId);
        if (!agent) return false;

        if (mission.status === 'bidding_open') {
            this.biddingEngine.closeBiddingWindow(missionId);
        }

        const assignmentDetails: AssignmentDetails = {
            agent_id: agentId,
            agent_name: agent.name,
            assigned_at: new Date(),
            assignment_method: 'manual'
        };

        await this.missionStore.update(missionId, {
            status: 'assigned',
            assigned_at: new Date(),
            assigned_agent: assignmentDetails
        });

        this.notifications.createTask(
            agentId,
            'mission_available',
            {
                mission_id: missionId,
                title: mission.title,
                reward: mission.reward,
                action: `Manually assigned: ${reason}`
            },
            'urgent'
        );

        console.log(`[MissionRegistry] Mission ${missionId} manually assigned to ${agent.name}: ${reason}`);

        return true;
    }

    /**
     * Get mission board with filters
     */
    async getMissionBoard(filters?: MissionFilters): Promise<Mission[]> {
        let missions = await this.missionStore.list();

        if (filters?.scope === 'mine' && filters?.viewer_id) {
            missions = missions.filter(m => m.requester_id === filters.viewer_id);
        } else if (filters?.scope === 'assigned_to_me' && filters?.viewer_id) {
            missions = missions.filter(m =>
                m.assigned_agent?.agent_id === filters.viewer_id ||
                m.claimed_by === filters.viewer_id
            );
        }

        if (filters?.status && filters.status !== 'all') {
            missions = missions.filter(m => m.status === filters.status);
        }

        if (filters?.type) {
            if (filters.type === 'crew') {
                missions = missions.filter(m => m.assignment_mode === 'crew');
            } else if (filters.type === 'solo') {
                missions = missions.filter(m => m.assignment_mode !== 'crew');
            }
        }

        if (filters?.specialty) {
            missions = missions.filter(m =>
                m.specialties?.some(s =>
                    s.toLowerCase().includes(filters.specialty!.toLowerCase())
                )
            );
        }

        if (filters?.min_reward !== undefined) {
            missions = missions.filter(m => m.reward >= filters.min_reward!);
        }

        if (filters?.max_reward !== undefined) {
            missions = missions.filter(m => m.reward <= filters.max_reward!);
        }

        if (filters?.assignment_mode) {
            missions = missions.filter(m => m.assignment_mode === filters.assignment_mode);
        }

        if (filters?.requester_id) {
            missions = missions.filter(m => m.requester_id === filters.requester_id);
        }

        return missions;
    }

    /**
     * Get mission by ID with full details
     */
    async getMission(missionId: string): Promise<Mission | null> {
        return await this.missionStore.get(missionId);
    }

    /**
     * Get missions for agent
     */
    async getAgentMissions(agentId: string): Promise<{
        active: Mission[];
        completed: Mission[];
        failed: Mission[];
    }> {
        const allMissions = await this.missionStore.list();

        const agentMissions = allMissions.filter(m =>
            m.assigned_agent?.agent_id === agentId ||
            m.claimed_by === agentId
        );

        return {
            active: agentMissions.filter(m =>
                ['assigned', 'executing', 'verifying'].includes(m.status)
            ),
            completed: agentMissions.filter(m => m.status === 'settled'),
            failed: agentMissions.filter(m => m.status === 'failed')
        };
    }

    /**
     * Start mission execution (requires worker bond)
     */
    async startMission(missionId: string, workerId: string): Promise<{
        success: boolean;
        bondStaked?: number;
        error?: string;
        code?: string;
    }> {
        const mission = await this.missionStore.get(missionId);

        if (!mission) {
            return { success: false, error: 'Mission not found', code: 'MISSION_NOT_FOUND' };
        }

        if (mission.status === 'bidding_open') {
            return {
                success: false,
                error: 'Cannot start mission: bidding still open',
                code: 'BIDDING_IN_PROGRESS'
            };
        }

        if (mission.status !== 'assigned') {
            return {
                success: false,
                error: `Mission not in assigned state: ${mission.status}`,
                code: 'INVALID_STATUS'
            };
        }

        if (mission.assigned_agent?.agent_id !== workerId) {
            return {
                success: false,
                error: 'Worker not assigned to this mission',
                code: 'WORKER_NOT_ASSIGNED'
            };
        }

        // Calculate required bond
        const bondRequirements = calculateBondRequirements(mission.reward);
        const bondAmount = bondRequirements.workerBond;

        console.log(`[MissionRegistry] Starting mission ${missionId}, worker bond required: ${bondAmount} $CLAWGER`);

        // Stake worker bond
        const bondResult = await this.bondManager.stakeWorkerBond(
            workerId,
            missionId,
            bondAmount
        );

        if (!bondResult.success) {
            console.error(`[MissionRegistry] Bond staking failed: ${bondResult.error}`);
            return {
                success: false,
                error: bondResult.error,
                code: bondResult.code
            };
        }

        // Canonical transition
        try {
            await this.transitionMission(missionId, 'executing');
        } catch (error: any) {
            console.error(`[MissionRegistry] CRITICAL: Failed to transition to executing:`, error);
            await this.bondManager.releaseWorkerBond(missionId);
            return {
                success: false,
                error: `Failed to start mission: ${error.message}`,
                code: 'PERSISTENCE_FAILURE'
            };
        }

        console.log(`[MissionRegistry] Mission ${missionId} execution started, bond ${bondAmount} $CLAWGER staked`);

        return {
            success: true,
            bondStaked: bondAmount
        };
    }

    /**
     * @deprecated Use startMission() which requires bond staking
     */
    async startExecution(missionId: string): Promise<boolean> {
        const mission = await this.missionStore.get(missionId);
        if (!mission || mission.status !== 'assigned') return false;

        await this.missionStore.update(missionId, {
            status: 'executing',
            executing_started_at: new Date()
        });

        console.log(`[MissionRegistry] Mission ${missionId} execution started`);
        return true;
    }

    /**
     * Submit work for verification
     */
    async submitWork(missionId: string, agentId: string, content: string, artifacts: ArtifactMetadata[]): Promise<boolean> {
        const mission = await this.missionStore.get(missionId);
        if (!mission || mission.status !== 'executing') return false;
        if (mission.assigned_agent?.agent_id !== agentId) return false;

        if (!content && (!artifacts || artifacts.length === 0)) {
            console.warn(`[MissionRegistry] Submission rejected: Empty content and artifacts`);
            return false;
        }

        try {
            await this.transitionMission(missionId, 'verifying', {
                submission: {
                    content,
                    artifacts: [],  // Legacy field
                    submitted_at: new Date()
                },
                work_artifacts: artifacts  // Real file uploads
            });
        } catch (error: any) {
            console.error(`[MissionRegistry] CRITICAL: Failed to transition to verifying:`, error);
            return false;
        }

        const requesterId = mission.requester_id;
        const requesterAgent = await this.agentAuth.getById(requesterId);

        if (requesterAgent) {
            await this.taskQueue.enqueue({
                agent_id: requesterId,
                type: 'verification_required',
                priority: 'urgent',
                payload: {
                    mission_id: missionId,
                    action: `Verify submission for '${mission.title}'`,
                    submission_content: content,
                    submission_artifacts: artifacts,
                    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h to verify
                }
            });
            console.log(`[MissionRegistry] Dispatched verification task to agent ${requesterId}`);
        } else {
            console.log(`[MissionRegistry] Work submitted. Waiting for human verification from ${requesterId}`);
        }

        console.log(`[MissionRegistry] Work submitted for mission ${missionId}`);
        return true;
    }

    /**
     * Dispatch mission to agent via task queue
     */
    private async dispatchMissionToAgent(missionId: string, agentId: string): Promise<void> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) return;

        console.log(`[MissionRegistry] 🚀 DISPATCHING mission ${missionId} to agent ${agentId}`);

        // Await the enqueue to ensure it's persisted in DB
        await this.taskQueue.enqueue({
            agent_id: agentId,
            type: 'mission_assigned',
            priority: 'high',
            payload: {
                mission_id: missionId,
                action: `Start work on '${mission.title}'. Submit results via POST /api/missions/${missionId}/submit`,
                deadline: mission.deadline,
                reward: mission.reward,
                requirements: mission.requirements,
                deliverables: mission.deliverables,
                description: mission.description
            }
        });

        console.log(`[MissionRegistry] ✅ DISPATCH COMPLETE for mission ${missionId} to agent ${agentId}`);
    }

    /**
     * Settle mission with automatic SettlementEngine integration
     */
    async settleMissionWithVerification(
        missionId: string,
        votes: Array<{
            verifierId: string;
            vote: 'APPROVE' | 'REJECT';
            feedback?: string;
        }>,
        verifiers: string[]
    ): Promise<{
        success: boolean;
        outcome?: 'PASS' | 'FAIL';
        settlement?: any;
        error?: string;
    }> {
        const mission = await this.missionStore.get(missionId);

        if (!mission) {
            return { success: false, error: 'Mission not found' };
        }

        if (!mission.assigned_agent) {
            return { success: false, error: 'No worker assigned' };
        }

        console.log(`\n[MissionRegistry] Settling mission ${missionId} with ${votes.length} verification votes\n`);

        await this.missionStore.update(missionId, {
            status: 'verifying',
            verifying_started_at: new Date()
        });

        const settlement = await this.settlementEngine.settleMission(
            missionId,
            mission.requester_id,
            mission.assigned_agent.agent_id,
            mission.reward,
            { votes, verifiers },
            mission.title,
            mission.assignment_mode === 'direct_hire' ? 'direct_hire' : (mission.assignment_mode === 'crew' ? 'crew' : 'solo')
        );

        if (!settlement.success) {
            console.error(`[MissionRegistry] Settlement failed: ${settlement.error}`);
            return {
                success: false,
                error: settlement.error
            };
        }

        if (settlement.outcome === 'PASS') {
            await this.missionStore.update(missionId, {
                status: 'settled',
                settled_at: new Date(),
                escrow: {
                    locked: false,
                    amount: mission.reward,
                    released_at: new Date()
                }
            });

            // Update agent reputation (success) - requires admin key or method on Auth
            // For now, assuming agentAuth has internal methods or we manually update DB
            // We can't use agent.reputation += 5 then save unless we have apiKey/updateProfile
            // But we can use `pool` if we had access. `AgentAuth` has `updateReputation`.
            await this.agentAuth.updateReputation(mission.assigned_agent.agent_id, (await this.agentAuth.getById(mission.assigned_agent.agent_id))!.reputation + 5);

            console.log(`[MissionRegistry] Mission ${missionId} settled successfully (PASS)\n`);

        } else {
            // FAIL
            await this.missionStore.update(missionId, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: 'Verification failed',
                escrow: {
                    locked: false,
                    amount: mission.reward,
                    released_at: new Date() // Actually refunded
                }
            });

            // Update agent reputation (failure)
            await this.agentAuth.updateReputation(mission.assigned_agent.agent_id, (await this.agentAuth.getById(mission.assigned_agent.agent_id))!.reputation - 10);

            console.log(`[MissionRegistry] Mission ${missionId} settled as failure (FAIL)\n`);
        }

        return {
            success: true,
            outcome: settlement.outcome,
            settlement
        };
    }

    /**
     * @deprecated Use settleMissionWithVerification() for automatic settlement
     */
    async settleMission(missionId: string, outcome: 'success' | 'failure', reason?: string): Promise<boolean> {
        const mission = await this.missionStore.get(missionId);
        if (!mission) return false;

        if (outcome === 'success') {
            const releaseResult = await this.escrowEngine.releaseToAgent(missionId, mission.assigned_agent!.agent_id);

            if (releaseResult.success) {
                await this.missionStore.update(missionId, {
                    status: 'settled',
                    settled_at: new Date(),
                    escrow: {
                        locked: false,
                        amount: mission.reward,
                        released_at: new Date()
                    }
                });

                await this.taskQueue.enqueue({
                    agent_id: mission.assigned_agent!.agent_id,
                    type: 'payment_received',
                    priority: 'high',
                    payload: {
                        mission_id: missionId,
                        action: `Payment received: ${mission.reward} $CLAWGER`,
                        amount: mission.reward
                    }
                });

                // Update agent reputation
                await this.agentAuth.updateReputation(mission.assigned_agent!.agent_id, (await this.agentAuth.getById(mission.assigned_agent!.agent_id))!.reputation + 2);

                console.log(`[MissionRegistry] Mission ${missionId} settled successfully. Funds released.`);
            } else {
                console.error(`[MissionRegistry] Failed to release escrow: ${releaseResult.error}`);
                return false;
            }

        } else {
            const slashResult = await this.escrowEngine.slashAndRefund(missionId, reason || 'Verification failed');

            if (slashResult.success) {
                await this.missionStore.update(missionId, {
                    status: 'failed',
                    failed_at: new Date(),
                    failure_reason: reason,
                    escrow: {
                        locked: false,
                        amount: mission.reward,
                        released_at: new Date()
                    }
                });

                await this.taskQueue.enqueue({
                    agent_id: mission.assigned_agent!.agent_id,
                    type: 'bond_slashed',
                    priority: 'high',
                    payload: {
                        mission_id: missionId,
                        action: `Mission rejected: ${reason}`,
                        reason: reason,
                        amount: 0
                    }
                });

                await this.agentAuth.updateReputation(mission.assigned_agent!.agent_id, (await this.agentAuth.getById(mission.assigned_agent!.agent_id))!.reputation - 5);

                console.log(`[MissionRegistry] Mission ${missionId} failed: ${reason}. Funds refunded.`);
            } else {
                console.error(`[MissionRegistry] Failed to refund escrow: ${slashResult.error}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Handle crew assignment - generate subtasks and dispatch to agents
     */
    private async handleCrewAssignment(mission: Mission): Promise<MissionCreationResult> {
        console.log(`[MissionRegistry] Setting up crew mission ${mission.id}`);

        // Generate default subtasks
        const subtasks = [
            {
                id: 'research',
                title: 'Research & Planning',
                description: 'Research requirements and create implementation plan',
                required_specialty: 'research',
                status: 'pending' as const,
                completion_percentage: 0
            },
            {
                id: 'implementation',
                title: 'Core Implementation',
                description: 'Build the main functionality',
                required_specialty: 'coding',
                status: 'pending' as const,
                completion_percentage: 0
            },
            {
                id: 'design',
                title: 'UI/UX Design',
                description: 'Create user interface and experience',
                required_specialty: 'design',
                status: 'pending' as const,
                completion_percentage: 0
            }
        ];

        // Update mission with task graph
        await this.missionStore.update(mission.id, {
            status: 'posted',
            task_graph: {
                nodes: subtasks.reduce((acc, st) => {
                    acc[st.id] = st;
                    return acc;
                }, {} as any),
                edges: {}
            },
            crew_assignments: []
        });

        // Enqueue crew_task_available for each subtask
        for (const subtask of subtasks) {
            await this.taskQueue.enqueue({
                agent_id: 'broadcast',
                type: 'crew_task_available',
                priority: 'high',
                payload: {
                    parent_mission_id: mission.id,
                    subtask_id: subtask.id,
                    title: subtask.title,
                    description: subtask.description,
                    required_specialty: subtask.required_specialty,
                    action: `Claim subtask "${subtask.title}" for mission "${mission.title}"`
                }
            });
        }

        console.log(`[MissionRegistry] Crew mission ${mission.id} created with ${subtasks.length} subtasks`);

        return {
            mission: (await this.missionStore.get(mission.id))!,
            assignment_mode: 'crew',
            crew_subtasks: subtasks.map(st => ({
                id: st.id,
                title: st.title,
                required_specialty: st.required_specialty
            }))
        };
    }
}
