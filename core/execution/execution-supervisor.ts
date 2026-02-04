/**
 * Execution Supervisor
 * Monitors work contracts and enforces execution discipline
 */

import {
    WorkContract,
    ContractStatus,
    FailureType,
    startExecution,
    recordHeartbeat,
    isGracePeriodElapsed,
    isHeartbeatStale,
    detectFailureType,
    submitWork,
    completeVerification,
    recordFailure,
    canRetry,
    reassignWorker,
    markFailed,
    markTimeout
} from './work-contract';
import { VerifierConsensus, ConsensusResult } from '../verification/verifier-consensus';
import { LocalAgentManager } from '../local/local-agent-manager';
import { ProcessEnforcer } from '../local/process-enforcer';
import { ClawgerMode, getCurrentMode } from '../../config/mode-config';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface SupervisorConfig {
    mode: ClawgerMode;
    check_interval_ms: number;  // How often to check contracts (default: 5s)
    local_agent_manager?: LocalAgentManager;
    process_enforcer?: ProcessEnforcer;
}

export class ExecutionSupervisor {
    private config: SupervisorConfig;
    private contracts: Map<string, WorkContract> = new Map();
    private monitoring: boolean = false;
    private monitoringInterval?: NodeJS.Timeout;

    constructor(config: Partial<SupervisorConfig> = {}) {
        this.config = {
            mode: config.mode || getCurrentMode(),
            check_interval_ms: config.check_interval_ms || 5000,
            local_agent_manager: config.local_agent_manager,
            process_enforcer: config.process_enforcer
        };

        // Validate LOCAL mode dependencies
        if (this.config.mode === 'LOCAL') {
            if (!this.config.local_agent_manager || !this.config.process_enforcer) {
                throw new Error('LOCAL mode requires local_agent_manager and process_enforcer');
            }
        }
    }

    /**
     * Register contract for supervision
     */
    registerContract(contract: WorkContract): void {
        const prefix = getLogPrefix();

        this.contracts.set(contract.contract_id, contract);

        logger.info(`${prefix} [SUPERVISOR] Registered contract ${contract.contract_id}`);
        logger.info(`${prefix} Mode: ${this.config.mode}`);
        logger.info(`${prefix} Monitoring: ${this.monitoring ? 'ACTIVE' : 'INACTIVE'}`);
    }

