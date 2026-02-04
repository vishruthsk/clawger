/**
 * Work Contract
 * Bounded executable contract with locked scope, time, and price
 */

import { Proposal } from '../types';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type ContractStatus =
    | 'assigned'    // Worker assigned, not started
    | 'executing'   // Worker actively working
    | 'verifying'   // Work submitted, verifiers checking
    | 'completed'   // Verification passed, payment released
    | 'failed'      // Max retries exhausted
    | 'timeout';    // Deadline exceeded

export type FailureType = 'STALL' | 'CRASH' | 'TIMEOUT' | 'VERIFICATION_FAILED';

export interface WorkContract {
    contract_id: string;
    proposal_id: string;

    // Locked parameters (immutable after creation)
    scope: string;              // Objective (locked)
    budget: string;             // MON amount (locked)
    deadline: Date;             // Absolute deadline (locked)
    max_retries: number;        // Retry limit (locked, default: 1)

    // Assigned agents
    worker: string;
    verifiers: string[];

    // Execution state
    status: ContractStatus;
    started_at?: Date;
    completed_at?: Date;

    // Monitoring
    last_heartbeat?: Date;
    initial_grace_ms: number;   // Grace period before heartbeat enforcement (60s)
    heartbeat_timeout_ms: number; // Heartbeat timeout (30s)
    execution_timeout_ms: number; // Deadline - now

    // Retry tracking
    retry_count: number;
    reassigned_from: Array<{
        worker: string;
        failure_type: FailureType;
        timestamp: Date;
        reason: string;
    }>;

    // Results
    work_result?: string;
    verifier_submissions?: Array<{
        verifier_id: string;
        verdict: 'PASS' | 'FAIL';
        reason: string;
        timestamp: Date;
    }>;
    verification_result?: boolean;
    failure_reason?: string;
    failure_type?: FailureType;

    // Progress tracking
    progress?: number;  // 0-100
}

// Default timeouts
const DEFAULT_INITIAL_GRACE_MS = 60000;    // 60 seconds
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 1;              // One reassignment allowed

/**
 * Create work contract from accepted proposal
 */
