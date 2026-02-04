/**
 * Metrics Engine
 * Deterministic, append-only execution metrics tracking
 */

import { FailureType, ContractStatus } from '../execution/work-contract';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface ContractMetrics {
    created: number;
    completed: number;
    failed: number;
    timeout: number;
    active: number;
}

export interface FailureMetrics {
    stall: number;
    crash: number;
    verification: number;
    timeout: number;
}

export interface RetryMetrics {
    used: number;
    exhausted: number;
}

export interface WorkerMetrics {
    tasks_assigned: number;
    tasks_completed: number;
    tasks_failed: number;
    stalls: number;
    crashes: number;
    success_rate: number;
}

export interface VerifierMetrics {
    verifications_performed: number;
    verifications_passed: number;
    verifications_failed: number;
    pass_rate: number;
}

export interface MetricsSnapshot {
    timestamp: Date;
    contracts: ContractMetrics;
    failures: FailureMetrics;
    retries: RetryMetrics;
    worker_count: number;
    verifier_count: number;
}

export class MetricsEngine {
    // Contract lifecycle counters
    private contracts: ContractMetrics = {
        created: 0,
        completed: 0,
        failed: 0,
        timeout: 0,
        active: 0
    };

    // Failure analysis counters
    private failures: FailureMetrics = {
        stall: 0,
        crash: 0,
        verification: 0,
        timeout: 0
    };

    // Retry tracking counters
    private retries: RetryMetrics = {
        used: 0,
        exhausted: 0
    };

    // Worker reliability tracking
    private workerMetrics: Map<string, WorkerMetrics> = new Map();

    // Verifier reliability tracking
    private verifierMetrics: Map<string, VerifierMetrics> = new Map();

    /**
     * Increment a counter (append-only)
     */
    private incrementCounter(category: 'contracts' | 'failures' | 'retries', key: string): void {
        (this[category] as any)[key]++;
    }

    /**
     * Decrement active contracts (special case)
     */
    private decrementActive(): void {
        if (this.contracts.active > 0) {
            this.contracts.active--;
        }
    }

    /**
     * Record contract creation
     */
    recordContractCreated(): void {
        this.incrementCounter('contracts', 'created');
        this.incrementCounter('contracts', 'active');
    }

    /**
     * Record contract completion
     */
    recordContractCompleted(): void {
        this.incrementCounter('contracts', 'completed');
        this.decrementActive();
    }

    /**
     * Record contract failure
     */
    recordContractFailed(): void {
        this.incrementCounter('contracts', 'failed');
        this.decrementActive();
    }

    /**
     * Record contract timeout
     */
    recordContractTimeout(): void {
        this.incrementCounter('contracts', 'timeout');
        this.incrementCounter('failures', 'timeout');
        this.decrementActive();
    }

    /**
     * Record failure by type
     */
    recordFailure(failureType: FailureType): void {
        switch (failureType) {
            case 'STALL':
                this.incrementCounter('failures', 'stall');
                break;
            case 'CRASH':
                this.incrementCounter('failures', 'crash');
                break;
            case 'VERIFICATION_FAILED':
                this.incrementCounter('failures', 'verification');
                break;
            case 'TIMEOUT':
                this.incrementCounter('failures', 'timeout');
                break;
        }
    }

    /**
     * Record retry used
     */
    recordRetryUsed(): void {
        this.incrementCounter('retries', 'used');
    }

    /**
     * Record retry exhausted
     */
    recordRetryExhausted(): void {
        this.incrementCounter('retries', 'exhausted');
    }

    /**
     * Initialize worker metrics
     */
    private initializeWorker(worker: string): void {
        if (!this.workerMetrics.has(worker)) {
            this.workerMetrics.set(worker, {
                tasks_assigned: 0,
                tasks_completed: 0,
                tasks_failed: 0,
                stalls: 0,
                crashes: 0,
                success_rate: 0
            });
        }
    }

    /**
     * Record worker assignment
     */
    recordWorkerAssigned(worker: string): void {
        this.initializeWorker(worker);
        const metrics = this.workerMetrics.get(worker)!;
        metrics.tasks_assigned++;
    }

    /**
     * Record worker success
     */
    recordWorkerSuccess(worker: string): void {
        this.initializeWorker(worker);
        const metrics = this.workerMetrics.get(worker)!;
        metrics.tasks_completed++;
        metrics.success_rate = metrics.tasks_completed / metrics.tasks_assigned;
    }

