/**
 * Result Envelope
 * Structured output from workers with proof of work
 */

import { ExecutionPayload } from './execution-payload';
import { getLogPrefix } from '../../config/demo-config';
import * as crypto from 'crypto';

const logger = console;

export type ResultStatus = 'SUCCESS' | 'ERROR';

export interface ResultEnvelope {
    // Identity
    result_id: string;
    payload_id: string;
    worker_id: string;

    // Result
    status: ResultStatus;
    output: any;                      // Structured JSON
    error_message?: string;

    // Proof of work
    proof_of_work: string;            // Deterministic hash

    // Logs (capped)
    logs: string[];                   // Max 100 lines

    // Metrics
    runtime_seconds: number;
    cpu_seconds: number;
    memory_used_mb: number;
    output_size_kb: number;

    // Timestamp
    completed_at: Date;
}

/**
 * Compute proof of work hash
 */
export function computeProofOfWork(payloadId: string, output: any): string {
    const data = payloadId + JSON.stringify(output);
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create result envelope
 */
export function createResultEnvelope(
    payloadId: string,
    workerId: string,
    status: ResultStatus,
    output: any,
    logs: string[],
    metrics: {
        runtime_seconds: number;
        cpu_seconds: number;
        memory_used_mb: number;
    },
    errorMessage?: string
): ResultEnvelope {
    const prefix = getLogPrefix();

    // Cap logs
    const cappedLogs = logs.slice(0, 100);

    // Compute output size
    const outputStr = JSON.stringify(output);
    const outputSizeKb = Buffer.byteLength(outputStr, 'utf8') / 1024;

    // Compute proof of work
    const proofOfWork = computeProofOfWork(payloadId, output);

    const result: ResultEnvelope = {
        result_id: `RESULT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        payload_id: payloadId,
        worker_id: workerId,
        status: status,
        output: output,
        error_message: errorMessage,
        proof_of_work: proofOfWork,
        logs: cappedLogs,
        runtime_seconds: metrics.runtime_seconds,
        cpu_seconds: metrics.cpu_seconds,
        memory_used_mb: metrics.memory_used_mb,
        output_size_kb: outputSizeKb,
        completed_at: new Date()
    };

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} RESULT ENVELOPE CREATED`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Result ID: ${result.result_id}`);
    logger.info(`${prefix} Worker: ${result.worker_id}`);
    logger.info(`${prefix} Status: ${result.status}`);
    logger.info(`${prefix} Runtime: ${result.runtime_seconds}s`);
    logger.info(`${prefix} CPU: ${result.cpu_seconds}s`);
    logger.info(`${prefix} Memory: ${result.memory_used_mb}MB`);
    logger.info(`${prefix} Output Size: ${result.output_size_kb.toFixed(2)}KB`);
    logger.info(`${prefix} Logs: ${result.logs.length} lines`);
    logger.info(`${prefix} ========================================\n`);

    return result;
}

/**
 * Validate result envelope against payload
 */
export function validateResultEnvelope(
    result: ResultEnvelope,
    payload: ExecutionPayload
): void {
    const prefix = getLogPrefix();
    const errors: string[] = [];

    // Check status
    if (!['SUCCESS', 'ERROR'].includes(result.status)) {
        errors.push(`Invalid status: ${result.status}`);
    }

    // Check output is JSON serializable
    try {
        JSON.stringify(result.output);
    } catch (error) {
        errors.push('Output must be JSON serializable');
    }

    // Check runtime limits
    if (result.runtime_seconds > payload.max_runtime_seconds) {
        errors.push(`Runtime exceeded: ${result.runtime_seconds}s > ${payload.max_runtime_seconds}s`);
    }

    if (result.cpu_seconds > payload.max_cpu_seconds) {
        errors.push(`CPU limit exceeded: ${result.cpu_seconds}s > ${payload.max_cpu_seconds}s`);
    }

    if (result.memory_used_mb > payload.max_memory_mb) {
        errors.push(`Memory limit exceeded: ${result.memory_used_mb}MB > ${payload.max_memory_mb}MB`);
    }

    if (result.output_size_kb > payload.max_output_size_kb) {
        errors.push(`Output too large: ${result.output_size_kb}KB > ${payload.max_output_size_kb}KB`);
    }

    // Check logs
    if (result.logs.length > 100) {
        errors.push(`Too many log lines: ${result.logs.length} > 100`);
    }

    for (const log of result.logs) {
        if (log.length > 1024) {
            errors.push(`Log line too long: ${log.length} > 1024`);
            break;
        }
    }

    // Check proof of work
    const expectedHash = computeProofOfWork(result.payload_id, result.output);
    if (result.proof_of_work !== expectedHash) {
        errors.push('Invalid proof of work');
    }

    if (errors.length > 0) {
        logger.error(`${prefix} [VALIDATION] ❌ Result validation failed:`);
        for (const error of errors) {
            logger.error(`${prefix}   - ${error}`);
        }
        throw new Error(`Result validation failed: ${errors.join(', ')}`);
    }

    logger.info(`${prefix} [VALIDATION] ✅ Result envelope validated: ${result.result_id}`);
}

/**
 * Verify proof of work
 */
export function verifyProofOfWork(result: ResultEnvelope): boolean {
    const expected = computeProofOfWork(result.payload_id, result.output);
    return result.proof_of_work === expected;
}
