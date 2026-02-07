/**
 * Mission Registry
 * 
 * Orchestrates mission creation, assignment, and lifecycle management.
 * Determines assignment mode and triggers appropriate engine.
 */

import { MissionStore, Mission, Bid, AssignmentDetails } from './mission-store';
import { AssignmentEngine } from './assignment-engine';
import { BiddingEngine } from './bidding-engine';
import { AgentAuth } from '../registry/agent-auth';
import { AgentNotificationQueue } from '../tasks/agent-notification-queue';
import { TaskQueue } from '../dispatch/task-queue';
import { HeartbeatManager } from '../dispatch/heartbeat-manager';
import { EscrowEngine } from '../escrow/escrow-engine';
import { AssignmentHistoryTracker } from './assignment-history';
import { BondManager } from '../bonds/bond-manager';
import { SettlementEngine } from '../settlement/settlement-engine';
import { ECONOMY_CONFIG, calculateBondRequirements } from '../../config/economy';

export interface MissionCreationParams {
    requester_id: string;
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
}

export interface MissionCreationResult {
    mission: Mission;
    assignment_mode: 'autopilot' | 'bidding';
    bidding_window_end?: Date;
    assigned_agent?: {
        agent_id: string;
        agent_name: string;
    };
    assignment_reasoning?: {
        base_score: number;
        recent_wins: number;
        diminishing_multiplier: number;
        adjusted_score: number;
        rank_in_pool: number;
        pool_size: number;
    };
}

export interface MissionFilters {
    status?: string;
    specialty?: string;
    min_reward?: number;
    max_reward?: number;
    assignment_mode?: 'autopilot' | 'bidding';
    requester_id?: string;
    type?: 'crew' | 'solo';
    scope?: 'all' | 'mine' | 'assigned_to_me';
    viewer_id?: string;
}

export class MissionRegistry {
    private missionStore: MissionStore;
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

    // Configuration
    private readonly BIDDING_THRESHOLD = 100; // $CLAWGER

    constructor(
        missionStore: MissionStore,
        agentAuth: AgentAuth,
        notifications: AgentNotificationQueue,
        taskQueue: TaskQueue,
        heartbeatManager: HeartbeatManager,
        escrowEngine: EscrowEngine,
        assignmentHistory: AssignmentHistoryTracker,
        bondManager: BondManager,
        settlementEngine: SettlementEngine
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
        this.assignmentEngine = new AssignmentEngine(agentAuth, assignmentHistory);
        this.biddingEngine = new BiddingEngine(agentAuth, notifications);
    }

    /**
     * Create new mission and trigger assignment
     */
    async createMission(params: MissionCreationParams): Promise<MissionCreationResult> {
        console.log(`[MissionRegistry] Creating mission: ${params.title}`);

        // Determine assignment mode
        const assignment_mode: 'autopilot' | 'bidding' =
            params.force_bidding || params.reward >= this.BIDDING_THRESHOLD
                ? 'bidding'
                : 'autopilot';

        console.log(`[MissionRegistry] Assignment mode: ${assignment_mode}`);

        // Create mission
        const mission = this.missionStore.create({
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
            escrow: {
                locked: false, // Will be locked by escrow manager
                amount: params.reward
            }
        });

        // Lock escrow via EscrowEngine
        const escrowResult = this.escrowEngine.validateAndLock(params.requester_id, params.reward, mission.id);

        if (!escrowResult.success) {
            console.error(`[MissionRegistry] Failed to lock escrow: ${escrowResult.error}`);
            // In a real DB transaction, we would rollback creation here.
            // For now, mission is created but will be stuck or we should delete it.
            // Let's set status to failed immediately
            this.missionStore.update(mission.id, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: 'Escrow lock failed: ' + escrowResult.error
            });
            return {
                mission: this.missionStore.get(mission.id)!,
                assignment_mode
            };
        } else {
            // Update mission to reflect locked status (MissionStore default is locked: false)
            this.missionStore.update(mission.id, {
                escrow: {
                    locked: true,
                    amount: params.reward,
                    locked_at: new Date()
                }
            });
        }

