/**
 * Execution Payload
 * Immutable task input given to workers with resource limits
 */

import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface ExecutionPayload {
    // Identity
    payload_id: string;
    contract_id: string;

    // Task definition (IMMUTABLE)
    scope: string;                    // Locked objective
    expected_output_format: string;   // JSON schema or description

    // Resource limits (IMMUTABLE)
    max_runtime_seconds: number;      // Hard deadline (wall clock)
    max_cpu_seconds: number;          // CPU time limit
    max_memory_mb: number;            // Memory limit
    max_output_size_kb: number;       // Output size limit

    // Permissions
    network_allowed: boolean;         // Default: false
    filesystem_write: boolean;        // Default: false

    // Metadata
    created_at: Date;
    deadline: Date;
}

export interface SandboxLimits {
    max_cpu_seconds: number;
    max_memory_mb: number;
    max_output_size_kb: number;
    max_runtime_seconds: number;
    max_log_lines: number;
    max_log_line_length: number;
}

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
    max_cpu_seconds: 60,
    max_memory_mb: 512,
    max_output_size_kb: 100,
    max_runtime_seconds: 300,
    max_log_lines: 100,
    max_log_line_length: 1024
};

/**
 * Create execution payload
 */
export function createExecutionPayload(
    contractId: string,
    scope: string,
    expectedOutputFormat: string,
    limits?: Partial<SandboxLimits>,
    permissions?: { network_allowed?: boolean; filesystem_write?: boolean }
): ExecutionPayload {
    const prefix = getLogPrefix();

    const finalLimits = {
        ...DEFAULT_SANDBOX_LIMITS,
        ...limits
    };

    const payload: ExecutionPayload = {
        payload_id: `PAYLOAD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        contract_id: contractId,
        scope: scope,
        expected_output_format: expectedOutputFormat,
        max_runtime_seconds: finalLimits.max_runtime_seconds,
        max_cpu_seconds: finalLimits.max_cpu_seconds,
        max_memory_mb: finalLimits.max_memory_mb,
        max_output_size_kb: finalLimits.max_output_size_kb,
        network_allowed: permissions?.network_allowed || false,
        filesystem_write: permissions?.filesystem_write || false,
        created_at: new Date(),
        deadline: new Date(Date.now() + finalLimits.max_runtime_seconds * 1000)
    };

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} EXECUTION PAYLOAD CREATED`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Payload ID: ${payload.payload_id}`);
    logger.info(`${prefix} Contract ID: ${payload.contract_id}`);
    logger.info(`${prefix} Scope: ${payload.scope}`);
    logger.info(`${prefix} Max Runtime: ${payload.max_runtime_seconds}s`);
    logger.info(`${prefix} Max CPU: ${payload.max_cpu_seconds}s`);
    logger.info(`${prefix} Max Memory: ${payload.max_memory_mb}MB`);
    logger.info(`${prefix} Max Output: ${payload.max_output_size_kb}KB`);
    logger.info(`${prefix} Network: ${payload.network_allowed ? 'ALLOWED' : 'BLOCKED'}`);
    logger.info(`${prefix} Filesystem Write: ${payload.filesystem_write ? 'ALLOWED' : 'BLOCKED'}`);
    logger.info(`${prefix} ========================================\n`);

    return payload;
}

/**
 * Validate execution payload
 */
export function validatePayload(payload: ExecutionPayload): void {
    const prefix = getLogPrefix();

    if (!payload.payload_id || !payload.contract_id) {
        throw new Error('Payload must have payload_id and contract_id');
    }

    if (!payload.scope || payload.scope.length === 0) {
        throw new Error('Payload must have non-empty scope');
    }

    if (payload.max_runtime_seconds <= 0) {
        throw new Error('max_runtime_seconds must be positive');
    }

    if (payload.max_cpu_seconds <= 0) {
        throw new Error('max_cpu_seconds must be positive');
    }

    if (payload.max_memory_mb <= 0) {
        throw new Error('max_memory_mb must be positive');
    }

    if (payload.max_output_size_kb <= 0) {
        throw new Error('max_output_size_kb must be positive');
    }

    logger.debug(`${prefix} [PAYLOAD] ✅ Payload validated: ${payload.payload_id}`);
}

/**
 * Check if payload is immutable (for verification)
 */
export function freezePayload(payload: ExecutionPayload): Readonly<ExecutionPayload> {
    return Object.freeze(payload);
}
