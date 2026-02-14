/**
 * Assignment Engine (Mode A: Autopilot)
 * 
 * Deterministic agent selection for missions below bidding threshold.
 * Implements anti-monopoly fairness to prevent same agent from winning everything.
 */

import { AgentAuth, AgentProfile } from '../registry/agent-auth';
import { Mission, MissionStore } from './mission-store';
import { AssignmentHistoryTracker } from './assignment-history';
import { ReputationEngine } from '../agents/reputation-engine';

export interface AssignmentScore {
    agent_id: string;
    agent_name: string;
    base_score: number;
    recent_wins: number;
    anti_monopoly_multiplier: number;
    reputation_multiplier: number;
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
        reputation_multiplier: number;
        explanation_text: string;
        top_candidates?: { agent_name: string; final_score: number }[];
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
    max_active_missions_per_agent: 10,  // Increased from 3 to allow more concurrent missions
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
    private missionStore: MissionStore;
    private reputationEngine: ReputationEngine;

    constructor(
        agentAuth: AgentAuth,
        historyTracker: AssignmentHistoryTracker,
        missionStore: MissionStore,
        reputationEngine: ReputationEngine,
        config?: Partial<AssignmentConfig>
    ) {
        this.agentAuth = agentAuth;
        this.historyTracker = historyTracker;
        this.missionStore = missionStore;
        this.reputationEngine = reputationEngine;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Assign agent to mission using deterministic autopilot selection
     */
    async assignAgent(mission: Mission): Promise<AssignmentResult> {
        console.log(`[AssignmentEngine] Assigning agent for mission ${mission.id}`);

        // Step 1: Get all agents
        const allAgents = await this.agentAuth.listAgents();

        // Step 2: Apply hard filters
        // Note: applyHardFilters is async now because getActiveMissionCount handles async DB calls
        const candidates = await this.applyHardFilters(allAgents, mission);

        if (candidates.length === 0) {
            return {
                success: false,
                reason: 'No agents match required criteria (specialty, availability, capacity)'
            };
        }

        console.log(`[AssignmentEngine] ${candidates.length} candidates after hard filters`);

        // Step 3: Calculate scores
        const scores = await this.calculateScores(candidates, mission);

        // Step 4: Select winner (Exploration vs Exploitation)
        // 85% chance to pick best score (Exploitation)
        // 15% chance to pick random from top K (Exploration)
        const isExploration = Math.random() < 0.15;
        let winner: AssignmentScore | null = null;
        let selectionMethod = 'best_score';

        if (isExploration && scores.length > 1) {
            console.log(`[AssignmentEngine] 🎲 Exploration mode triggered (15%)`);
            winner = this.selectExplorationWinner(scores);
            selectionMethod = 'exploration_random';
        } else {
            winner = this.selectWinner(scores, mission.id);
        }

        if (!winner) {
            return {
                success: false,
                reason: 'No suitable agent found (tie or all scores too low)',
                scores
            };
        }

        // Step 5: Record assignment
        await this.recordAssignment(winner.agent_id, mission.id);

        console.log(`[AssignmentEngine] Assigned to ${winner.agent_name} (score: ${winner.final_score.toFixed(3)}, method: ${selectionMethod})`);

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
                pool_size: Math.min(this.config.top_k_pool_size, scores.length),
                reputation_multiplier: winner.reputation_multiplier,
                explanation_text: this.generateExplanation(winner, selectionMethod === 'exploration_random'),
                top_candidates: scores.slice(0, 5).map(s => ({
                    agent_name: s.agent_name,
                    final_score: s.final_score
                }))
            },
            scores
        };
    }

    /**
     * Apply hard filters to candidate pool
     */
    private async applyHardFilters(agents: AgentProfile[], mission: Mission): Promise<AgentProfile[]> {
        console.log(`[AssignmentEngine] Filtering ${agents.length} agents for mission ${mission.id}`);
        console.log(`  Specialty required: ${mission.specialties?.join(', ') || 'none'}`);
        console.log(`  Reward: ${mission.reward} CLAWGER`);

        const filtered: AgentProfile[] = [];

        for (const agent of agents) {
            // Filter 1: Specialty match
            if (mission.specialties && mission.specialties.length > 0) {
                const agentSpecialties = agent.specialties || [];
                const hasMatch = mission.specialties?.some(reqSpec =>
                    agentSpecialties.some(agentSpec =>
                        agentSpec.toLowerCase().includes(reqSpec.toLowerCase()) ||
                        reqSpec.toLowerCase().includes(agentSpec.toLowerCase())
                    )
                );
                if (!hasMatch) {
                    // console.log(`  ❌ ${agent.name}: Missing specialty (has: ${agentSpecialties.join(', ')})`);
                    continue;
                }
            }

            // Filter 2: Neural Spec Capability Match (if neural_spec exists)
            if (agent.neural_spec && mission.specialties && mission.specialties.length > 0) {
                const neuralCapabilities = agent.neural_spec.capabilities || [];
                const hasCapability = mission.specialties.some(reqSpec =>
                    neuralCapabilities.some(cap =>
                        cap.toLowerCase().includes(reqSpec.toLowerCase()) ||
                        reqSpec.toLowerCase().includes(cap.toLowerCase())
                    )
                );
                if (!hasCapability) {
                    continue;
                }
            }

            // Filter 3: Neural Spec Max Reward Limit (if neural_spec exists)
            if (agent.neural_spec && agent.neural_spec.mission_limits) {
                const maxReward = agent.neural_spec.mission_limits.max_reward;
                if (mission.reward > maxReward) {
                    continue;
                }
            }

            // Filter 4: Availability
            if (!agent.available) {
                continue;
            }

            // Filter 5: Agent must not be suspended
            if (agent.status === 'suspended') {
                continue;
            }

            // Filter 6: Agent must have capacity
            const activeMissions = await this.getActiveMissionCount(agent.id); // Await the async call
            const maxConcurrent = agent.neural_spec?.mission_limits?.max_concurrent || this.config.max_active_missions_per_agent;
            if (activeMissions >= maxConcurrent) {
                console.log(`  ❌ ${agent.name}: At capacity (${activeMissions}/${maxConcurrent})`);
                continue;
            }

            // console.log(`  ✅ ${agent.name}: Passed all filters (active: ${activeMissions}/${maxConcurrent})`);
            filtered.push(agent);
        }

        console.log(`[AssignmentEngine] ${filtered.length} candidates after filtering`);
        return filtered;
    }

    /**
     * Calculate scores for all candidates
     */
    private async calculateScores(candidates: AgentProfile[], mission: Mission): Promise<AssignmentScore[]> {
        const scores = await Promise.all(candidates.map(async agent => {
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

            // --- Multipliers ---

            // 1. Reputation Multiplier: clamp(0.9, 1.6, 0.9 + reputation/200)
            // This ensures even 0 reputation gets 0.9x, and max rep gets 1.4x (capped at 1.6x)
            let reputation_multiplier = 0.9 + (agent.reputation / 200);
            reputation_multiplier = Math.max(0.9, Math.min(1.6, reputation_multiplier));

            // 2. Anti-Monopoly Multiplier (Diminishing returns)
            const recent_wins = await this.historyTracker.getRecentWins(agent.id);
            const anti_monopoly_multiplier = Math.pow(this.config.diminishing_factor, recent_wins);

            // 3. Cooldown Penalty (Hard -0.15 check)
            // If won last 3 missions (consecutive wins >= 3), apply penalty
            const consecutiveWins = await this.historyTracker.getConsecutiveWins(agent.id);
            const cooldown_penalty = consecutiveWins >= 3 ? 0.15 : 0;

            const final_score = (base_score * reputation_multiplier * anti_monopoly_multiplier) - cooldown_penalty;

            return {
                agent_id: agent.id,
                agent_name: agent.name,
                base_score,
                recent_wins,
                anti_monopoly_multiplier,
                reputation_multiplier,
                final_score,
                breakdown: {
                    reputation_score,
                    bond_score,
                    rate_score,
                    latency_score
                }
            };
        }));

        return scores.sort((a, b) => b.final_score - a.final_score); // Sort descending
    }

    /**
     * Select random winner from top K eligible candidates (Exploration)
     */
    private selectExplorationWinner(scores: AssignmentScore[]): AssignmentScore {
        const topK = scores.slice(0, Math.min(this.config.top_k_pool_size, scores.length));
        const randomIndex = Math.floor(Math.random() * topK.length);
        const winner = topK[randomIndex];
        winner.rank_in_pool = randomIndex + 1; // It's their rank in result list, effectively
        return winner;
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
    private async getActiveMissionCount(agentId: string): Promise<number> {
        // Query mission store for actual active missions
        const missions = await this.missionStore.list(); // Await async list
        const activeMissions = missions.filter(m =>
            m.assigned_agent?.agent_id === agentId &&
            ['assigned', 'executing', 'verifying'].includes(m.status)
        );
        return activeMissions.length;
    }

    /**
     * Record assignment for anti-monopoly tracking
     */
    private async recordAssignment(agentId: string, missionId: string): Promise<void> {
        await this.historyTracker.recordAssignment(agentId, missionId);
    }

    /**
     * Get assignment statistics
     */
    async getStats(): Promise<{
        total_assignments: number;
        total_agents: number;
        assignments_by_agent: Map<string, number>;
    }> {
        return await this.historyTracker.getStats();
    }

    /**
     * Get assignment history tracker (for testing/debugging)
     */
    getHistoryTracker(): AssignmentHistoryTracker {
        return this.historyTracker;
    }

    /**
     * Generate human-readable explanation for assignment choice
     */
    private generateExplanation(score: AssignmentScore, isExploration: boolean = false): string {
        const parts = [];

        if (isExploration) {
            parts.push("Selected via Exploration Protocol (15% chance) to give opportunities to eligible candidates.");
            return parts.join(" ");
        }

        if (score.reputation_multiplier > 1.1) {
            parts.push("Strong reputation significantly boosted score.");
        } else if (score.reputation_multiplier < 0.95) {
            parts.push("Low reputation slightly penalized selection probability.");
        }

        if (score.recent_wins > 0) {
            parts.push(`Prioritized others slightly due to ${score.recent_wins} recent wins (Anti-Monopoly).`);
        }

        if (score.base_score > 0.8) {
            parts.push("Excellent capability and bond match.");
        } else if (score.base_score > 0.6) {
            parts.push("Good overall capability match.");
        }

        return parts.join(" ") || "Selected based on balanced scoring of reputation and availability.";
    }
}
