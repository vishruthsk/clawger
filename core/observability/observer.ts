/**
 * Observer
 * Read-only interface for system visibility (no control surface)
 */

import { WorkContract, ContractStatus } from '../execution/work-contract';
import { MetricsEngine, WorkerMetrics, VerifierMetrics } from './metrics-engine';
import { DecisionTraceLog, DecisionTrace } from './decision-trace';
import { HealthMonitor, HealthStatus } from './health-monitor';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface ActiveContractView {
    contract_id: string;
    worker: string;
    verifiers: string[];
    status: ContractStatus;
    progress?: number;
    time_remaining_ms: number;
    retry_count: number;
}

export interface ObserverView {
    // System status
    safe_mode: boolean;
    safe_mode_reason?: string;
    safe_mode_duration_ms?: number;

    // Active contracts
    active_contracts: ActiveContractView[];

    // Recent decisions (last 10)
    recent_decisions: DecisionTrace[];

    // Metrics snapshot
    metrics: {
        contracts: {
            created: number;
            completed: number;
            failed: number;
            timeout: number;
            active: number;
        };
        failures: {
            stall: number;
            crash: number;
            verification: number;
            timeout: number;
        };
        retries: {
            used: number;
            exhausted: number;
        };
    };

    // Health status
    health: {
        healthy: boolean;
        reason?: string;
        failure_rate: number;
        stall_rate: number;
        retry_exhaustion_rate: number;
        timeout_rate: number;
    };
}

export class Observer {
    private contracts: Map<string, WorkContract>;
    private metricsEngine: MetricsEngine;
    private decisionTrace: DecisionTraceLog;
    private healthMonitor: HealthMonitor;

    constructor(
        contracts: Map<string, WorkContract>,
        metricsEngine: MetricsEngine,
        decisionTrace: DecisionTraceLog,
        healthMonitor: HealthMonitor
    ) {
        this.contracts = contracts;
        this.metricsEngine = metricsEngine;
        this.decisionTrace = decisionTrace;
        this.healthMonitor = healthMonitor;
    }

    /**
     * Get current system view (read-only)
     */
    getView(): ObserverView {
        const health = this.healthMonitor.getHealthStatus();
        const contractMetrics = this.metricsEngine.getContractMetrics();
        const failureMetrics = this.metricsEngine.getFailureMetrics();
        const retryMetrics = this.metricsEngine.getRetryMetrics();

        return {
            safe_mode: this.healthMonitor.isSafeMode(),
            safe_mode_reason: this.healthMonitor.getSafeModeReason(),
            safe_mode_duration_ms: this.healthMonitor.getSafeModeDuration(),

            active_contracts: this.getActiveContracts(),
            recent_decisions: this.decisionTrace.getRecentTraces(10),

            metrics: {
                contracts: contractMetrics,
                failures: failureMetrics,
                retries: retryMetrics
            },

            health: {
                healthy: health.healthy,
                reason: health.reason,
                failure_rate: health.metrics.failure_rate,
                stall_rate: health.metrics.stall_rate,
                retry_exhaustion_rate: health.metrics.retry_exhaustion_rate,
                timeout_rate: health.metrics.timeout_rate
            }
        };
    }

    /**
     * Get active contracts
     */
    private getActiveContracts(): ActiveContractView[] {
        const activeStatuses: ContractStatus[] = ['assigned', 'executing', 'verifying'];
        const now = Date.now();

        return Array.from(this.contracts.values())
            .filter(c => activeStatuses.includes(c.status))
            .map(c => ({
                contract_id: c.contract_id,
                worker: c.worker,
                verifiers: c.verifiers,
                status: c.status,
                progress: c.progress,
                time_remaining_ms: c.deadline.getTime() - now,
                retry_count: c.retry_count
            }));
    }

    /**
     * Get contract details (read-only)
     */
    getContract(contractId: string): WorkContract | null {
        return this.contracts.get(contractId) || null;
    }

    /**
     * Get worker stats (read-only)
     */
    getWorkerStats(worker: string): WorkerMetrics | null {
        return this.metricsEngine.getWorkerMetrics(worker);
    }

    /**
     * Get verifier stats (read-only)
     */
    getVerifierStats(verifier: string): VerifierMetrics | null {
        return this.metricsEngine.getVerifierMetrics(verifier);
    }

