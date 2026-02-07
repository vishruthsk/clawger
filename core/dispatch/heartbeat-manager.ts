/**
 * Heartbeat Manager
 * 
 * Tracks agent activity via polling and automatically marks stale agents
 * as unavailable.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentAuth } from '../registry/agent-auth';

export interface AgentHeartbeat {
    agent_id: string;
    last_poll: Date;
    last_task_ack: Date | null;
    poll_count: number;
    task_ack_count: number;
    is_active: boolean;
}

export interface HeartbeatConfig {
    stale_threshold_minutes: number;  // Default: 5
    cleanup_interval_minutes: number; // Default: 10
    persist_to_disk: boolean;         // Default: true
}

const DEFAULT_CONFIG: HeartbeatConfig = {
    stale_threshold_minutes: 5,
    cleanup_interval_minutes: 10,
    persist_to_disk: true
};

export class HeartbeatManager {
    private heartbeats: Map<string, AgentHeartbeat> = new Map();
    private config: HeartbeatConfig;
    private dataDir: string;
    private heartbeatsFile: string;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private agentAuth: AgentAuth;

    constructor(
        agentAuth: AgentAuth,
        dataDir: string = './data',
        config?: Partial<HeartbeatConfig>
    ) {
        this.agentAuth = agentAuth;
        this.dataDir = dataDir;
        this.heartbeatsFile = path.join(dataDir, 'heartbeats.json');
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (this.config.persist_to_disk) {
            this.load();
        }

        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Record agent poll
     */
    recordPoll(agentId: string): void {
        const existing = this.heartbeats.get(agentId);

        if (existing) {
            existing.last_poll = new Date();
            existing.poll_count++;
            existing.is_active = true;
        } else {
            this.heartbeats.set(agentId, {
                agent_id: agentId,
                last_poll: new Date(),
                last_task_ack: null,
                poll_count: 1,
                task_ack_count: 0,
                is_active: true
            });
        }

        this.save();
    }

    /**
     * Record task acknowledgment
     */
    recordAck(agentId: string, taskId: string): void {
        const existing = this.heartbeats.get(agentId);

        if (existing) {
            existing.last_task_ack = new Date();
            existing.task_ack_count++;
        } else {
            // Create heartbeat if doesn't exist
            this.heartbeats.set(agentId, {
                agent_id: agentId,
                last_poll: new Date(),
                last_task_ack: new Date(),
                poll_count: 0,
                task_ack_count: 1,
                is_active: true
            });
        }

        this.save();
    }

    /**
     * Get active agents (polled within threshold)
     */
    getActiveAgents(): AgentHeartbeat[] {
        const threshold = new Date(
            Date.now() - this.config.stale_threshold_minutes * 60 * 1000
        );

        return Array.from(this.heartbeats.values())
            .filter(h => h.last_poll > threshold && h.is_active)
            .sort((a, b) => b.last_poll.getTime() - a.last_poll.getTime());
    }

    /**
     * Get heartbeat for specific agent
     */
    getHeartbeat(agentId: string): AgentHeartbeat | null {
        return this.heartbeats.get(agentId) || null;
    }

    /**
     * Check if agent is active
     */
    isActive(agentId: string): boolean {
        const heartbeat = this.heartbeats.get(agentId);
        if (!heartbeat) return false;

        const threshold = new Date(
            Date.now() - this.config.stale_threshold_minutes * 60 * 1000
        );

        return heartbeat.last_poll > threshold && heartbeat.is_active;
    }

    /**
     * Cleanup stale agents
     */
    cleanup(): { marked_inactive: number } {
        const threshold = new Date(
            Date.now() - this.config.stale_threshold_minutes * 60 * 1000
        );

        let marked_inactive = 0;

        for (const [agentId, heartbeat] of this.heartbeats.entries()) {
            if (heartbeat.is_active && heartbeat.last_poll < threshold) {
                heartbeat.is_active = false;

                // Update agent availability in AgentAuth
                const agent = this.agentAuth.getById(agentId);
                if (agent && agent.available) {
                    console.log(`[HeartbeatManager] Marking agent ${agentId} as unavailable (stale)`);
                    // Note: We don't have direct access to update agent profile here
                    // This would need to be done via AgentAuth API or event system
                }

                marked_inactive++;
            }
        }

        if (marked_inactive > 0) {
            this.save();
            console.log(`[HeartbeatManager] Cleanup: ${marked_inactive} agents marked inactive`);
        }

        return { marked_inactive };
    }

    /**
     * Get heartbeat statistics
     */
    getStats(): {
        total_agents: number;
        active_agents: number;
        inactive_agents: number;
        total_polls: number;
        total_acks: number;
    } {
        const heartbeats = Array.from(this.heartbeats.values());
        const activeAgents = this.getActiveAgents();

        return {
            total_agents: heartbeats.length,
            active_agents: activeAgents.length,
            inactive_agents: heartbeats.length - activeAgents.length,
            total_polls: heartbeats.reduce((sum, h) => sum + h.poll_count, 0),
            total_acks: heartbeats.reduce((sum, h) => sum + h.task_ack_count, 0)
        };
    }

    /**
     * Start automatic cleanup interval
     */
    private startCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.cleanup_interval_minutes * 60 * 1000);

        console.log(`[HeartbeatManager] Cleanup interval started (every ${this.config.cleanup_interval_minutes} minutes)`);
    }

    /**
     * Stop cleanup interval
     */
    stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[HeartbeatManager] Cleanup interval stopped');
        }
    }

    /**
     * Save heartbeats to disk
     */
    private save(): void {
        if (!this.config.persist_to_disk) return;

        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            const data = Array.from(this.heartbeats.values());
            fs.writeFileSync(this.heartbeatsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[HeartbeatManager] Failed to save heartbeats:', error);
        }
    }

    /**
     * Load heartbeats from disk
     */
    private load(): void {
        try {
            if (fs.existsSync(this.heartbeatsFile)) {
                const data = JSON.parse(fs.readFileSync(this.heartbeatsFile, 'utf-8'));

                for (const heartbeat of data) {
                    // Restore Date objects
                    heartbeat.last_poll = new Date(heartbeat.last_poll);
                    if (heartbeat.last_task_ack) {
                        heartbeat.last_task_ack = new Date(heartbeat.last_task_ack);
                    }

                    this.heartbeats.set(heartbeat.agent_id, heartbeat);
                }

                console.log(`[HeartbeatManager] Loaded ${this.heartbeats.size} heartbeats from disk`);
            }
        } catch (error) {
            console.error('[HeartbeatManager] Failed to load heartbeats:', error);
        }
    }
}
