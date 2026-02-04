/**
 * Process Enforcer
 * LOCAL mode enforcement via process control
 */

import { EnforcementAction, LocalAgent } from '../types';
import { LocalAgentManager } from './local-agent-manager';
import { getLogPrefix } from '../../config/demo-config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = console;

export class ProcessEnforcer {
    private agentManager: LocalAgentManager;
    private actions: EnforcementAction[] = [];

    // Thresholds
    private readonly MAX_CPU = 95; // percentage
    private readonly MAX_MEMORY = 2048; // MB
    private readonly MAX_HEARTBEAT_GAP = 30000; // ms
    private readonly QUARANTINE_DURATION = 1800000; // 30 minutes

    constructor(agentManager: LocalAgentManager) {
        this.agentManager = agentManager;
    }

    /**
     * Enforce policies on all agents
     */
    async enforce(): Promise<void> {
        const prefix = getLogPrefix();

        // Release quarantined agents if time is up
        this.agentManager.releaseQuarantined();

        // Check for misbehaving agents
        const misbehaving = this.agentManager.checkForMisbehavior();

        if (misbehaving.length === 0) {
            return;
        }

        logger.warn(`${prefix} [LOCAL] ENFORCEMENT: ${misbehaving.length} agents misbehaving`);

        for (const address of misbehaving) {
            await this.enforceAgent(address);
        }
    }

    /**
     * Enforce policy on a specific agent
     */
    private async enforceAgent(address: string): Promise<void> {
        const prefix = getLogPrefix();
        const agent = this.agentManager.getAgent(address);

        if (!agent) {
            logger.error(`${prefix} [LOCAL] Agent not found: ${address}`);
            return;
        }

        // Determine violation
        let reason: string;
        let action: EnforcementAction['type'];

        if (agent.cpu > this.MAX_CPU) {
            reason = `Excessive CPU usage: ${agent.cpu.toFixed(1)}%`;
            action = 'kill';

        } else if (agent.memory > this.MAX_MEMORY) {
            reason = `Excessive memory usage: ${agent.memory.toFixed(0)}MB`;
            action = 'kill';

        } else {
            const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
            if (timeSinceHeartbeat > this.MAX_HEARTBEAT_GAP) {
                reason = `No heartbeat for ${Math.floor(timeSinceHeartbeat / 1000)}s`;
                action = 'kill';
            } else {
                // Unknown violation
                return;
            }
        }

        // Check failure rate for quarantine decision
        const totalTasks = agent.tasksCompleted + agent.tasksFailed;
        const failureRate = totalTasks > 0 ? agent.tasksFailed / totalTasks : 0;

        if (failureRate > 0.5 && totalTasks >= 3) {
            // High failure rate: quarantine after killing
            logger.warn(`${prefix} [LOCAL] ENFORCEMENT: Agent ${address} has high failure rate: ${(failureRate * 100).toFixed(1)}%`);
            await this.killProcess(agent.pid, address, reason);
            this.quarantineAgent(address, reason);
        } else {
            // Normal violation: just kill
            await this.killProcess(agent.pid, address, reason);
        }
    }