    /**
     * Start monitoring all contracts
     */
    startMonitoring(): void {
        const prefix = getLogPrefix();

        if (this.monitoring) {
            logger.warn(`${prefix} [SUPERVISOR] Already monitoring`);
            return;
        }

        this.monitoring = true;

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} SUPERVISOR STARTED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Mode: ${this.config.mode}`);
        logger.info(`${prefix} Check interval: ${this.config.check_interval_ms / 1000}s`);
        logger.info(`${prefix} ========================================\n`);

        this.monitoringInterval = setInterval(() => {
            this.checkAllContracts();
        }, this.config.check_interval_ms);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        const prefix = getLogPrefix();

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        this.monitoring = false;

        logger.info(`${prefix} [SUPERVISOR] Stopped monitoring`);
    }

    /**
     * Check all active contracts
     */
    private checkAllContracts(): void {
        for (const contract of this.contracts.values()) {
            if (this.isActiveContract(contract)) {
                this.checkContract(contract);
            }
        }
    }

    /**
     * Check if contract is active (needs monitoring)
     */
    private isActiveContract(contract: WorkContract): boolean {
        return ['assigned', 'executing', 'verifying'].includes(contract.status);
    }

    /**
     * Check single contract
     */
    private checkContract(contract: WorkContract): void {
        const prefix = getLogPrefix();

        // Check 1: Deadline timeout
        const now = new Date();
        if (now > contract.deadline) {
            logger.warn(`${prefix} [SUPERVISOR] Deadline exceeded: ${contract.contract_id}`);
            this.handleTimeout(contract);
            return;
        }

        // Check 2: Heartbeat (only if executing and grace period elapsed)
        if (contract.status === 'executing') {
            if (isGracePeriodElapsed(contract)) {
                if (isHeartbeatStale(contract)) {
                    logger.warn(`${prefix} [SUPERVISOR] Heartbeat stale: ${contract.contract_id}`);
                    this.handleHeartbeatFailure(contract);
                    return;
                }
            } else {
                // Still in grace period
                logger.debug(`${prefix} [SUPERVISOR] ${contract.contract_id} in grace period`);
            }
        }

        // Check 3: Verification timeout (optional - could add later)
        // Check 3: Verification Consensus
        if (contract.status === 'verifying') {
            this.checkVerificationStatus(contract);
        }
    }

    /**
     * Check verification status and enforce consensus
     */
    private checkVerificationStatus(contract: WorkContract): void {
        const prefix = getLogPrefix();

        // Check if all verifiers have submitted
        const submissions = contract.verifier_submissions || [];
        const requiredVerifiers = contract.verifiers.length;

        if (submissions.length < requiredVerifiers) {
            // Still waiting for verifiers
            // TODO: Add verification timeout check
            return;
        }

        logger.info(`${prefix} [SUPERVISOR] All verifiers submitted (${submissions.length}/${requiredVerifiers})`);

        // Evaluate consensus
        const result = VerifierConsensus.evaluate(submissions);

        // Enforce result
        if (result.final_verdict === 'PASS') {
            this.handleVerificationPass(contract, result);
        } else {
            this.handleVerificationFail(contract, result);
        }

        // Handle dishonesty penalties
        if (result.dishonest_verifiers.length > 0) {
            this.penalizeDishonestVerifiers(result.dishonest_verifiers);
        }
    }

    /**
     * Handle verification PASS
     */
    private handleVerificationPass(contract: WorkContract, consensus: ConsensusResult): void {
        const prefix = getLogPrefix();
        logger.info(`${prefix} [SUPERVISOR] Verification PASSED via consensus (${consensus.status})`);
        completeVerification(contract, true);
        // Payment is handled in completeVerification logs for now
    }

    /**
     * Handle verification FAIL
     */
    private handleVerificationFail(contract: WorkContract, consensus: ConsensusResult): void {
        const prefix = getLogPrefix();
        logger.warn(`${prefix} [SUPERVISOR] Verification FAILED via consensus (${consensus.status})`);
        logger.warn(`${prefix} Reason: ${consensus.annotated_reason}`);

        // Mark as worker failure
        completeVerification(contract, false); // Sets verification_result=false

        // Enforce penalties
        this.enforceKill(contract.worker, 'VERIFICATION_FAILED', consensus.annotated_reason);

        // Retry logic is inside handleHeartbeatFailure currently, but completeVerification doesn't trigger retry.
        // We need to coordinate this. completeVerification sets status to 'completed' if pass, but logs warn if fail.
        // We should treat this as a failure that might allow retry if we want, but requirement says "Failed verification slashes worker bond".
        // Usually verification failure is final for the submitted work.
        // Supervisor logic for "completeVerification" with false currently just logs.

        // Let's rely on markFailed context or similar. 
        // For CLAWGER, verification failure is usually fatal or a slashable offense.
        // Assuming strict discipline: Verification Fail = Slash + Fail contract (no retry on bad work?)
        // Or should we allow retry? "Hard termination rules: kill worker, reassign once".
        // If work was bad, maybe reassign?
        // Let's assume we allow retry if max_retries not reached.

        if (canRetry(contract)) {
            logger.info(`${prefix} [SUPERVISOR] Retry allowed for verification failure`);
            const newWorker = this.getReplacementWorker(contract);
            if (newWorker) {
                // Record failure creates the history entry
                recordFailure(contract, 'VERIFICATION_FAILED', consensus.annotated_reason);
                reassignWorker(contract, newWorker);
            } else {
                markFailed(contract, 'Verification failed and no replacement worker');
            }
        } else {
            markFailed(contract, 'Verification failed and max retries exhausted');
        }
    }

    /**
     * Penalize dishonest verifiers
     */
    private penalizeDishonestVerifiers(dishonestVerifiers: string[]): void {
        const prefix = getLogPrefix();
        logger.warn(`${prefix} [SUPERVISOR] Penalizing dishonest verifiers: ${dishonestVerifiers.join(', ')}`);

        dishonestVerifiers.forEach(verifier => {
            if (this.config.mode === 'LOCAL') {
                // Local penalty
                logger.warn(`${prefix} [LOCAL] Reputation penalty for ${verifier}`);
                // this.config.local_agent_manager?.slashReputation(verifier, 10);
            } else {
                // Public penalty
                logger.warn(`${prefix} [PUBLIC] Slashing verifier bond for ${verifier}`);
            }
        });
    }

    /**
     * Handle deadline timeout
     */
    private handleTimeout(contract: WorkContract): void {
        const prefix = getLogPrefix();

        logger.error(`${prefix} [SUPERVISOR] TIMEOUT enforcement: ${contract.contract_id}`);

        // Kill worker immediately
        this.enforceKill(contract.worker, 'TIMEOUT', 'Deadline exceeded');

        // Mark contract as timed out
        markTimeout(contract);

        // Refund proposer (100% in timeout case)
        this.enforceRefund(contract, 1.0);
    }

    /**
     * Handle heartbeat failure (stall or crash)
     */
    private handleHeartbeatFailure(contract: WorkContract): void {
        const prefix = getLogPrefix();

        // Detect failure type
        const failureType = detectFailureType(contract);
        const reason = failureType === 'STALL'
            ? 'Worker stalled (no heartbeat)'
            : 'Worker crashed (never started)';

        logger.warn(`${prefix} [SUPERVISOR] ${failureType} detected: ${contract.contract_id}`);

        // Kill worker
        this.enforceKill(contract.worker, failureType, reason);

        // Record failure
        recordFailure(contract, failureType, reason);

        // Check if retry is possible
        if (canRetry(contract)) {
            logger.info(`${prefix} [SUPERVISOR] Retry allowed: ${contract.retry_count}/${contract.max_retries}`);

            // Get replacement worker
            const newWorker = this.getReplacementWorker(contract);

            if (newWorker) {
                reassignWorker(contract, newWorker);
                logger.info(`${prefix} [SUPERVISOR] Work reassigned to ${newWorker}`);
            } else {
                logger.error(`${prefix} [SUPERVISOR] No replacement worker available`);
                markFailed(contract, 'No replacement worker available');
                this.enforceRefund(contract, 0.8); // Refund 80%
            }
        } else {
            logger.error(`${prefix} [SUPERVISOR] Max retries exhausted`);
            markFailed(contract, 'Max retries exhausted');
            this.enforceRefund(contract, 0.8); // Refund 80%
        }
    }

    /**
     * Enforce kill (mode-specific)
     */
    private enforceKill(worker: string, failureType: FailureType, reason: string): void {
        const prefix = getLogPrefix();

        if (this.config.mode === 'LOCAL') {
            // LOCAL mode: Kill process
            const agent = this.config.local_agent_manager!.getAgent(worker);

            if (agent) {
                logger.warn(`${prefix} [LOCAL] Killing process: PID ${agent.pid}`);
                this.config.process_enforcer!.killProcess(agent.pid, worker, reason);

                // Quarantine based on failure type
                if (failureType === 'STALL') {
                    // Stall = intentional misbehavior → longer quarantine
                    this.config.local_agent_manager!.quarantine(worker, 60 * 60 * 1000); // 1 hour
                } else {
                    // Crash = might be accidental → shorter quarantine
                    this.config.local_agent_manager!.quarantine(worker, 30 * 60 * 1000); // 30 min
                }
            }
        } else {
            // PUBLIC mode: Slash bond
            logger.warn(`${prefix} [PUBLIC] Slashing bond: ${worker}`);
            this.slashBond(worker, failureType);
        }
    }

    /**
     * Slash bond (PUBLIC mode)
     */
    private slashBond(worker: string, failureType: FailureType): void {
        const prefix = getLogPrefix();

        // In PUBLIC mode, this would call smart contract
        logger.warn(`${prefix} [PUBLIC] Bond slashed: ${worker}`);
        logger.warn(`${prefix} Failure type: ${failureType}`);

        // Penalty based on failure type
        const penalty = failureType === 'STALL' ? 1.0 : 0.5; // Stall = 100%, Crash = 50%
        logger.warn(`${prefix} Penalty: ${(penalty * 100).toFixed(0)}% of bond`);

        // TODO: Call smart contract to slash bond
        // await clawgerManager.slashWorker(worker, penalty);
    }

    /**
     * Enforce refund (mode-specific)
     */
    private enforceRefund(contract: WorkContract, percentage: number): void {
        const prefix = getLogPrefix();

        const refundAmount = parseFloat(contract.budget) * percentage;

        if (this.config.mode === 'LOCAL') {
            // LOCAL mode: Just log (no real money)
            logger.info(`${prefix} [LOCAL] Internal refund: ${refundAmount.toFixed(2)} MON (${(percentage * 100).toFixed(0)}%)`);
        } else {
            // PUBLIC mode: Refund from escrow
            logger.info(`${prefix} [PUBLIC] Refunding from escrow: ${refundAmount.toFixed(2)} MON`);

            // TODO: Call smart contract to refund
            // await clawgerManager.refundProposer(contract.proposal_id, refundAmount);
        }
    }

    /**
     * Get replacement worker (exclude failed workers)
     */
    private getReplacementWorker(contract: WorkContract): string | null {
        const prefix = getLogPrefix();

        // Get list of failed workers
        const failedWorkers = contract.reassigned_from.map(r => r.worker);
        failedWorkers.push(contract.worker); // Include current worker

        logger.info(`${prefix} [SUPERVISOR] Excluding failed workers: ${failedWorkers.join(', ')}`);

        if (this.config.mode === 'LOCAL') {
            // LOCAL mode: Get available workers from agent manager
            const available = this.config.local_agent_manager!.getAvailableWorkers();
            const replacement = available.find(a => !failedWorkers.includes(a.address));

            return replacement?.address || null;
        } else {
            // PUBLIC mode: Query agent registry
            // TODO: Query registry for available workers
            // const workers = await agentRegistry.queryWorkers(minReputation);
            // return workers.find(w => !failedWorkers.includes(w.address));

            // For now, return mock
            return '0xREPLACEMENT_WORKER';
        }
    }

    /**
     * Get contract by ID
     */
    getContract(contractId: string): WorkContract | undefined {
        return this.contracts.get(contractId);
    }

    /**
     * Get all contracts
     */
    getAllContracts(): WorkContract[] {
        return Array.from(this.contracts.values());
    }

    /**
     * Get active contracts
     */
    getActiveContracts(): WorkContract[] {
        return this.getAllContracts().filter(c => this.isActiveContract(c));
    }

    /**
     * Get statistics
     */
    getStatistics(): {
        total: number;
        active: number;
        completed: number;
        failed: number;
        timeout: number;
    } {
        const contracts = this.getAllContracts();

        return {
            total: contracts.length,
            active: contracts.filter(c => this.isActiveContract(c)).length,
            completed: contracts.filter(c => c.status === 'completed').length,
            failed: contracts.filter(c => c.status === 'failed').length,
            timeout: contracts.filter(c => c.status === 'timeout').length
        };
    }
}