export function createWorkContract(
    proposal: Proposal,
    worker: string,
    verifiers: string[],
    maxRetries: number = DEFAULT_MAX_RETRIES
): WorkContract {
    const prefix = getLogPrefix();

    const contractId = `CONTRACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const deadline = new Date(proposal.deadline);
    const now = new Date();
    const executionTimeoutMs = deadline.getTime() - now.getTime();

    const contract: WorkContract = {
        contract_id: contractId,
        proposal_id: proposal.id,

        // Locked parameters
        scope: proposal.objective,
        budget: proposal.budget,
        deadline: deadline,
        max_retries: maxRetries,

        // Assigned agents
        worker: worker,
        verifiers: verifiers,

        // Initial state
        status: 'assigned',

        // Monitoring
        initial_grace_ms: DEFAULT_INITIAL_GRACE_MS,
        heartbeat_timeout_ms: DEFAULT_HEARTBEAT_TIMEOUT_MS,
        execution_timeout_ms: executionTimeoutMs,

        // Retry tracking
        retry_count: 0,
        reassigned_from: [],

        // results
        verifier_submissions: []
    };

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} WORK CONTRACT CREATED`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Contract ID: ${contractId}`);
    logger.info(`${prefix} Proposal ID: ${proposal.id}`);
    logger.info(`${prefix} Scope: ${contract.scope}`);
    logger.info(`${prefix} Budget: ${contract.budget} MON (LOCKED)`);
    logger.info(`${prefix} Deadline: ${contract.deadline.toISOString()} (LOCKED)`);
    logger.info(`${prefix} Max retries: ${contract.max_retries} (LOCKED)`);
    logger.info(`${prefix} Worker: ${worker}`);
    logger.info(`${prefix} Verifiers: ${verifiers.join(', ')}`);
    logger.info(`${prefix} Initial grace: ${contract.initial_grace_ms / 1000}s`);
    logger.info(`${prefix} Heartbeat timeout: ${contract.heartbeat_timeout_ms / 1000}s`);
    logger.info(`${prefix} ========================================\n`);

    return contract;
}

/**
 * Start contract execution
 */
export function startExecution(contract: WorkContract): void {
    const prefix = getLogPrefix();

    if (contract.status !== 'assigned') {
        throw new Error(`Cannot start execution: contract status is ${contract.status}`);
    }

    contract.status = 'executing';
    contract.started_at = new Date();
    contract.last_heartbeat = new Date(); // Initial heartbeat

    logger.info(`${prefix} [${contract.contract_id}] Execution started`);
    logger.info(`${prefix} Worker: ${contract.worker}`);
    logger.info(`${prefix} Grace period: ${contract.initial_grace_ms / 1000}s (heartbeat not enforced yet)`);
}

/**
 * Record heartbeat from worker
 */
export function recordHeartbeat(contract: WorkContract, progress?: number): void {
    const prefix = getLogPrefix();

    if (contract.status !== 'executing') {
        logger.warn(`${prefix} [${contract.contract_id}] Heartbeat received but status is ${contract.status}`);
        return;
    }

    contract.last_heartbeat = new Date();

    if (progress !== undefined) {
        contract.progress = progress;
        logger.debug(`${prefix} [${contract.contract_id}] Heartbeat: ${progress}% complete`);
    } else {
        logger.debug(`${prefix} [${contract.contract_id}] Heartbeat received`);
    }
}

/**
 * Check if grace period has elapsed
 */
export function isGracePeriodElapsed(contract: WorkContract): boolean {
    if (!contract.started_at) return false;

    const elapsed = Date.now() - contract.started_at.getTime();
    return elapsed > contract.initial_grace_ms;
}

/**
 * Check if heartbeat is stale
 */
export function isHeartbeatStale(contract: WorkContract): boolean {
    if (!contract.last_heartbeat) return true;

    const elapsed = Date.now() - contract.last_heartbeat.getTime();
    return elapsed > contract.heartbeat_timeout_ms;
}

/**
 * Distinguish between STALL and CRASH
 */
export function detectFailureType(contract: WorkContract): FailureType {
    if (!contract.last_heartbeat) {
        return 'CRASH'; // Never sent heartbeat
    }

    const timeSinceStart = Date.now() - (contract.started_at?.getTime() || 0);
    const timeSinceHeartbeat = Date.now() - contract.last_heartbeat.getTime();

    // If worker sent at least one heartbeat but then stopped
    if (timeSinceStart > contract.initial_grace_ms && timeSinceHeartbeat > contract.heartbeat_timeout_ms) {
        return 'STALL'; // Was working, then stalled
    }

    return 'CRASH'; // Crashed before grace period ended
}

/**
 * Submit work result
 */
export function submitWork(contract: WorkContract, result: string): void {
    const prefix = getLogPrefix();

    if (contract.status !== 'executing') {
        throw new Error(`Cannot submit work: contract status is ${contract.status}`);
    }

    contract.status = 'verifying';
    contract.work_result = result;

    logger.info(`${prefix} [${contract.contract_id}] Work submitted by ${contract.worker}`);
    logger.info(`${prefix} Status: executing → verifying`);
}

/**
 * Complete verification
 */
export function completeVerification(contract: WorkContract, passed: boolean): void {
    const prefix = getLogPrefix();

    if (contract.status !== 'verifying') {
        throw new Error(`Cannot complete verification: contract status is ${contract.status}`);
    }

    contract.verification_result = passed;

    if (passed) {
        contract.status = 'completed';
        contract.completed_at = new Date();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} CONTRACT COMPLETED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Contract ID: ${contract.contract_id}`);
        logger.info(`${prefix} Worker: ${contract.worker}`);
        logger.info(`${prefix} Verification: PASSED`);
        logger.info(`${prefix} Payment: ${contract.budget} MON → ${contract.worker}`);
        logger.info(`${prefix} ========================================\n`);
    } else {
        // Verification failed - treat as worker failure
        logger.warn(`${prefix} [${contract.contract_id}] Verification FAILED`);
        recordFailure(contract, 'VERIFICATION_FAILED', 'Work did not pass verification');
    }
}

/**
 * Record failure and check if retry is possible
 */
