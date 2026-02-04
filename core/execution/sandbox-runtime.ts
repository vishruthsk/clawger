/**
 * Sandbox Runtime
 * Enforcement of resource limits and execution boundaries
 */

import { ExecutionPayload } from './execution-payload';
import { ResultEnvelope, validateResultEnvelope } from './result-envelope';
import { ClawgerMode } from '../../config/demo-config';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type ViolationType =
    | 'TIMEOUT'
    | 'CPU_LIMIT_EXCEEDED'
    | 'MEMORY_LIMIT_EXCEEDED'
    | 'OUTPUT_TOO_LARGE'
    | 'MALFORMED_RESULT'
    | 'NETWORK_VIOLATION'
    | 'FILESYSTEM_VIOLATION';

export interface RuntimeViolation {
    violation_type: ViolationType;
    worker_id: string;
    payload_id: string;
    reason: string;
    timestamp: Date;
}

/**
 * Sandbox Runtime Enforcer
 */
export class SandboxRuntime {
    private mode: ClawgerMode;
    private violations: RuntimeViolation[] = [];

    constructor(mode: ClawgerMode) {
        this.mode = mode;
    }

    /**
     * Monitor execution and enforce limits
     */
    async monitorExecution(
        workerId: string,
        payload: ExecutionPayload,
        executionFn: () => Promise<ResultEnvelope>
    ): Promise<ResultEnvelope> {
        const prefix = getLogPrefix();
        const startTime = Date.now();

        logger.info(`${prefix} [SANDBOX] Starting monitored execution for ${workerId}`);
        logger.info(`${prefix} [SANDBOX] Limits: ${payload.max_runtime_seconds}s runtime, ${payload.max_cpu_seconds}s CPU, ${payload.max_memory_mb}MB memory\n`);

        // Set up timeout
        const timeoutPromise = new Promise<ResultEnvelope>((_, reject) => {
            setTimeout(() => {
                reject(new Error('TIMEOUT'));
            }, payload.max_runtime_seconds * 1000);
        });

        try {
            // Race between execution and timeout
            const result = await Promise.race([
                executionFn(),
                timeoutPromise
            ]);

            const elapsed = (Date.now() - startTime) / 1000;
            logger.info(`${prefix} [SANDBOX] Execution completed in ${elapsed.toFixed(2)}s\n`);

            // Validate result
            this.validateResult(result, payload);

            return result;

        } catch (error) {
            const elapsed = (Date.now() - startTime) / 1000;

            if ((error as Error).message === 'TIMEOUT') {
                logger.error(`${prefix} [SANDBOX] ❌ TIMEOUT after ${elapsed.toFixed(2)}s\n`);
                this.recordViolation('TIMEOUT', workerId, payload.payload_id, `Exceeded ${payload.max_runtime_seconds}s limit`);
                this.enforceViolation('TIMEOUT', workerId);
            }

            throw error;
        }
    }

    /**
     * Validate result against payload limits
     */
    private validateResult(result: ResultEnvelope, payload: ExecutionPayload): void {
        const prefix = getLogPrefix();

        try {
            validateResultEnvelope(result, payload);
        } catch (error) {
            logger.error(`${prefix} [SANDBOX] ❌ Result validation failed: ${(error as Error).message}\n`);
            this.recordViolation('MALFORMED_RESULT', result.worker_id, payload.payload_id, (error as Error).message);
            this.enforceViolation('MALFORMED_RESULT', result.worker_id);
            throw error;
        }
    }

    /**
     * Record violation
     */
    private recordViolation(
        violationType: ViolationType,
        workerId: string,
        payloadId: string,
        reason: string
    ): void {
        const violation: RuntimeViolation = {
            violation_type: violationType,
            worker_id: workerId,
            payload_id: payloadId,
            reason: reason,
            timestamp: new Date()
        };

        this.violations.push(violation);
    }

    /**
     * Enforce violation penalty
     */
    private enforceViolation(violationType: ViolationType, workerId: string): void {
        const prefix = getLogPrefix();

        if (this.mode === 'LOCAL') {
            logger.warn(`${prefix} [ENFORCEMENT] LOCAL MODE: Kill process + quarantine`);
            logger.warn(`${prefix}   Worker: ${workerId}`);
            logger.warn(`${prefix}   Violation: ${violationType}`);
            logger.warn(`${prefix}   Action: Process killed, quarantined for 1 hour\n`);

            // In real implementation:
            // - processEnforcer.killProcess(workerId)
            // - processEnforcer.quarantine(workerId, 60 * 60 * 1000)

        } else {
            logger.warn(`${prefix} [ENFORCEMENT] PUBLIC MODE: Slash bond`);
            logger.warn(`${prefix}   Worker: ${workerId}`);
            logger.warn(`${prefix}   Violation: ${violationType}`);
            logger.warn(`${prefix}   Action: Bond slashed 50%, reputation decreased\n`);

            // In real implementation:
            // - bondManager.slash(workerId, 0.5)
            // - reputationManager.decrease(workerId, 20)
        }
    }

    /**
     * Check if network access is allowed
     */
    checkNetworkAccess(payload: ExecutionPayload): void {
        if (!payload.network_allowed) {
            const prefix = getLogPrefix();
            logger.error(`${prefix} [SANDBOX] ❌ Network access denied (not allowed in payload)\n`);
            throw new Error('NETWORK_VIOLATION');
        }
    }

    /**
     * Check if filesystem write is allowed
     */
    checkFilesystemWrite(payload: ExecutionPayload): void {
        if (!payload.filesystem_write) {
            const prefix = getLogPrefix();
            logger.error(`${prefix} [SANDBOX] ❌ Filesystem write denied (not allowed in payload)\n`);
            throw new Error('FILESYSTEM_VIOLATION');
        }
    }

    /**
     * Get violation statistics
     */
    getViolationStats(): {
        total: number;
        by_type: Record<ViolationType, number>;
        by_worker: Record<string, number>;
    } {
        const by_type: Record<string, number> = {};
        const by_worker: Record<string, number> = {};

        for (const violation of this.violations) {
            by_type[violation.violation_type] = (by_type[violation.violation_type] || 0) + 1;
            by_worker[violation.worker_id] = (by_worker[violation.worker_id] || 0) + 1;
        }

        return {
            total: this.violations.length,
            by_type: by_type as Record<ViolationType, number>,
            by_worker
        };
    }

    /**
     * Get all violations
     */
    getViolations(): RuntimeViolation[] {
        return [...this.violations];
    }
}
