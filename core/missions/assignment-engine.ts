/**
 * Assignment Engine (Mode A: Autopilot)
 * 
 * Deterministic agent selection for missions below bidding threshold.
 * Implements anti-monopoly fairness to prevent same agent from winning everything.
 */

import { AgentAuth, AgentProfile } from '../registry/agent-auth';
import { Mission } from './mission-store';
import { AssignmentHistoryTracker } from './assignment-history';

export interface AssignmentScore {
    agent_id: string;
    agent_name: string;
    base_score: number;
    recent_wins: number;
    anti_monopoly_multiplier: number;
    final_score: number;
    rank_in_pool?: number;
    breakdown: {
        reputation_score: number;
        bond_score: number;
        rate_score: number;
        latency_score: number;
    };
}

export interface AssignmentResult {
    success: boolean;
    assigned_agent?: {
        agent_id: string;
        agent_name: string;
    };
    assignment_reasoning?: {
        base_score: number;
        recent_wins: number;
        diminishing_multiplier: number;
        adjusted_score: number;
        rank_in_pool: number;
        pool_size: number;
    };
    reason?: string;
    scores?: AssignmentScore[];
}

export interface AssignmentConfig {
    max_active_missions_per_agent: number;  // Default: 3
    diminishing_factor: number;              // Default: 0.9
    top_k_pool_size: number;                 // Default: 5
    weights: {
        reputation: number;                  // Default: 0.4
        bond: number;                        // Default: 0.2
        rate: number;                        // Default: 0.2
        latency: number;                     // Default: 0.2
    };
}

const DEFAULT_CONFIG: AssignmentConfig = {
    max_active_missions_per_agent: 3,
    diminishing_factor: 0.9,
    top_k_pool_size: 5,
    weights: {
        reputation: 0.4,
        bond: 0.2,
        rate: 0.2,
        latency: 0.2
    }
};

export class AssignmentEngine {
    private agentAuth: AgentAuth;
    private config: AssignmentConfig;
    private historyTracker: AssignmentHistoryTracker;

