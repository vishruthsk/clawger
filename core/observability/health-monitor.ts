/**
 * Health Monitor
 * System health tracking and automatic SAFE MODE on degradation
 */

import { MetricsEngine } from './metrics-engine';
import { DecisionTraceLog } from './decision-trace';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface HealthMetrics {
    failure_rate: number;           // failures / total contracts
    stall_rate: number;             // stalls / total failures
    retry_exhaustion_rate: number;  // exhausted / total retries
    timeout_rate: number;           // timeouts / total contracts
}

export interface HealthStatus {
    healthy: boolean;
    reason?: string;
    metrics: HealthMetrics;
}

// Degradation thresholds
const SAFE_MODE_THRESHOLDS = {
    failure_rate: 0.50,           // 50% of contracts failing
    stall_rate: 0.70,             // 70% of failures are stalls
    retry_exhaustion_rate: 0.60,  // 60% of retries exhausted
    timeout_rate: 0.30            // 30% of contracts timing out
};

// Minimum sample size before enforcing thresholds
const MIN_SAMPLE_SIZE = 5;

export class HealthMonitor {
    private metricsEngine: MetricsEngine;
    private decisionTrace: DecisionTraceLog;

    private safeMode: boolean = false;
    private safeModeReason?: string;
    private safeModeEnteredAt?: Date;

    constructor(metricsEngine: MetricsEngine, decisionTrace: DecisionTraceLog) {
        this.metricsEngine = metricsEngine;
        this.decisionTrace = decisionTrace;
    }

    /**
     * Calculate health metrics
     */
    calculateHealthMetrics(): HealthMetrics {
        const contractMetrics = this.metricsEngine.getContractMetrics();
        const failureMetrics = this.metricsEngine.getFailureMetrics();
        const retryMetrics = this.metricsEngine.getRetryMetrics();

        const totalContracts = contractMetrics.created;
        const totalFailures = failureMetrics.stall + failureMetrics.crash + failureMetrics.verification;
        const totalRetries = retryMetrics.used;

        // Calculate rates (handle division by zero)
        const failureRate = totalContracts > 0
            ? (contractMetrics.failed + contractMetrics.timeout) / totalContracts
            : 0;

        const stallRate = totalFailures > 0
            ? failureMetrics.stall / totalFailures
            : 0;

        const retryExhaustionRate = totalRetries > 0
            ? retryMetrics.exhausted / totalRetries
            : 0;

        const timeoutRate = totalContracts > 0
            ? contractMetrics.timeout / totalContracts
            : 0;

        return {
            failure_rate: failureRate,
            stall_rate: stallRate,
            retry_exhaustion_rate: retryExhaustionRate,
            timeout_rate: timeoutRate
        };
    }

    /**
     * Check system health
     */
    checkHealth(): HealthStatus {
        const metrics = this.calculateHealthMetrics();
        const contractMetrics = this.metricsEngine.getContractMetrics();

        // Don't enforce thresholds until we have enough samples
        if (contractMetrics.created < MIN_SAMPLE_SIZE) {
            return {
                healthy: true,
                metrics: metrics
            };
        }

        // Check each threshold
        if (metrics.failure_rate > SAFE_MODE_THRESHOLDS.failure_rate) {
            return {
                healthy: false,
                reason: `High failure rate: ${(metrics.failure_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.failure_rate * 100).toFixed(0)}%)`,
                metrics: metrics
            };
        }

        if (metrics.stall_rate > SAFE_MODE_THRESHOLDS.stall_rate) {
            return {
                healthy: false,
                reason: `High stall rate: ${(metrics.stall_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.stall_rate * 100).toFixed(0)}%)`,
                metrics: metrics
            };
        }

        if (metrics.retry_exhaustion_rate > SAFE_MODE_THRESHOLDS.retry_exhaustion_rate) {
            return {
                healthy: false,
                reason: `High retry exhaustion: ${(metrics.retry_exhaustion_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.retry_exhaustion_rate * 100).toFixed(0)}%)`,
                metrics: metrics
            };
        }

        if (metrics.timeout_rate > SAFE_MODE_THRESHOLDS.timeout_rate) {
            return {
                healthy: false,
                reason: `High timeout rate: ${(metrics.timeout_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.timeout_rate * 100).toFixed(0)}%)`,
                metrics: metrics
            };
        }

        return {
            healthy: true,
            metrics: metrics
        };
    }

