/**
 * Reputation Engine
 * Calculates agent reputation from real outcomes only
 */

import { JobHistoryManager } from '../jobs/job-history-manager';

export class ReputationEngine {
    private readonly BASE_REPUTATION = 50;
    private readonly SETTLEMENT_BONUS = 5;
    private readonly FIVE_STAR_BONUS = 2;
    private readonly FAILURE_PENALTY = -5;

    private jobHistory: JobHistoryManager;

    constructor(dataDir: string = './data') {
        this.jobHistory = new JobHistoryManager(dataDir);
    }

    /**
     * Calculate reputation from job history
     */
    /**
     * Calculate reputation from job history
     */
    calculateReputation(agentId: string): number {
        const historyData = this.jobHistory.getHistory(agentId);
        const history = historyData.jobs;

        const SOFT_CAP_THRESHOLD = 50;
        const HARD_CAP = 200;
        const LOW_VALUE_THRESHOLD = 20;

        let reputation = this.BASE_REPUTATION;
        let jobCount = 0;

        // Track requester pairs for decay
        const requesterCounts = new Map<string, number>();

        for (const job of history) {
            jobCount++;

            if (job.outcome === 'PASS') {
                // Soft cap: Halve bonus after 50 jobs
                let bonusMultiplier = jobCount > SOFT_CAP_THRESHOLD ? 0.5 : 1.0;

                // Anti-Farming: Low Value Penalty
                if (job.reward < LOW_VALUE_THRESHOLD) {
                    bonusMultiplier *= 0.2; // Only 20% effective for micro-tasks
                }

                // Anti-Farming: Repeat Decay
                if (job.requester_id) {
                    const count = (requesterCounts.get(job.requester_id) || 0) + 1;
                    requesterCounts.set(job.requester_id, count);

                    if (count > 3) {
                        bonusMultiplier *= 0.5; // Decay for frequent repeats
                    }
                }

                // Settlement bonus
                // Weighted Gain: gain = settlement_bonus * log10(1 + reward/100)
                // This scales reputation gain by mission value.
                // Reward 100 -> log10(2) ~= 0.3 * bonus (1.5)
                // Reward 900 -> log10(10) = 1.0 * bonus (5.0)
                // Reward 9900 -> log10(100) = 2.0 * bonus (10.0)
                const rewardFactor = Math.log10(1 + (job.reward / 100));
                reputation += (this.SETTLEMENT_BONUS * bonusMultiplier * rewardFactor);

                // Rating bonus: clamp((rating - 3), -2, 2)
                if (job.rating) {
                    const ratingBonus = Math.max(-2, Math.min(2, job.rating - 3));
                    reputation += ratingBonus;
                }
            } else if (job.outcome === 'FAIL') {
                // -10 on failure
                reputation += -10;
            }
        }

        // Never negative, Hard cap at 200
        return Math.min(HARD_CAP, Math.max(0, reputation));
    }

    /**
     * Get reputation breakdown
     */
    getReputationBreakdown(agentId: string): {
        base: number;
        settlements: number;
        ratings: number;
        failures: number;
        total: number;
    } {
        const historyData = this.jobHistory.getHistory(agentId);
        const history = historyData.jobs;

        const SOFT_CAP_THRESHOLD = 50;
        const LOW_VALUE_THRESHOLD = 20;

        let settlementsBonus = 0;
        let ratingsBonus = 0;
        let failuresPenalty = 0;
        let jobCount = 0;

        const requesterCounts = new Map<string, number>();

        for (const job of history) {
            jobCount++;

            if (job.outcome === 'PASS') {
                let bonusMultiplier = jobCount > SOFT_CAP_THRESHOLD ? 0.5 : 1.0;

                // Anti-Farming: Low Value Penalty
                if (job.reward < LOW_VALUE_THRESHOLD) {
                    bonusMultiplier *= 0.2;
                }

                // Anti-Farming: Repeat Decay
                if (job.requester_id) {
                    const count = (requesterCounts.get(job.requester_id) || 0) + 1;
                    requesterCounts.set(job.requester_id, count);

                    if (count > 3) {
                        bonusMultiplier *= 0.5;
                    }
                }

                const rewardFactor = Math.log10(1 + (job.reward / 100));
                settlementsBonus += (this.SETTLEMENT_BONUS * bonusMultiplier * rewardFactor);

                if (job.rating) {
                    ratingsBonus += Math.max(-2, Math.min(2, job.rating - 3));
                }
            } else if (job.outcome === 'FAIL') {
                failuresPenalty += -10;
            }
        }

        const total = Math.max(0, this.BASE_REPUTATION + settlementsBonus + ratingsBonus + failuresPenalty);
        // Apply hard cap to total
        const finalTotal = Math.min(200, total);

        return {
            base: this.BASE_REPUTATION,
            settlements: Math.round(settlementsBonus * 10) / 10,
            ratings: ratingsBonus,
            failures: failuresPenalty,
            total: Math.round(finalTotal * 10) / 10
        };
    }

    /**
     * Update agent reputation in registry
     */
    async updateReputation(agentId: string, agentAuth: any): Promise<number> {
        const newReputation = this.calculateReputation(agentId);

        // Update agent profile
        const agents = agentAuth.listAgents();
        const agent = agents.find((a: any) => a.id === agentId);

        if (agent) {
            agent.reputation = newReputation;
            // Note: AgentAuth doesn't have updateAgent method, so we'll update directly
            console.log(`[ReputationEngine] Updated reputation for ${agentId}: ${newReputation}`);
        }

        return newReputation;
    }
}
