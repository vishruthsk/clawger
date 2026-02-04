/**
 * Local Agent Manager
 * Manages worker/verifier processes running on the same system
 */

import { LocalAgent, AgentType, ProcessMetrics } from '../types';
import { getLogPrefix } from '../../config/demo-config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = console;

export class LocalAgentManager {
    private agents: Map<string, LocalAgent> = new Map();
    private monitoringInterval: NodeJS.Timeout | null = null;

    /**
     * Register a local agent process
     */
    registerAgent(
        pid: number,
        address: string,
        type: AgentType
    ): void {
        const prefix = getLogPrefix();

        const agent: LocalAgent = {
            pid,
            address,
            type,
            status: 'running',
            cpu: 0,
            memory: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            lastHeartbeat: new Date()
        };

        this.agents.set(address, agent);

        logger.info(`${prefix} [LOCAL] Agent registered: ${address} (PID ${pid}, ${type})`);
    }

    /**
     * Start monitoring agents
     */
    startMonitoring(intervalMs: number = 5000): void {
        const prefix = getLogPrefix();

        logger.info(`${prefix} [LOCAL] Starting agent monitoring (interval: ${intervalMs}ms)`);

        this.monitoringInterval = setInterval(() => {
            this.monitorAllAgents();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * Monitor all agents
     */
    private async monitorAllAgents(): Promise<void> {
        for (const [address, agent] of this.agents.entries()) {
            if (agent.status === 'terminated') continue;

            try {
                const metrics = await this.getProcessMetrics(agent.pid);
                agent.cpu = metrics.cpu;
                agent.memory = metrics.memory;
                agent.lastHeartbeat = new Date();
            } catch (error) {
                // Process might have died
                const prefix = getLogPrefix();
                logger.warn(`${prefix} [LOCAL] Agent ${address} (PID ${agent.pid}) not responding`);
                agent.status = 'terminated';
            }
        }
    }

    /**
     * Get process metrics (CPU, memory)
     */
    private async getProcessMetrics(pid: number): Promise<ProcessMetrics> {
        try {
            // Use ps command to get process stats
            // This is a simplified version - in production, use proper process monitoring
            const { stdout } = await execAsync(`ps -p ${pid} -o %cpu,%mem,etime | tail -1`);

            const parts = stdout.trim().split(/\s+/);
            const cpu = parseFloat(parts[0]) || 0;
            const memory = parseFloat(parts[1]) || 0;

            // Parse uptime (format: [[dd-]hh:]mm:ss)
            const uptimeStr = parts[2] || '0:00';
            const uptime = this.parseUptime(uptimeStr);

            return {
                pid,
                cpu,
                memory,
                uptime
            };
        } catch (error) {
            throw new Error(`Process ${pid} not found`);
        }
    }

    /**
     * Parse uptime string to seconds
     */
    private parseUptime(uptimeStr: string): number {
        const parts = uptimeStr.split(':').reverse();
        let seconds = 0;

        if (parts[0]) seconds += parseInt(parts[0]); // seconds
        if (parts[1]) seconds += parseInt(parts[1]) * 60; // minutes
        if (parts[2]) seconds += parseInt(parts[2]) * 3600; // hours

        return seconds;
    }

    /**
     * Get agent by address
     */
    getAgent(address: string): LocalAgent | null {
        return this.agents.get(address) || null;
    }

    /**
     * Get all agents
     */
    getAllAgents(): LocalAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get agents by status
     */
    getAgentsByStatus(status: LocalAgent['status']): LocalAgent[] {
        return Array.from(this.agents.values()).filter(
            agent => agent.status === status
        );
    }

    /**
     * Get available workers
     */
    getAvailableWorkers(): LocalAgent[] {
        return Array.from(this.agents.values()).filter(
            agent => agent.type === 'worker' &&
                agent.status === 'idle' &&
                !agent.quarantineUntil
        );
    }

    /**
     * Get available verifiers
     */
    getAvailableVerifiers(): LocalAgent[] {
        return Array.from(this.agents.values()).filter(
            agent => agent.type === 'verifier' &&
                agent.status === 'idle' &&
                !agent.quarantineUntil
        );
    }

    /**
     * Update agent status
     */
    updateStatus(address: string, status: LocalAgent['status']): void {
        const prefix = getLogPrefix();
        const agent = this.agents.get(address);

        if (!agent) {
            throw new Error(`Agent not found: ${address}`);
        }

        const oldStatus = agent.status;
        agent.status = status;

        logger.info(`${prefix} [LOCAL] Agent ${address}: ${oldStatus} → ${status}`);
    }

    /**
     * Record task completion
     */
    recordTaskCompletion(address: string, success: boolean): void {
        const agent = this.agents.get(address);

        if (!agent) {
            throw new Error(`Agent not found: ${address}`);
        }

        if (success) {
            agent.tasksCompleted++;
        } else {
            agent.tasksFailed++;
        }

        agent.status = 'idle';
    }

    /**
     * Quarantine an agent
     */
    quarantine(address: string, durationMs: number = 1800000): void {
        const prefix = getLogPrefix();
        const agent = this.agents.get(address);

        if (!agent) {
            throw new Error(`Agent not found: ${address}`);
        }

        agent.status = 'quarantined';
        agent.quarantineUntil = new Date(Date.now() + durationMs);

        const durationMin = Math.floor(durationMs / 60000);
        logger.warn(`${prefix} [LOCAL] Agent ${address} quarantined for ${durationMin} minutes`);
    }

    /**
     * Check and release quarantined agents
     */
    releaseQuarantined(): void {
        const prefix = getLogPrefix();
        const now = new Date();

        for (const [address, agent] of this.agents.entries()) {
            if (agent.status === 'quarantined' && agent.quarantineUntil) {
                if (now >= agent.quarantineUntil) {
                    agent.status = 'idle';
                    agent.quarantineUntil = undefined;
                    logger.info(`${prefix} [LOCAL] Agent ${address} released from quarantine`);
                }
            }
        }
    }

    /**
     * Check for misbehaving agents
     */
    checkForMisbehavior(): string[] {
        const misbehaving: string[] = [];

        for (const [address, agent] of this.agents.entries()) {
            if (agent.status === 'terminated' || agent.status === 'quarantined') {
                continue;
            }

            // Check CPU usage
            if (agent.cpu > 95) {
                misbehaving.push(address);
                continue;
            }

            // Check memory usage (> 2GB)
            if (agent.memory > 2048) {
                misbehaving.push(address);
                continue;
            }

            // Check heartbeat (> 30 seconds)
            const timeSinceHeartbeat = Date.now() - agent.lastHeartbeat.getTime();
            if (timeSinceHeartbeat > 30000) {
                misbehaving.push(address);
                continue;
            }
        }

        return misbehaving;
    }

    /**
     * Get agent statistics
     */
    getStatistics(): {
        total: number;
        running: number;
        idle: number;
        working: number;
        quarantined: number;
        terminated: number;
        workers: number;
        verifiers: number;
    } {
        const agents = Array.from(this.agents.values());

        return {
            total: agents.length,
            running: agents.filter(a => a.status === 'running').length,
            idle: agents.filter(a => a.status === 'idle').length,
            working: agents.filter(a => a.status === 'working').length,
            quarantined: agents.filter(a => a.status === 'quarantined').length,
            terminated: agents.filter(a => a.status === 'terminated').length,
            workers: agents.filter(a => a.type === 'worker').length,
            verifiers: agents.filter(a => a.type === 'verifier').length,
        };
    }
}