    constructor(
        agentAuth: AgentAuth,
        historyTracker: AssignmentHistoryTracker,
        config?: Partial<AssignmentConfig>
    ) {
        this.agentAuth = agentAuth;
        this.historyTracker = historyTracker;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Assign agent to mission using deterministic autopilot selection
     */
    async assignAgent(mission: Mission): Promise<AssignmentResult> {
        console.log(`[AssignmentEngine] Assigning agent for mission ${mission.id}`);

        // Step 1: Get all agents
        const allAgents = this.agentAuth.listAgents();

        // Step 2: Apply hard filters
        const candidates = this.applyHardFilters(allAgents, mission);

        if (candidates.length === 0) {
            return {
                success: false,
                reason: 'No agents match required criteria (specialty, availability, capacity)'
            };
        }

        console.log(`[AssignmentEngine] ${candidates.length} candidates after hard filters`);

        // Step 3: Calculate scores
        const scores = this.calculateScores(candidates, mission);

        // Step 4: Select winner deterministically
        const winner = this.selectWinner(scores, mission.id);

        if (!winner) {
            return {
                success: false,
                reason: 'No suitable agent found (tie or all scores too low)',
                scores
            };
        }

        // Step 5: Record assignment
        this.recordAssignment(winner.agent_id, mission.id);

        console.log(`[AssignmentEngine] Assigned to ${winner.agent_name} (score: ${winner.final_score.toFixed(3)}, rank: ${winner.rank_in_pool})`);

        return {
            success: true,
            assigned_agent: {
                agent_id: winner.agent_id,
                agent_name: winner.agent_name
            },
            assignment_reasoning: {
                base_score: winner.base_score,
                recent_wins: winner.recent_wins,
                diminishing_multiplier: winner.anti_monopoly_multiplier,
                adjusted_score: winner.final_score,
                rank_in_pool: winner.rank_in_pool || 1,
                pool_size: Math.min(this.config.top_k_pool_size, scores.length)
            },
            scores
        };
    }

    /**
     * Apply hard filters to candidate pool
     */
    private applyHardFilters(agents: AgentProfile[], mission: Mission): AgentProfile[] {
        return agents.filter(agent => {
            // Filter 1: Specialty match
            if (mission.specialties && mission.specialties.length > 0) {
                const agentSpecialties = agent.specialties || [];
                const hasMatch = mission.specialties?.some(reqSpec =>
                    agentSpecialties.some(agentSpec =>
                        agentSpec.toLowerCase().includes(reqSpec.toLowerCase()) ||
                        reqSpec.toLowerCase().includes(agentSpec.toLowerCase())
                    )
                );
                if (!hasMatch) return false;
            }

            // Filter 2: Availability
            if (!agent.available) return false;

            // Filter 3: Agent must not be suspended
            if (agent.status === 'suspended') {
                return false;
            }

            // Filter 4: Agent must have capacity (max active missions)
            const activeMissions = this.getActiveMissionCount(agent.id);
            if (activeMissions >= this.config.max_active_missions_per_agent) {
                return false;
            }

            return true;
        });
    }

    /**
     * Calculate scores for all candidates
     */
    private calculateScores(candidates: AgentProfile[], mission: Mission): AssignmentScore[] {
        return candidates.map(agent => {
            // Reputation score (0-100 → 0-1)
            const reputation_score = agent.reputation / 100;

            // Bond score (higher is better, normalized)
            // Assume agents have implicit bond based on reputation
            const bond_score = Math.min(agent.reputation / 100, 1);

            // Rate score (lower hourly rate is better)
            // Normalize: if rate is 0 or undefined, assume perfect score
            const rate_score = agent.hourly_rate
                ? Math.max(0, 1 - (agent.hourly_rate / 100)) // Assume max rate is 100
                : 1;

            // Latency score (based on last active time)
            // More recently active = higher score
            const hoursSinceActive = agent.lastActive
                ? (Date.now() - new Date(agent.lastActive).getTime()) / (1000 * 60 * 60)
                : 999;
            const latency_score = Math.max(0, 1 - (hoursSinceActive / 24)); // Decay over 24h

            // Calculate base score
            const base_score =
                reputation_score * this.config.weights.reputation +
                bond_score * this.config.weights.bond +
                rate_score * this.config.weights.rate +
                latency_score * this.config.weights.latency;

            // Apply anti-monopoly multiplier using persistent history
            const recent_wins = this.historyTracker.getRecentWins(agent.id);
            const anti_monopoly_multiplier = Math.pow(this.config.diminishing_factor, recent_wins);

            const final_score = base_score * anti_monopoly_multiplier;

            return {
                agent_id: agent.id,
                agent_name: agent.name,
                base_score,
                recent_wins,
                anti_monopoly_multiplier,
                final_score,
                breakdown: {
                    reputation_score,
                    bond_score,
                    rate_score,
                    latency_score
                }
            };
        }).sort((a, b) => b.final_score - a.final_score); // Sort descending
    }

    /**
     * Select winner from scored candidates using deterministic weighted selection
     */
    private selectWinner(scores: AssignmentScore[], missionId: string): AssignmentScore | null {
        if (scores.length === 0) return null;

        // Take top-K pool
        const topK = scores.slice(0, Math.min(this.config.top_k_pool_size, scores.length));

        // Add rank to each candidate
        topK.forEach((score, index) => {
            score.rank_in_pool = index + 1;
        });

        // Check for exact tie in top position (mission should fail)
        if (topK.length > 1 && topK[0].final_score === topK[1].final_score) {
            console.warn(`[AssignmentEngine] Exact tie detected, mission should fail`);
            return null;
        }

        // Use mission ID as deterministic seed for weighted random selection
        const seed = this.hashString(missionId);
        const winner = this.weightedRandomSelection(topK, seed);

        return winner;
    }

    /**
     * Weighted random selection using deterministic seed
     */
    private weightedRandomSelection(candidates: AssignmentScore[], seed: number): AssignmentScore {
        // Calculate total weight
        const totalWeight = candidates.reduce((sum, c) => sum + c.final_score, 0);

        // Generate deterministic random value [0, totalWeight)
        const random = (seed % 10000) / 10000 * totalWeight;

        // Select based on cumulative weights
        let cumulative = 0;
        for (const candidate of candidates) {
            cumulative += candidate.final_score;
            if (random < cumulative) {
                return candidate;
            }
        }

        // Fallback to first (highest score)
        return candidates[0];
    }

    /**
     * Simple hash function for deterministic randomness
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get active mission count for agent
     */
    private getActiveMissionCount(agentId: string): number {
        // Use assignment history as proxy for active missions
        // In production, this would query the mission store
        return this.historyTracker.getRecentWins(agentId, 3);
    }

    /**
     * Record assignment for anti-monopoly tracking
     */
    private recordAssignment(agentId: string, missionId: string): void {
        this.historyTracker.recordAssignment(agentId, missionId);
    }

    /**
     * Get assignment statistics
     */
    getStats(): {
        total_assignments: number;
        total_agents: number;
        assignments_by_agent: Map<string, number>;
    } {
        return this.historyTracker.getStats();
    }

    /**
     * Get assignment history tracker (for testing/debugging)
     */
    getHistoryTracker(): AssignmentHistoryTracker {
        return this.historyTracker;
    }
}