    /**
     * Enter SAFE MODE
     */
    enterSafeMode(reason: string): void {
        if (this.safeMode) {
            return; // Already in safe mode
        }

        const prefix = getLogPrefix();

        this.safeMode = true;
        this.safeModeReason = reason;
        this.safeModeEnteredAt = new Date();

        logger.error(`${prefix} ========================================`);
        logger.error(`${prefix} ⚠️  SAFE MODE ENTERED`);
        logger.error(`${prefix} ========================================`);
        logger.error(`${prefix} Reason: ${reason}`);
        logger.error(`${prefix} Timestamp: ${this.safeModeEnteredAt.toISOString()}`);
        logger.error(`${prefix} `);
        logger.error(`${prefix} Actions:`);
        logger.error(`${prefix}   - Rejecting all new contract proposals`);
        logger.error(`${prefix}   - Continuing to monitor active contracts`);
        logger.error(`${prefix}   - Will exit when health metrics improve`);
        logger.error(`${prefix} ========================================\n`);

        // Log decision
        this.decisionTrace.logDecision(
            'SYSTEM',
            'SAFE_MODE_ENTERED',
            reason,
            {
                health_metrics: this.calculateHealthMetrics(),
                thresholds: SAFE_MODE_THRESHOLDS
            }
        );
    }

    /**
     * Exit SAFE MODE
     */
    exitSafeMode(): void {
        if (!this.safeMode) {
            return; // Not in safe mode
        }

        const prefix = getLogPrefix();
        const duration = Date.now() - this.safeModeEnteredAt!.getTime();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} ✅ SAFE MODE EXITED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Duration: ${(duration / 1000).toFixed(1)}s`);
        logger.info(`${prefix} Reason: Health metrics recovered`);
        logger.info(`${prefix} `);
        logger.info(`${prefix} Resuming normal operations`);
        logger.info(`${prefix} ========================================\n`);

        // Log decision
        this.decisionTrace.logDecision(
            'SYSTEM',
            'SAFE_MODE_EXITED',
            'Health metrics recovered',
            {
                duration_ms: duration,
                health_metrics: this.calculateHealthMetrics()
            }
        );

        this.safeMode = false;
        this.safeModeReason = undefined;
        this.safeModeEnteredAt = undefined;
    }

    /**
     * Check if in SAFE MODE
     */
    isSafeMode(): boolean {
        return this.safeMode;
    }

    /**
     * Get SAFE MODE reason
     */
    getSafeModeReason(): string | undefined {
        return this.safeModeReason;
    }

    /**
     * Get SAFE MODE duration
     */
    getSafeModeDuration(): number | undefined {
        if (!this.safeMode || !this.safeModeEnteredAt) {
            return undefined;
        }

        return Date.now() - this.safeModeEnteredAt.getTime();
    }

    /**
     * Check and update SAFE MODE status
     */
    updateSafeModeStatus(): void {
        const health = this.checkHealth();

        if (!health.healthy && !this.safeMode) {
            // Enter safe mode
            this.enterSafeMode(health.reason!);
        } else if (health.healthy && this.safeMode) {
            // Exit safe mode
            this.exitSafeMode();
        }
    }

    /**
     * Get health status
     */
    getHealthStatus(): HealthStatus {
        return this.checkHealth();
    }

    /**
     * Print health report
     */
    printHealthReport(): void {
        const prefix = getLogPrefix();
        const health = this.checkHealth();
        const metrics = health.metrics;

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} HEALTH REPORT`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Status: ${health.healthy ? '✅ HEALTHY' : '⚠️  DEGRADED'}`);

        if (!health.healthy) {
            logger.info(`${prefix} Reason: ${health.reason}`);
        }

        logger.info(`${prefix} `);
        logger.info(`${prefix} Metrics:`);
        logger.info(`${prefix}   Failure rate: ${(metrics.failure_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.failure_rate * 100).toFixed(0)}%)`);
        logger.info(`${prefix}   Stall rate: ${(metrics.stall_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.stall_rate * 100).toFixed(0)}%)`);
        logger.info(`${prefix}   Retry exhaustion: ${(metrics.retry_exhaustion_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.retry_exhaustion_rate * 100).toFixed(0)}%)`);
        logger.info(`${prefix}   Timeout rate: ${(metrics.timeout_rate * 100).toFixed(1)}% (threshold: ${(SAFE_MODE_THRESHOLDS.timeout_rate * 100).toFixed(0)}%)`);
        logger.info(`${prefix} `);

        if (this.safeMode) {
            const duration = this.getSafeModeDuration()! / 1000;
            logger.info(`${prefix} SAFE MODE: ACTIVE`);
            logger.info(`${prefix}   Reason: ${this.safeModeReason}`);
            logger.info(`${prefix}   Duration: ${duration.toFixed(1)}s`);
            logger.info(`${prefix} `);
        }

        logger.info(`${prefix} ========================================`);
    }
}
