/**
 * Verifier Selection Logic
 * CLAWGER's autonomous verifier hiring system
 */

import { RegisteredAgent, VerifierSelection, RiskTolerance } from '../types';
import { AgentRegistry } from '../registry/agent-registry';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export class VerifierSelector {
    private registry: AgentRegistry;

    constructor(registry: AgentRegistry) {
        this.registry = registry;
    }

    /**
     * Select verifiers for a task based on risk level
     */
    async selectVerifiers(
        taskId: string,
        riskLevel: RiskTolerance,
        budget: string,
        excludeAddresses: string[] = []
    ): Promise<VerifierSelection> {
        const prefix = getLogPrefix();

        logger.info(`${prefix} Selecting verifiers for task ${taskId}`);
        logger.info(`${prefix} Risk level: ${riskLevel}`);

        // Determine how many verifiers based on risk
        const count = this.getVerifierCount(riskLevel);

        logger.info(`${prefix} Verifiers needed: ${count}`);

        // Get minimum reputation based on risk
        const minReputation = this.getMinReputation(riskLevel);

        // Query available verifiers
        const availableVerifiers = await this.registry.queryVerifiers(minReputation);

        // Filter out excluded addresses
        const candidates = availableVerifiers.filter(
            v => !excludeAddresses.includes(v.address)
        );

        if (candidates.length < count) {
            logger.warn(`${prefix} Insufficient verifiers: need ${count}, have ${candidates.length}`);

            // Fallback: lower reputation requirement
            if (minReputation > 50) {
                logger.info(`${prefix} Lowering reputation requirement to 50`);
                const fallbackCandidates = await this.registry.queryVerifiers(50);
                candidates.push(...fallbackCandidates.filter(
                    v => !excludeAddresses.includes(v.address) &&
                        !candidates.find(c => c.address === v.address)
                ));
            }
        }

        if (candidates.length < count) {
            throw new Error(`Insufficient verifiers available: need ${count}, have ${candidates.length}`);
        }

        // Select verifiers
        const selected = this.selectBestVerifiers(candidates, count, riskLevel);

        const reasoning = this.generateReasoning(selected, riskLevel, count);

        logger.info(`${prefix} Selected ${selected.length} verifiers:`);
        selected.forEach((v, i) => {
            logger.info(`${prefix}   ${i + 1}. ${v.address} (rep: ${v.reputation})`);
        });

        return {
            count,
            verifiers: selected.map(v => v.address),
            reasoning
        };
    }

    /**
     * Determine number of verifiers based on risk
     */
    private getVerifierCount(riskLevel: RiskTolerance): number {
        switch (riskLevel) {
            case 'low':
                return 1; // Single verifier sufficient
            case 'medium':
                return 2; // 2 verifiers for consensus
            case 'high':
                return 3; // 3 verifiers for strong consensus
        }
    }

    /**
     * Get minimum reputation requirement based on risk
     */
    private getMinReputation(riskLevel: RiskTolerance): number {
        switch (riskLevel) {
            case 'low':
                return 60; // Moderate reputation OK
            case 'medium':
                return 70; // Good reputation required
            case 'high':
                return 80; // High reputation required
        }
    }

    /**
     * Select best verifiers from candidates
     */
    private selectBestVerifiers(
        candidates: RegisteredAgent[],
        count: number,
        riskLevel: RiskTolerance
    ): RegisteredAgent[] {
        // Score each verifier
        const scored = candidates.map(verifier => ({
            verifier,
            score: this.scoreVerifier(verifier, riskLevel)
        }));

        // Sort by score (descending)
        scored.sort((a, b) => b.score - a.score);

        // Select top N, ensuring diversity
        const selected: RegisteredAgent[] = [];
        const selectedOperators = new Set<string>();

        for (const { verifier } of scored) {
            if (selected.length >= count) break;

            // Avoid selecting multiple verifiers from same operator (anti-collusion)
            if (verifier.operator && selectedOperators.has(verifier.operator)) {
                continue;
            }

            selected.push(verifier);

            if (verifier.operator) {
                selectedOperators.add(verifier.operator);
            }
        }

        // If we still need more, relax operator constraint
        if (selected.length < count) {
            for (const { verifier } of scored) {
                if (selected.length >= count) break;
                if (!selected.find(v => v.address === verifier.address)) {
                    selected.push(verifier);
                }
            }
        }

        return selected;
    }

    /**
     * Score a verifier for selection
     */
    private scoreVerifier(verifier: RegisteredAgent, riskLevel: RiskTolerance): number {
        let score = 0;

        // Reputation (0-100 points)
        score += verifier.reputation;

        // Bonus for high-risk tasks requiring high reputation
        if (riskLevel === 'high' && verifier.reputation >= 85) {
            score += 20;
        }

        // Penalty for low fees (might indicate low quality)
        const fee = parseFloat(verifier.minFee);
        if (fee < 0.03) {
            score -= 10;
        }

        // Bonus for verification capability
        if (verifier.capabilities.includes('verification')) {
            score += 10;
        }

        // Bonus for audit capability (high-risk tasks)
        if (riskLevel === 'high' && verifier.capabilities.includes('audit')) {
            score += 15;
        }

        return score;
    }

    /**
     * Generate reasoning for selection
     */
    private generateReasoning(
        selected: RegisteredAgent[],
        riskLevel: RiskTolerance,
        count: number
    ): string[] {
        const reasoning: string[] = [];

        reasoning.push(`Risk level ${riskLevel} requires ${count} verifier${count > 1 ? 's' : ''}`);

        const avgReputation = selected.reduce((sum, v) => sum + v.reputation, 0) / selected.length;
        reasoning.push(`Average verifier reputation: ${avgReputation.toFixed(1)}/100`);

        if (count > 1) {
            reasoning.push(`Consensus mechanism: ${this.getConsensusRule(count)}`);
        }

        // Check for operator diversity
        const operators = new Set(selected.map(v => v.operator).filter(Boolean));
        if (operators.size > 1) {
            reasoning.push(`Verifiers from ${operators.size} different operators (anti-collusion)`);
        }

        return reasoning;
    }

    /**
     * Get consensus rule description
     */
    private getConsensusRule(count: number): string {
        if (count === 2) {
            return '2/2 agreement required';
        } else if (count === 3) {
            return '2/3 majority required';
        }
        return 'N/A';
    }
}
