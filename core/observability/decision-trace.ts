/**
 * Decision Trace Log
 * Structured, append-only log of supervisor decisions for audit and replay
 */

import { FailureType } from '../execution/work-contract';
import { ClawgerMode, getCurrentMode } from '../../config/mode-config';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type DecisionType =
    | 'CONTRACT_CREATED'
    | 'EXECUTION_STARTED'
    | 'HEARTBEAT_RECEIVED'
    | 'WORKER_KILLED'
    | 'WORK_REASSIGNED'
    | 'CONTRACT_COMPLETED'
    | 'CONTRACT_FAILED'
    | 'CONTRACT_TIMEOUT'
    | 'VERIFICATION_PASSED'
    | 'VERIFICATION_FAILED'
    | 'SAFE_MODE_ENTERED'
    | 'SAFE_MODE_EXITED';

export interface DecisionTrace {
    timestamp: Date;
    trace_id: string;
    contract_id: string;
    decision_type: DecisionType;
    reason: string;
    mode: ClawgerMode;
    context: Record<string, any>;
}

export class DecisionTraceLog {
    private traces: DecisionTrace[] = [];
    private mode: ClawgerMode;

    constructor(mode?: ClawgerMode) {
        this.mode = mode || getCurrentMode();
    }

    /**
     * Log a decision (append-only)
     */
    logDecision(
        contractId: string,
        decisionType: DecisionType,
        reason: string,
        context: Record<string, any> = {}
    ): DecisionTrace {
        const trace: DecisionTrace = {
            timestamp: new Date(),
            trace_id: `TRACE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            contract_id: contractId,
            decision_type: decisionType,
            reason: reason,
            mode: this.mode,
            context: context
        };

        this.traces.push(trace);

        return trace;
    }

    /**
     * Get all traces
     */
    getAllTraces(): DecisionTrace[] {
        return [...this.traces];
    }

    /**
     * Get traces for a specific contract
     */
    getContractTraces(contractId: string): DecisionTrace[] {
        return this.traces.filter(t => t.contract_id === contractId);
    }

    /**
     * Get recent traces
     */
    getRecentTraces(limit: number = 10): DecisionTrace[] {
        return this.traces.slice(-limit);
    }

    /**
     * Get traces by decision type
     */
    getTracesByType(decisionType: DecisionType): DecisionTrace[] {
        return this.traces.filter(t => t.decision_type === decisionType);
    }

    /**
     * Get traces in time range
     */
    getTracesInRange(start: Date, end: Date): DecisionTrace[] {
        return this.traces.filter(t =>
            t.timestamp >= start && t.timestamp <= end
        );
    }

    /**
     * Replay contract execution
     */
    replayContract(contractId: string): void {
        const prefix = getLogPrefix();
        const traces = this.getContractTraces(contractId);

        if (traces.length === 0) {
            logger.warn(`${prefix} No traces found for contract ${contractId}`);
            return;
        }

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} REPLAYING CONTRACT: ${contractId}`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Total events: ${traces.length}`);
        logger.info(`${prefix} Mode: ${traces[0].mode}`);
        logger.info(`${prefix} `);

        traces.forEach((trace, index) => {
            const time = trace.timestamp.toISOString();
            logger.info(`${prefix} [${index + 1}] ${time}`);
            logger.info(`${prefix}     ${trace.decision_type}: ${trace.reason}`);

            if (Object.keys(trace.context).length > 0) {
                logger.info(`${prefix}     Context: ${JSON.stringify(trace.context)}`);
            }

            logger.info(`${prefix} `);
        });

        logger.info(`${prefix} ========================================`);
    }

    /**
     * Export traces as JSON
     */
    exportJSON(): string {
        return JSON.stringify(this.traces, null, 2);
    }

    /**
     * Export traces for a contract as JSON
     */
    exportContractJSON(contractId: string): string {
        const traces = this.getContractTraces(contractId);
        return JSON.stringify(traces, null, 2);
    }

    /**
     * Get trace count
     */
    getTraceCount(): number {
        return this.traces.length;
    }

    /**
     * Get decision type counts
     */
    getDecisionTypeCounts(): Record<DecisionType, number> {
        const counts: Partial<Record<DecisionType, number>> = {};

        this.traces.forEach(trace => {
            counts[trace.decision_type] = (counts[trace.decision_type] || 0) + 1;
        });

        return counts as Record<DecisionType, number>;
    }

    /**
     * Print recent traces
     */
    printRecentTraces(limit: number = 10): void {
        const prefix = getLogPrefix();
        const traces = this.getRecentTraces(limit);

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} RECENT DECISIONS (last ${limit})`);
        logger.info(`${prefix} ========================================`);

        if (traces.length === 0) {
            logger.info(`${prefix} No traces yet`);
        } else {
            traces.forEach((trace, index) => {
                const time = trace.timestamp.toISOString();
                logger.info(`${prefix} [${time}] ${trace.decision_type}`);
                logger.info(`${prefix}   Contract: ${trace.contract_id}`);
                logger.info(`${prefix}   Reason: ${trace.reason}`);

                if (Object.keys(trace.context).length > 0) {
                    const contextStr = JSON.stringify(trace.context);
                    if (contextStr.length < 100) {
                        logger.info(`${prefix}   Context: ${contextStr}`);
                    }
                }

                if (index < traces.length - 1) {
                    logger.info(`${prefix} `);
                }
            });
        }

        logger.info(`${prefix} ========================================`);
    }

    /**
     * Print decision type summary
     */
    printDecisionSummary(): void {
        const prefix = getLogPrefix();
        const counts = this.getDecisionTypeCounts();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} DECISION TYPE SUMMARY`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Total traces: ${this.traces.length}`);
        logger.info(`${prefix} `);

        Object.entries(counts).forEach(([type, count]) => {
            logger.info(`${prefix} ${type}: ${count}`);
        });

        logger.info(`${prefix} ========================================`);
    }
}