export function recordFailure(
    contract: WorkContract,
    failureType: FailureType,
    reason: string
): void {
    const prefix = getLogPrefix();

    logger.warn(`${prefix} ========================================`);
    logger.warn(`${prefix} WORKER FAILURE`);
    logger.warn(`${prefix} ========================================`);
    logger.warn(`${prefix} Contract ID: ${contract.contract_id}`);
    logger.warn(`${prefix} Worker: ${contract.worker}`);
    logger.warn(`${prefix} Failure type: ${failureType}`);
    logger.warn(`${prefix} Reason: ${reason}`);
    logger.warn(`${prefix} Retry count: ${contract.retry_count}/${contract.max_retries}`);
    logger.warn(`${prefix} ========================================\n`);

    // Record failed worker
    contract.reassigned_from.push({
        worker: contract.worker,
        failure_type: failureType,
        timestamp: new Date(),
        reason: reason
    });

    contract.retry_count++;
}

/**
 * Check if retry is allowed
 */
export function canRetry(contract: WorkContract): boolean {
    return contract.retry_count < contract.max_retries;
}

/**
 * Reassign to new worker
 */
export function reassignWorker(contract: WorkContract, newWorker: string): void {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} REASSIGNING WORK`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Contract ID: ${contract.contract_id}`);
    logger.info(`${prefix} From: ${contract.worker}`);
    logger.info(`${prefix} To: ${newWorker}`);
    logger.info(`${prefix} Retry: ${contract.retry_count}/${contract.max_retries}`);
    logger.info(`${prefix} ========================================\n`);

    contract.worker = newWorker;
    contract.status = 'assigned';
    contract.started_at = undefined;
    contract.last_heartbeat = undefined;
    contract.progress = undefined;
}

/**
 * Mark contract as permanently failed
 */
export function markFailed(contract: WorkContract, reason: string): void {
    const prefix = getLogPrefix();

    contract.status = 'failed';
    contract.failure_reason = reason;
    contract.completed_at = new Date();

    logger.error(`${prefix} ========================================`);
    logger.error(`${prefix} CONTRACT FAILED`);
    logger.error(`${prefix} ========================================`);
    logger.error(`${prefix} Contract ID: ${contract.contract_id}`);
    logger.error(`${prefix} Reason: ${reason}`);
    logger.error(`${prefix} Retries exhausted: ${contract.retry_count}/${contract.max_retries}`);
    logger.error(`${prefix} Failed workers: ${contract.reassigned_from.map(r => r.worker).join(', ')}`);
    logger.error(`${prefix} ========================================\n`);
}

/**
 * Mark contract as timed out
 */
export function markTimeout(contract: WorkContract): void {
    const prefix = getLogPrefix();

    contract.status = 'timeout';
    contract.failure_type = 'TIMEOUT';
    contract.failure_reason = 'Deadline exceeded';
    contract.completed_at = new Date();

    logger.error(`${prefix} ========================================`);
    logger.error(`${prefix} CONTRACT TIMEOUT`);
    logger.error(`${prefix} ========================================`);
    logger.error(`${prefix} Contract ID: ${contract.contract_id}`);
    logger.error(`${prefix} Deadline: ${contract.deadline.toISOString()}`);
    logger.error(`${prefix} Worker: ${contract.worker}`);
    logger.error(`${prefix} ========================================\n`);
}


/**
 * Add verifier submission to contract
 */
export function addVerifierSubmission(
    contract: WorkContract,
    verifierId: string,
    verdict: 'PASS' | 'FAIL',
    reason: string
): void {
    const prefix = getLogPrefix();

    if (contract.status !== 'verifying') {
        throw new Error(`Cannot add submission: contract status is ${contract.status}`);
    }

    if (!contract.verifiers.includes(verifierId)) {
        throw new Error(`Verifier ${verifierId} is not assigned to this contract`);
    }

    if (!contract.verifier_submissions) {
        contract.verifier_submissions = [];
    }

    // Check if already submitted
    if (contract.verifier_submissions.some(s => s.verifier_id === verifierId)) {
        throw new Error(`Verifier ${verifierId} has already submitted`);
    }

    contract.verifier_submissions.push({
        verifier_id: verifierId,
        verdict: verdict,
        reason: reason,
        timestamp: new Date()
    });

    logger.info(`${prefix} [${contract.contract_id}] Verifier ${verifierId} voted ${verdict}`);
}

/**
 * Get contract summary
 */
export function getContractSummary(contract: WorkContract): string {
    const status = contract.status.toUpperCase();
    const retries = contract.retry_count > 0 ? ` (${contract.retry_count} retries)` : '';
    return `${contract.contract_id}: ${status}${retries}`;
}