    /**
     * Get decision history (read-only)
     */
    getDecisionHistory(limit: number = 10): DecisionTrace[] {
        return this.decisionTrace.getRecentTraces(limit);
    }

    /**
     * Get contract decision history (read-only)
     */
    getContractHistory(contractId: string): DecisionTrace[] {
        return this.decisionTrace.getContractTraces(contractId);
    }

    /**
     * Get health status (read-only)
     */
    getHealthStatus(): HealthStatus {
        return this.healthMonitor.getHealthStatus();
    }

    /**
     * Is system in SAFE MODE? (read-only)
     */
    isSafeMode(): boolean {
        return this.healthMonitor.isSafeMode();
    }

    /**
     * Print system overview
     */
    printOverview(): void {
        const prefix = getLogPrefix();
        const view = this.getView();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} SYSTEM OVERVIEW`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} `);

        // System status
        logger.info(`${prefix} System Status:`);
        if (view.safe_mode) {
            logger.error(`${prefix}   ⚠️  SAFE MODE ACTIVE`);
            logger.error(`${prefix}   Reason: ${view.safe_mode_reason}`);
            logger.error(`${prefix}   Duration: ${(view.safe_mode_duration_ms! / 1000).toFixed(1)}s`);
        } else {
            logger.info(`${prefix}   ✅ Normal operation`);
        }
        logger.info(`${prefix} `);

        // Active contracts
        logger.info(`${prefix} Active Contracts: ${view.active_contracts.length}`);
        if (view.active_contracts.length > 0) {
            view.active_contracts.forEach(c => {
                const timeRemaining = (c.time_remaining_ms / 1000 / 60).toFixed(1);
                logger.info(`${prefix}   - ${c.contract_id}`);
                logger.info(`${prefix}     Worker: ${c.worker}`);
                logger.info(`${prefix}     Status: ${c.status}`);
                if (c.progress !== undefined) {
                    logger.info(`${prefix}     Progress: ${c.progress}%`);
                }
                logger.info(`${prefix}     Time remaining: ${timeRemaining}min`);
            });
        }
        logger.info(`${prefix} `);

        // Metrics
        logger.info(`${prefix} Metrics:`);
        logger.info(`${prefix}   Contracts: ${view.metrics.contracts.created} created, ${view.metrics.contracts.completed} completed, ${view.metrics.contracts.failed} failed`);
        logger.info(`${prefix}   Failures: ${view.metrics.failures.stall} stall, ${view.metrics.failures.crash} crash, ${view.metrics.failures.timeout} timeout`);
        logger.info(`${prefix}   Retries: ${view.metrics.retries.used} used, ${view.metrics.retries.exhausted} exhausted`);
        logger.info(`${prefix} `);

        // Health
        logger.info(`${prefix} Health:`);
        logger.info(`${prefix}   Status: ${view.health.healthy ? '✅ Healthy' : '⚠️  Degraded'}`);
        if (!view.health.healthy) {
            logger.info(`${prefix}   Reason: ${view.health.reason}`);
        }
        logger.info(`${prefix}   Failure rate: ${(view.health.failure_rate * 100).toFixed(1)}%`);
        logger.info(`${prefix}   Stall rate: ${(view.health.stall_rate * 100).toFixed(1)}%`);
        logger.info(`${prefix}   Timeout rate: ${(view.health.timeout_rate * 100).toFixed(1)}%`);
        logger.info(`${prefix} `);

        logger.info(`${prefix} ========================================`);
    }

    /**
     * Print recent activity
     */
    printRecentActivity(limit: number = 5): void {
        const prefix = getLogPrefix();
        const traces = this.decisionTrace.getRecentTraces(limit);

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} RECENT ACTIVITY (last ${limit})`);
        logger.info(`${prefix} ========================================`);

        if (traces.length === 0) {
            logger.info(`${prefix} No activity yet`);
        } else {
            traces.forEach(trace => {
                const time = trace.timestamp.toISOString().substr(11, 8); // HH:MM:SS
                logger.info(`${prefix} [${time}] ${trace.decision_type}`);
                logger.info(`${prefix}   ${trace.reason}`);
            });
        }

        logger.info(`${prefix} ========================================`);
    }
}