    /**
     * Record worker failure
     */
    recordWorkerFailure(worker: string, failureType: FailureType): void {
        this.initializeWorker(worker);
        const metrics = this.workerMetrics.get(worker)!;
        metrics.tasks_failed++;

        if (failureType === 'STALL') {
            metrics.stalls++;
        } else if (failureType === 'CRASH') {
            metrics.crashes++;
        }

        metrics.success_rate = metrics.tasks_completed / metrics.tasks_assigned;
    }

    /**
     * Initialize verifier metrics
     */
    private initializeVerifier(verifier: string): void {
        if (!this.verifierMetrics.has(verifier)) {
            this.verifierMetrics.set(verifier, {
                verifications_performed: 0,
                verifications_passed: 0,
                verifications_failed: 0,
                pass_rate: 0
            });
        }
    }

    /**
     * Record verification
     */
    recordVerification(verifier: string, passed: boolean): void {
        this.initializeVerifier(verifier);
        const metrics = this.verifierMetrics.get(verifier)!;
        metrics.verifications_performed++;

        if (passed) {
            metrics.verifications_passed++;
        } else {
            metrics.verifications_failed++;
        }

        metrics.pass_rate = metrics.verifications_passed / metrics.verifications_performed;
    }

    /**
     * Get snapshot of all metrics
     */
    getSnapshot(): MetricsSnapshot {
        return {
            timestamp: new Date(),
            contracts: { ...this.contracts },
            failures: { ...this.failures },
            retries: { ...this.retries },
            worker_count: this.workerMetrics.size,
            verifier_count: this.verifierMetrics.size
        };
    }

    /**
     * Get worker metrics
     */
    getWorkerMetrics(worker: string): WorkerMetrics | null {
        return this.workerMetrics.get(worker) || null;
    }

    /**
     * Get all worker metrics
     */
    getAllWorkerMetrics(): Map<string, WorkerMetrics> {
        return new Map(this.workerMetrics);
    }

    /**
     * Get verifier metrics
     */
    getVerifierMetrics(verifier: string): VerifierMetrics | null {
        return this.verifierMetrics.get(verifier) || null;
    }

    /**
     * Get all verifier metrics
     */
    getAllVerifierMetrics(): Map<string, VerifierMetrics> {
        return new Map(this.verifierMetrics);
    }

    /**
     * Get contract metrics
     */
    getContractMetrics(): ContractMetrics {
        return { ...this.contracts };
    }

    /**
     * Get failure metrics
     */
    getFailureMetrics(): FailureMetrics {
        return { ...this.failures };
    }

    /**
     * Get retry metrics
     */
    getRetryMetrics(): RetryMetrics {
        return { ...this.retries };
    }

    /**
     * Print metrics summary
     */
    printSummary(): void {
        const prefix = getLogPrefix();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} METRICS SUMMARY`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} `);
        logger.info(`${prefix} Contracts:`);
        logger.info(`${prefix}   Created: ${this.contracts.created}`);
        logger.info(`${prefix}   Completed: ${this.contracts.completed}`);
        logger.info(`${prefix}   Failed: ${this.contracts.failed}`);
        logger.info(`${prefix}   Timeout: ${this.contracts.timeout}`);
        logger.info(`${prefix}   Active: ${this.contracts.active}`);
        logger.info(`${prefix} `);
        logger.info(`${prefix} Failures:`);
        logger.info(`${prefix}   Stall: ${this.failures.stall}`);
        logger.info(`${prefix}   Crash: ${this.failures.crash}`);
        logger.info(`${prefix}   Verification: ${this.failures.verification}`);
        logger.info(`${prefix}   Timeout: ${this.failures.timeout}`);
        logger.info(`${prefix} `);
        logger.info(`${prefix} Retries:`);
        logger.info(`${prefix}   Used: ${this.retries.used}`);
        logger.info(`${prefix}   Exhausted: ${this.retries.exhausted}`);
        logger.info(`${prefix} `);
        logger.info(`${prefix} Workers: ${this.workerMetrics.size}`);
        logger.info(`${prefix} Verifiers: ${this.verifierMetrics.size}`);
        logger.info(`${prefix} ========================================`);
    }
}