        if (assignment_mode === 'autopilot') {
            // Autopilot: Assign immediately
            return await this.handleAutopilotAssignment(mission);
        } else {
            // Bidding: Open bidding window
            return this.handleBiddingMode(mission);
        }
    }

    /**
     * Handle autopilot assignment
     */
    private async handleAutopilotAssignment(mission: Mission): Promise<MissionCreationResult> {
        const result = await this.assignmentEngine.assignAgent(mission);

        if (result.success && result.assigned_agent) {
            // Update mission with assignment
            const assignmentDetails: AssignmentDetails = {
                agent_id: result.assigned_agent.agent_id,
                agent_name: result.assigned_agent.agent_name,
                assigned_at: new Date(),
                assignment_method: 'autopilot'
            };

            this.missionStore.update(mission.id, {
                status: 'assigned',
                assigned_at: new Date(),
                assigned_agent: assignmentDetails
            });

            // Dispatch task to agent
            this.dispatchMissionToAgent(mission.id, result.assigned_agent.agent_id);

            // Notify agent (legacy notification system)
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
                mission: this.missionStore.get(mission.id)!,
                assignment_mode: 'autopilot',
                assigned_agent: result.assigned_agent,
                assignment_reasoning: result.assignment_reasoning
            };
        } else {
            // Assignment failed
            this.missionStore.update(mission.id, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: result.reason || 'No suitable agent found'
            });

            console.error(`[MissionRegistry] Mission ${mission.id} failed: ${result.reason}`);

            return {
                mission: this.missionStore.get(mission.id)!,
                assignment_mode: 'autopilot'
            };
        }
    }

    /**
     * Handle bidding mode
     */
    private handleBiddingMode(mission: Mission): MissionCreationResult {
        // Open bidding window
        const windowEnd = this.biddingEngine.openBiddingWindow(mission, (missionId) => {
            this.closeBiddingAndAssign(missionId);
        });

        // Update mission status
        this.missionStore.update(mission.id, {
            status: 'bidding_open',
            bidding_window_end: windowEnd
        });

        console.log(`[MissionRegistry] Bidding window opened for mission ${mission.id} until ${windowEnd.toISOString()}`);

        return {
            mission: this.missionStore.get(mission.id)!,
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
        const mission = this.missionStore.get(missionId);
        if (!mission) {
            return { success: false, reason: 'Mission not found' };
        }

        const result = await this.biddingEngine.submitBid(mission, agentId, bidData);

        if (result.success && result.bid) {
            // Add bid to mission
            const bids = mission.bids || [];
            bids.push(result.bid);

            this.missionStore.update(missionId, { bids });

            console.log(`[MissionRegistry] Bid added to mission ${missionId}`);
        }

        return result;
    }

    /**
     * Close bidding window and assign winner
     */
    private async closeBiddingAndAssign(missionId: string): Promise<void> {
        const mission = this.missionStore.get(missionId);
        if (!mission) {
            console.error(`[MissionRegistry] Mission ${missionId} not found`);
            return;
        }

        console.log(`[MissionRegistry] Closing bidding for mission ${missionId}`);

        const result = this.biddingEngine.selectWinner(mission);

        if (result.success && result.winner) {
            // Assign to winner
            const assignmentDetails: AssignmentDetails = {
                agent_id: result.winner.agent_id,
                agent_name: result.winner.agent_name,
                assigned_at: new Date(),
                assignment_method: 'bidding',
                bid_id: result.winner.id
            };

            this.missionStore.update(missionId, {
                status: 'assigned',
                assigned_at: new Date(),
                assigned_agent: assignmentDetails
            });

            // Dispatch task to winner
            this.dispatchMissionToAgent(missionId, result.winner.agent_id);

            // Notify winner (legacy)
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
            // No winner or tie
            this.missionStore.update(missionId, {
                status: 'failed',
                failed_at: new Date(),
                failure_reason: result.reason || 'No valid bids'
            });

            console.error(`[MissionRegistry] Mission ${missionId} failed: ${result.reason}`);
        }
    }

    /**
     * Manually assign mission (admin only)
     */
    async manualAssignment(missionId: string, agentId: string, reason: string): Promise<boolean> {
        const mission = this.missionStore.get(missionId);
        if (!mission) return false;

        const agent = this.agentAuth.getById(agentId);
        if (!agent) return false;

        // Close bidding if active
        if (mission.status === 'bidding_open') {
            this.biddingEngine.closeBiddingWindow(missionId);
        }

        const assignmentDetails: AssignmentDetails = {
            agent_id: agentId,
            agent_name: agent.name,
            assigned_at: new Date(),
            assignment_method: 'manual'
        };

        this.missionStore.update(missionId, {
            status: 'assigned',
            assigned_at: new Date(),
            assigned_agent: assignmentDetails
        });

        // Notify agent
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
    getMissionBoard(filters?: MissionFilters): Mission[] {
        let missions = this.missionStore.list();

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
                // Missions tagged with 'crew' or requiring > 1 agent
                missions = missions.filter(m => m.tags?.includes('crew') || m.requirements?.some((r: string) => r.toLowerCase().includes('crew')));
            } else if (filters.type === 'solo') {
                missions = missions.filter(m => !m.tags?.includes('crew') && !m.requirements?.some((r: string) => r.toLowerCase().includes('crew')));
            }
        }

        if (filters?.specialty) {
            missions = missions.filter(m =>
                m.specialties.some(s =>
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
    getMission(missionId: string): Mission | null {
        return this.missionStore.get(missionId);
    }

    /**
     * Get missions for agent
     */
    getAgentMissions(agentId: string): {
        active: Mission[];
        completed: Mission[];
        failed: Mission[];
    } {
        const allMissions = this.missionStore.list();

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
     * 
     * CRITICAL: Worker MUST stake bond before mission can begin execution
     */
    async startMission(missionId: string, workerId: string): Promise<{
        success: boolean;
        bondStaked?: number;
        error?: string;
        code?: string;
    }> {
        const mission = this.missionStore.get(missionId);

        // Validation
        if (!mission) {
            return { success: false, error: 'Mission not found', code: 'MISSION_NOT_FOUND' };
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

        // Update mission status to executing
        this.missionStore.update(missionId, {
            status: 'executing',
            executing_started_at: new Date()
        });

        console.log(`[MissionRegistry] Mission ${missionId} execution started, bond ${bondAmount} $CLAWGER staked`);

        return {
            success: true,
            bondStaked: bondAmount
        };
    }

    /**
     * @deprecated Use startMission() which requires bond staking
     */
    startExecution(missionId: string): boolean {
        const mission = this.missionStore.get(missionId);
        if (!mission || mission.status !== 'assigned') return false;

        this.missionStore.update(missionId, {
            status: 'executing',
            executing_started_at: new Date()
        });

        console.log(`[MissionRegistry] Mission ${missionId} execution started`);
        return true;
    }

    /**
     * Submit work for verification
     */
    submitWork(missionId: string, agentId: string, content: string, artifacts: string[]): boolean {
        const mission = this.missionStore.get(missionId);
        if (!mission || mission.status !== 'executing') return false;
        if (mission.assigned_agent?.agent_id !== agentId) return false;

        // Validate content
        if (!content && (!artifacts || artifacts.length === 0)) {
            console.warn(`[MissionRegistry] Submission rejected: Empty content and artifacts`);
            return false;
        }

        this.missionStore.update(missionId, {
            status: 'verifying',
            verifying_started_at: new Date(),
            submission: {
                content,
                artifacts,
                submitted_at: new Date()
            }
        });

        // Dispatch verification task to requester (if they are an agent) OR just log for human verifier
        const requesterId = mission.requester_id;

        // Check if requester is an agent using AgentAuth
        const requesterAgent = this.agentAuth.getById(requesterId); // Assuming requester_id can be agent ID

        if (requesterAgent) {
            this.taskQueue.enqueue({
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
            // Human requester - UI will poll for status 'verifying'
            // We could add a 'user_notifications' queue later
            console.log(`[MissionRegistry] Work submitted. Waiting for human verification from ${requesterId}`);
        }

        console.log(`[MissionRegistry] Work submitted for mission ${missionId}`);
        return true;
    }

    /**
     * Dispatch mission to agent via task queue
     */
    private dispatchMissionToAgent(missionId: string, agentId: string): void {
        const mission = this.missionStore.get(missionId);
        if (!mission) return;

        this.taskQueue.enqueue({
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

        console.log(`[MissionRegistry] Dispatched mission ${missionId} to agent ${agentId}`);
    }

    /**
     * Settle mission with automatic SettlementEngine integration
     * 
     * Call this after verification consensus is reached.
     * Settlement is AUTOMATIC and deterministic.
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
        const mission = this.missionStore.get(missionId);

        if (!mission) {
            return { success: false, error: 'Mission not found' };
        }

        if (!mission.assigned_agent) {
            return { success: false, error: 'No worker assigned' };
        }

        console.log(`\n[MissionRegistry] Settling mission ${missionId} with ${votes.length} verification votes\n`);

        // Update mission to settling state
        this.missionStore.update(missionId, {
            status: 'verifying',
            verifying_started_at: new Date()
        });

        // Call SettlementEngine for automatic settlement
        const settlement = await this.settlementEngine.settleMission(
            missionId,
            mission.requester_id,
            mission.assigned_agent.agent_id,
            mission.reward,
            { votes, verifiers }
        );

        if (!settlement.success) {
            console.error(`[MissionRegistry] Settlement failed: ${settlement.error}`);
            return {
                success: false,
                error: settlement.error
            };
        }

        // Update mission based on outcome
        if (settlement.outcome === 'PASS') {
            this.missionStore.update(missionId, {
                status: 'settled',
                settled_at: new Date(),
                escrow: {
                    locked: false,
                    amount: mission.reward,
                    released_at: new Date()
                }
            });

            // Update agent reputation (success)
            const agent = this.agentAuth.getById(mission.assigned_agent.agent_id);
            if (agent) {
                agent.reputation = Math.min(100, agent.reputation + 5);
            }

            console.log(`[MissionRegistry] Mission ${missionId} settled successfully (PASS)\n`);

        } else {
            // FAIL
            this.missionStore.update(missionId, {
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
            const agent = this.agentAuth.getById(mission.assigned_agent.agent_id);
            if (agent) {
                agent.reputation = Math.max(0, agent.reputation - 10);
            }

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
     * 
     * Legacy manual settlement method
     */
    settleMission(missionId: string, outcome: 'success' | 'failure', reason?: string): boolean {
        const mission = this.missionStore.get(missionId);
        if (!mission) return false;

        if (outcome === 'success') {
            // Release Escrow
            const releaseResult = this.escrowEngine.releaseToAgent(missionId, mission.assigned_agent!.agent_id);

            if (releaseResult.success) {
                this.missionStore.update(missionId, {
                    status: 'settled',
                    settled_at: new Date(),
                    escrow: {
                        locked: false,
                        amount: mission.reward,
                        released_at: new Date()
                    }
                });

                // Dispatch Payment Notification
                this.taskQueue.enqueue({
                    agent_id: mission.assigned_agent!.agent_id,
                    type: 'payment_received',
                    priority: 'high',
                    payload: {
                        mission_id: missionId,
                        action: `Payment received: ${mission.reward} $CLAWGER`,
                        amount: mission.reward
                    }
                });

                // Update agent reputation (mock)
                const agent = this.agentAuth.getById(mission.assigned_agent!.agent_id);
                if (agent) {
                    // Workaround: Mock reputation increase on the object directly
                    // Note: This won't persist to disk unless we have the API key to call updateProfile
                    // or add a method to AgentAuth to update by ID (admin only)
                    agent.reputation = Math.min(100, agent.reputation + 2);
                }

                console.log(`[MissionRegistry] Mission ${missionId} settled successfully. Funds released.`);
            } else {
                console.error(`[MissionRegistry] Failed to release escrow: ${releaseResult.error}`);
                // Mission stays in 'verifying' or moves to 'failed'? 
                // Currently returning false implies failure to settle
                return false;
            }

        } else {
            // Slash and Refund
            // Default: 100% refund to requester (100% slash of potential earnings, essentially cancellation)
            // If we had staking, we would slash the stake.
            // Here "slashing" means the agent doesn't get paid, and money goes back to requester.
            const slashResult = this.escrowEngine.slashAndRefund(missionId, reason || 'Verification failed');

            if (slashResult.success) {
                this.missionStore.update(missionId, {
                    status: 'failed',
                    failed_at: new Date(),
                    failure_reason: reason,
                    escrow: {
                        locked: false,
                        amount: mission.reward,
                        released_at: new Date() // Actually refunded
                    }
                });

                // Dispatch Failure/Slash Notification
                this.taskQueue.enqueue({
                    agent_id: mission.assigned_agent!.agent_id,
                    type: 'bond_slashed', // or mission_failed
                    priority: 'high',
                    payload: {
                        mission_id: missionId,
                        action: `Mission rejected: ${reason}`,
                        reason: reason,
                        amount: 0 // No bond staked yet in this MVP
                    }
                });

                // Reduce reputation
                const agent = this.agentAuth.getById(mission.assigned_agent!.agent_id);
                if (agent) {
                    agent.reputation = Math.max(0, agent.reputation - 5);
                }

                console.log(`[MissionRegistry] Mission ${missionId} failed: ${reason}. Funds refunded.`);
            } else {
                console.error(`[MissionRegistry] Failed to refund escrow: ${slashResult.error}`);
                return false;
            }
        }

        return true;
    }
}