    /**
     * Kill a process
     */
    private async killProcess(pid: number, address: string, reason: string): Promise<void> {
        const prefix = getLogPrefix();

        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} [LOCAL] ENFORCEMENT: KILL`);
        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} Agent: ${address}`);
        logger.warn(`${prefix} PID: ${pid}`);
        logger.warn(`${prefix} Reason: ${reason}`);
        logger.warn(`${prefix} ========================================`);

        try {
            // Send SIGKILL
            await execAsync(`kill -9 ${pid}`);

            this.agentManager.updateStatus(address, 'terminated');

            this.recordAction({
                type: 'kill',
                agent: address,
                reason,
                timestamp: new Date()
            });

            logger.warn(`${prefix} [LOCAL] Process ${pid} killed successfully`);

        } catch (error) {
            logger.error(`${prefix} [LOCAL] Failed to kill process ${pid}:`, error);
        }
    }

    /**
     * Quarantine an agent
     */
    private quarantineAgent(address: string, reason: string): void {
        const prefix = getLogPrefix();

        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} [LOCAL] ENFORCEMENT: QUARANTINE`);
        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} Agent: ${address}`);
        logger.warn(`${prefix} Reason: ${reason}`);
        logger.warn(`${prefix} Duration: ${this.QUARANTINE_DURATION / 60000} minutes`);
        logger.warn(`${prefix} ========================================`);

        this.agentManager.quarantine(address, this.QUARANTINE_DURATION);

        this.recordAction({
            type: 'quarantine',
            agent: address,
            reason,
            timestamp: new Date()
        });
    }

    /**
     * Reassign task from failed agent
     */
    async reassignTask(
        taskId: string,
        fromAgent: string,
        toAgent: string,
        reason: string
    ): Promise<void> {
        const prefix = getLogPrefix();

        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} [LOCAL] ENFORCEMENT: REASSIGN`);
        logger.warn(`${prefix} ========================================`);
        logger.warn(`${prefix} Task: ${taskId}`);
        logger.warn(`${prefix} From: ${fromAgent}`);
        logger.warn(`${prefix} To: ${toAgent}`);
        logger.warn(`${prefix} Reason: ${reason}`);
        logger.warn(`${prefix} ========================================`);

        // Update agent statuses
        const fromAgentData = this.agentManager.getAgent(fromAgent);
        if (fromAgentData) {
            this.agentManager.updateStatus(fromAgent, 'idle');
        }

        const toAgentData = this.agentManager.getAgent(toAgent);
        if (toAgentData) {
            this.agentManager.updateStatus(toAgent, 'working');
        }

        this.recordAction({
            type: 'reassign',
            agent: fromAgent,
            reason,
            timestamp: new Date(),
            taskId
        });
    }

    /**
     * Restart a process (for recoverable failures)
     */
    async restartProcess(address: string, reason: string): Promise<void> {
        const prefix = getLogPrefix();

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} [LOCAL] ENFORCEMENT: RESTART`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Agent: ${address}`);
        logger.info(`${prefix} Reason: ${reason}`);
        logger.info(`${prefix} ========================================`);

        const agent = this.agentManager.getAgent(address);
        if (!agent) {
            logger.error(`${prefix} [LOCAL] Agent not found: ${address}`);
            return;
        }

        // Kill existing process
        try {
            await execAsync(`kill -9 ${agent.pid}`);
        } catch (error) {
            // Process might already be dead
        }

        // In a real implementation, you would restart the agent process here
        // For now, just mark as terminated
        this.agentManager.updateStatus(address, 'terminated');

        this.recordAction({
            type: 'restart',
            agent: address,
            reason,
            timestamp: new Date()
        });

        logger.info(`${prefix} [LOCAL] Agent restart initiated`);
    }

    /**
     * Record enforcement action
     */
    private recordAction(action: EnforcementAction): void {
        this.actions.push(action);

        // Keep only last 100 actions
        if (this.actions.length > 100) {
            this.actions = this.actions.slice(-100);
        }
    }

    /**
     * Get enforcement history
     */
    getHistory(limit: number = 20): EnforcementAction[] {
        return this.actions.slice(-limit);
    }

    /**
     * Get enforcement statistics
     */
    getStatistics(): {
        total: number;
        kills: number;
        restarts: number;
        quarantines: number;
        reassignments: number;
    } {
        return {
            total: this.actions.length,
            kills: this.actions.filter(a => a.type === 'kill').length,
            restarts: this.actions.filter(a => a.type === 'restart').length,
            quarantines: this.actions.filter(a => a.type === 'quarantine').length,
            reassignments: this.actions.filter(a => a.type === 'reassign').length,
        };
    }
}
