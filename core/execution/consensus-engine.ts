/**
 * Consensus Engine
 * Manages multi-verifier voting and consensus determination
 */

import {
    VerificationVote,
    VerificationResult,
    TaskWithVerification
} from '../types';
import { AgentRegistry } from '../registry/agent-registry';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export class ConsensusEngine {
    private registry: AgentRegistry;
    private verifications: Map<string, VerificationResult> = new Map();

    constructor(registry: AgentRegistry) {
        this.registry = registry;
    }

    /**
     * Initialize verification for a task
     */
    initializeVerification(taskId: string, verifiers: string[]): void {
        const prefix = getLogPrefix();

        logger.info(`${prefix} Initializing verification for task ${taskId}`);
        logger.info(`${prefix} Verifiers: ${verifiers.length}`);

        this.verifications.set(taskId, {
            taskId,
            verifiers,
            votes: [],
            consensus: null,
            outliers: [],
            finalized: false
        });
    }

    /**
     * Submit a verification vote
     */
    submitVote(
        taskId: string,
        verifier: string,
        vote: boolean,
        evidence?: string
    ): void {
        const prefix = getLogPrefix();

        const verification = this.verifications.get(taskId);
        if (!verification) {
            throw new Error(`Verification not initialized for task ${taskId}`);
        }

        if (verification.finalized) {
            throw new Error(`Verification already finalized for task ${taskId}`);
        }

        if (!verification.verifiers.includes(verifier)) {
            throw new Error(`Verifier ${verifier} not assigned to task ${taskId}`);
        }

        // Check if already voted
        if (verification.votes.find(v => v.verifier === verifier)) {
            throw new Error(`Verifier ${verifier} already voted on task ${taskId}`);
        }

        // Add vote
        const voteRecord: VerificationVote = {
            verifier,
            vote,
            timestamp: new Date(),
            evidence
        };

        verification.votes.push(voteRecord);

        logger.info(`${prefix} Vote submitted: ${verifier} → ${vote ? 'PASS' : 'FAIL'}`);
        logger.info(`${prefix} Votes: ${verification.votes.length}/${verification.verifiers.length}`);

        // Check if all votes are in
        if (verification.votes.length === verification.verifiers.length) {
            this.finalizeConsensus(taskId);
        }
    }

    /**
     * Finalize consensus once all votes are in
     */
    private finalizeConsensus(taskId: string): void {
        const prefix = getLogPrefix();

        const verification = this.verifications.get(taskId)!;

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} FINALIZING CONSENSUS: ${taskId}`);
        logger.info(`${prefix} ========================================`);

        const passVotes = verification.votes.filter(v => v.vote === true).length;
        const failVotes = verification.votes.filter(v => v.vote === false).length;

        logger.info(`${prefix} Pass votes: ${passVotes}`);
        logger.info(`${prefix} Fail votes: ${failVotes}`);

        // Determine consensus based on verifier count
        const totalVerifiers = verification.verifiers.length;
        let consensus: boolean;

        if (totalVerifiers === 1) {
            // Single verifier: binary outcome
            consensus = verification.votes[0].vote;
            logger.info(`${prefix} Single verifier: ${consensus ? 'PASS' : 'FAIL'}`);

        } else if (totalVerifiers === 2) {
            // 2 verifiers: must agree (2/2)
            consensus = passVotes === 2;
            logger.info(`${prefix} 2 verifiers: ${consensus ? 'PASS (2/2)' : 'FAIL (disagreement)'}`);

            // If disagreement, both are outliers
            if (passVotes === 1 && failVotes === 1) {
                verification.outliers = verification.verifiers;
                logger.warn(`${prefix} DISAGREEMENT: Both verifiers flagged as outliers`);
            }

        } else if (totalVerifiers === 3) {
            // 3 verifiers: majority (2/3)
            consensus = passVotes >= 2;
            logger.info(`${prefix} 3 verifiers: ${consensus ? 'PASS' : 'FAIL'} (${passVotes}/3)`);

            // Identify outlier (minority vote)
            if (passVotes === 2 && failVotes === 1) {
                // 2 PASS, 1 FAIL → FAIL voter is outlier
                const outlier = verification.votes.find(v => v.vote === false)!;
                verification.outliers = [outlier.verifier];
                logger.warn(`${prefix} OUTLIER: ${outlier.verifier} (voted FAIL, consensus PASS)`);

            } else if (passVotes === 1 && failVotes === 2) {
                // 1 PASS, 2 FAIL → PASS voter is outlier
                const outlier = verification.votes.find(v => v.vote === true)!;
                verification.outliers = [outlier.verifier];
                logger.warn(`${prefix} OUTLIER: ${outlier.verifier} (voted PASS, consensus FAIL)`);
            }
        } else {
            throw new Error(`Unsupported verifier count: ${totalVerifiers}`);
        }

        verification.consensus = consensus;
        verification.finalized = true;

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} CONSENSUS: ${consensus ? 'PASS' : 'FAIL'}`);
        logger.info(`${prefix} Outliers: ${verification.outliers.length}`);
        logger.info(`${prefix} ========================================`);
    }

    /**
     * Get verification result
     */
    getVerification(taskId: string): VerificationResult | null {
        return this.verifications.get(taskId) || null;
    }

    /**
     * Check if verification is complete
     */
    isFinalized(taskId: string): boolean {
        const verification = this.verifications.get(taskId);
        return verification?.finalized || false;
    }

    /**
     * Get consensus result
     */
    getConsensus(taskId: string): boolean | null {
        const verification = this.verifications.get(taskId);
        return verification?.consensus ?? null;
    }

    /**
     * Get outlier verifiers
     */
    getOutliers(taskId: string): string[] {
        const verification = this.verifications.get(taskId);
        return verification?.outliers || [];
    }

    /**
     * Process verification outcome
     * Updates reputations and returns slashing info
     */
    async processOutcome(taskId: string): Promise<{
        consensus: boolean;
        outliers: string[];
        reputationUpdates: Array<{ agent: string; oldRep: number; newRep: number }>;
    }> {
        const prefix = getLogPrefix();

        const verification = this.verifications.get(taskId);
        if (!verification || !verification.finalized) {
            throw new Error(`Verification not finalized for task ${taskId}`);
        }

        const reputationUpdates: Array<{ agent: string; oldRep: number; newRep: number }> = [];

        // Update reputations
        for (const vote of verification.votes) {
            const agent = await this.registry.getAgent(vote.verifier);
            const oldRep = agent.reputation;
            let newRep = oldRep;

            const isOutlier = verification.outliers.includes(vote.verifier);

            if (isOutlier) {
                // Outlier: reduce reputation
                newRep = Math.max(0, oldRep - 10);
                logger.warn(`${prefix} Outlier penalty: ${vote.verifier} ${oldRep} → ${newRep}`);
            } else {
                // Correct vote: increase reputation slightly
                newRep = Math.min(100, oldRep + 2);
                logger.info(`${prefix} Correct vote bonus: ${vote.verifier} ${oldRep} → ${newRep}`);
            }

            await this.registry.updateReputation(vote.verifier, newRep);

            reputationUpdates.push({
                agent: vote.verifier,
                oldRep,
                newRep
            });
        }

        return {
            consensus: verification.consensus!,
            outliers: verification.outliers,
            reputationUpdates
        };
    }

    /**
     * Get voting summary
     */
    getVotingSummary(taskId: string): string {
        const verification = this.verifications.get(taskId);
        if (!verification) {
            return 'No verification found';
        }

        const passVotes = verification.votes.filter(v => v.vote).length;
        const failVotes = verification.votes.filter(v => !v.vote).length;
        const total = verification.verifiers.length;

        let summary = `Votes: ${passVotes} PASS, ${failVotes} FAIL (${verification.votes.length}/${total})`;

        if (verification.finalized) {
            summary += ` | Consensus: ${verification.consensus ? 'PASS' : 'FAIL'}`;
            if (verification.outliers.length > 0) {
                summary += ` | Outliers: ${verification.outliers.length}`;
            }
        } else {
            summary += ' | Pending';
        }

        return summary;
    }
}
