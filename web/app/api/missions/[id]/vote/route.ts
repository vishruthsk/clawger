import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { MissionStore } from '@core/missions/mission-store';
import { BondManager } from '@core/bonds/bond-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { VerifierConsensus, VerifierSubmission } from '@core/verification/verifier-consensus';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { ECONOMY_CONFIG } from '@config/economy';

// Singletons
const agentAuth = new AgentAuth('./data');
const missionStore = new MissionStore('./data');
const tokenLedger = new TokenLedger('./data');
const bondManager = new BondManager(tokenLedger, './data');
const assignmentHistory = new AssignmentHistoryTracker('./data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, './data');

// In-memory vote storage (in production, persist to database)
const missionVotes = new Map<string, VerifierSubmission[]>();

/**
 * POST /api/missions/:id/vote
 * Submit verifier vote for mission with bond enforcement
 * 
 * Flow:
 * 1. Authenticate verifier agent
 * 2. Require verifier bond staking
 * 3. Record vote
 * 4. Check if quorum reached
 * 5. Auto-trigger settlement if quorum met
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: missionId } = await context.params;

        // ============================================
        // STEP 1: Authenticate agent
        // ============================================
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                {
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED',
                    hint: 'Include Authorization: Bearer <apiKey> header'
                },
                { status: 401 }
            );
        }

        const apiKey = authHeader.substring(7);
        const agent = agentAuth.validate(apiKey);

        if (!agent) {
            return NextResponse.json(
                { error: 'Invalid API key', code: 'UNAUTHORIZED' },
                { status: 401 }
            );
        }

        // ============================================
        // STEP 2: Get mission and validate status
        // ============================================
        const mission = missionStore.get(missionId);

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found', code: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        if (mission.status !== 'verifying') {
            return NextResponse.json(
                {
                    error: `Cannot vote on mission in status '${mission.status}'`,
                    code: 'INVALID_STATE',
                    hint: 'Mission must be in "verifying" status to accept votes'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Validate request body
        // ============================================
        const body = await request.json();

        if (!body.vote || !['APPROVE', 'REJECT'].includes(body.vote)) {
            return NextResponse.json(
                {
                    error: 'Invalid vote',
                    code: 'INVALID_REQUEST',
                    hint: 'Vote must be either "APPROVE" or "REJECT"'
                },
                { status: 400 }
            );
        }

        // Check if verifier already voted
        const existingVotes = missionVotes.get(missionId) || [];
        const alreadyVoted = existingVotes.some(v => v.verifier_id === agent.id);

        if (alreadyVoted) {
            return NextResponse.json(
                {
                    error: 'Already voted',
                    code: 'DUPLICATE_VOTE',
                    hint: 'You have already submitted a vote for this mission'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 4: Stake verifier bond
        // ============================================
        const verifierBondAmount = mission.reward * ECONOMY_CONFIG.BOND.VERIFIER_BOND_MULTIPLIER;

        console.log(`[Vote] Verifier ${agent.id} staking bond: ${verifierBondAmount} $CLAWGER`);

        const bondResult = await bondManager.stakeBond(
            agent.id,
            missionId,
            verifierBondAmount,
            'verifier'
        );

        if (!bondResult.success) {
            return NextResponse.json(
                {
                    error: bondResult.error || 'Failed to stake verifier bond',
                    code: 'INSUFFICIENT_BALANCE',
                    hint: `Verifier bond of ${verifierBondAmount} $CLAWGER required`,
                    required_bond: verifierBondAmount,
                    agent_balance: tokenLedger.getBalance(agent.id)
                },
                { status: 403 }
            );
        }

        // ============================================
        // STEP 5: Record vote
        // ============================================
        const vote: VerifierSubmission = {
            verifier_id: agent.id,
            verdict: body.vote === 'APPROVE' ? 'PASS' : 'FAIL',
            reason: body.feedback || `Verifier ${agent.id} voted ${body.vote}`,
            timestamp: new Date()
        };

        existingVotes.push(vote);
        missionVotes.set(missionId, existingVotes);

        console.log(`[Vote] Vote recorded. Total votes: ${existingVotes.length}`);

        // ============================================
        // STEP 6: Check quorum and trigger settlement
        // ============================================
        const quorumThreshold = ECONOMY_CONFIG.BOND.MIN_VERIFIERS || 3;
        const quorumReached = existingVotes.length >= quorumThreshold;

        let settlementResult = null;

        if (quorumReached) {
            console.log(`[Vote] Quorum reached (${existingVotes.length}/${quorumThreshold}). Auto-triggering settlement...`);

            // Evaluate consensus
            const consensus = VerifierConsensus.evaluate(existingVotes);

            // Trigger settlement
            settlementResult = await settlementEngine.settleMission(
                missionId,
                mission.requester_id,
                mission.assigned_agent?.agent_id || '',
                mission.reward,
                {
                    votes: existingVotes.map(v => ({
                        verifierId: v.verifier_id,
                        vote: v.verdict,
                        feedback: v.reason
                    })),
                    verifiers: existingVotes.map(v => v.verifier_id)
                }
            );

            // Update mission status
            missionStore.update(missionId, {
                status: settlementResult.outcome === 'PASS' ? 'settled' : 'failed',
                settled_at: new Date(),
                failure_reason: settlementResult.outcome === 'FAIL' ? 'Failed verification' : undefined
            });

            // Clear votes after settlement
            missionVotes.delete(missionId);
        }

        // ============================================
        // STEP 7: Return response
        // ============================================
        return NextResponse.json({
            success: true,
            vote: {
                verifier_id: agent.id,
                vote: body.vote,
                timestamp: vote.timestamp.toISOString()
            },
            bond_staked: verifierBondAmount,
            quorum: {
                current_votes: existingVotes.length,
                required_votes: quorumThreshold,
                reached: quorumReached
            },
            settlement: quorumReached ? {
                triggered: true,
                outcome: settlementResult?.outcome,
                distributions: settlementResult?.distributions.length,
                total_distributed: settlementResult?.totalDistributed
            } : {
                triggered: false,
                votes_remaining: quorumThreshold - existingVotes.length
            },
            message: quorumReached
                ? `Vote recorded. Quorum reached! Settlement completed with outcome: ${settlementResult?.outcome}`
                : `Vote recorded. ${quorumThreshold - existingVotes.length} more votes needed for settlement.`
        });

    } catch (error: any) {
        console.error('[Vote] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
