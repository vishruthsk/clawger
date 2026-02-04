/**
 * Verifier Consensus & Dispute Resolution
 * Deterministic majority rule consensus engine
 */

import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type Verdict = 'PASS' | 'FAIL';
export type ConsensusStatus = 'CONSENSUS' | 'DISPUTE_RESOLVED' | 'DISPUTE_UNRESOLVED';

export interface VerifierSubmission {
    verifier_id: string;
    verdict: Verdict;
    reason: string;
    timestamp: Date;
}

export interface ConsensusResult {
    final_verdict: Verdict;
    status: ConsensusStatus;
    majority_verdict: Verdict | null;
    pass_votes: number;
    fail_votes: number;
    total_votes: number;
    dishonest_verifiers: string[]; // Minority voters
    annotated_reason: string;
}

export class VerifierConsensus {

    /**
     * Evaluate verifier submissions to reach a consensus
     */
    static evaluate(submissions: VerifierSubmission[]): ConsensusResult {
        const prefix = getLogPrefix();

        if (submissions.length === 0) {
            throw new Error("No verifier submissions provided");
        }

        if (submissions.length > 3) {
            logger.warn(`${prefix} Consensus received ${submissions.length} submissions, expected max 3. Proceeding with all.`);
        }

        let passVotes = 0;
        let failVotes = 0;

        submissions.forEach(s => {
            if (s.verdict === 'PASS') passVotes++;
            else failVotes++;
        });

        const totalVotes = submissions.length;
        let finalVerdict: Verdict = 'FAIL'; // Default to safety
        let status: ConsensusStatus = 'DISPUTE_UNRESOLVED';
        let majorityVerdict: Verdict | null = null;
        let dishonestVerifiers: string[] = [];
        let reason = "";

        // Unanimous
        if (passVotes === totalVotes) {
            finalVerdict = 'PASS';
            status = 'CONSENSUS';
            majorityVerdict = 'PASS';
            reason = "Unanimous PASS";
        } else if (failVotes === totalVotes) {
            finalVerdict = 'FAIL';
            status = 'CONSENSUS';
            majorityVerdict = 'FAIL';
            reason = "Unanimous FAIL";
        }
        // Split Vote
        else if (passVotes > failVotes) {
            finalVerdict = 'PASS';
            status = 'DISPUTE_RESOLVED';
            majorityVerdict = 'PASS';
            reason = `Majority PASS (${passVotes}/${totalVotes})`;
            dishonestVerifiers = submissions.filter(s => s.verdict === 'FAIL').map(s => s.verifier_id);
        } else if (failVotes > passVotes) {
            finalVerdict = 'FAIL';
            status = 'DISPUTE_RESOLVED';
            majorityVerdict = 'FAIL';
            reason = `Majority FAIL (${failVotes}/${totalVotes})`;
            dishonestVerifiers = submissions.filter(s => s.verdict === 'PASS').map(s => s.verifier_id);
        }
        // Tie
        else {
            finalVerdict = 'FAIL'; // Safety first
            status = 'DISPUTE_UNRESOLVED';
            majorityVerdict = null; // No majority
            reason = `Tie Vote (${passVotes}-${failVotes}) -> Defaults to FAIL`;
            // In a tie, no verifiers are marked dishonest as there is no majority truth.
            dishonestVerifiers = [];
        }

        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} CONSENSUS REACHED`);
        logger.info(`${prefix} ========================================`);
        logger.info(`${prefix} Verdict: ${finalVerdict}`);
        logger.info(`${prefix} Status: ${status}`);
        logger.info(`${prefix} Votes: PASS=${passVotes}, FAIL=${failVotes}`);
        if (dishonestVerifiers.length > 0) {
            logger.info(`${prefix} Minority (Dishonest): ${dishonestVerifiers.join(', ')}`);
        }
        logger.info(`${prefix} Reason: ${reason}`);
        logger.info(`${prefix} ========================================\n`);

        return {
            final_verdict: finalVerdict,
            status: status,
            majority_verdict: majorityVerdict,
            pass_votes: passVotes,
            fail_votes: failVotes,
            total_votes: totalVotes,
            dishonest_verifiers: dishonestVerifiers,
            annotated_reason: reason
        };
    }
}
