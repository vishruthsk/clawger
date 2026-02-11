import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { MissionStore } from '@core/missions/mission-store';
import { BondManager } from '@core/bonds/bond-manager';
import { TokenLedger } from '@core/ledger/token-ledger';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';

// Singletons
const agentAuth = new AgentAuth('../data');
const missionStore = new MissionStore('../data');
const tokenLedger = new TokenLedger('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const assignmentHistory = new AssignmentHistoryTracker('../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, '../data');

/**
 * POST /api/missions/:id/verify
 * Manual settlement trigger after verification votes
 * 
 * This endpoint is normally called automatically after quorum is reached,
 * but can be triggered manually if needed.
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: missionId } = await context.params;

        // ============================================
        // STEP 1: Get mission and validate status
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
                    error: `Cannot settle mission in status '${mission.status}'`,
                    code: 'INVALID_STATE',
                    hint: 'Mission must be in "verifying" status'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 2: Check if mission has verification data
        // ============================================
        if (!mission.verification) {
            return NextResponse.json(
                {
                    error: 'No verification data found',
                    code: 'MISSING_VERIFICATION',
                    hint: 'Mission must have verification votes before settlement'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 3: Trigger settlement
        // ============================================
        console.log(`[Verify] Manually triggering settlement for mission ${missionId}`);

        const settlementResult = await settlementEngine.settleMission(
            missionId,
            mission.requester_id,
            mission.assigned_agent?.agent_id || '',
            mission.reward,
            {
                votes: [{
                    verifierId: mission.verification.verifier_id,
                    vote: mission.verification.approved ? 'APPROVE' : 'REJECT',
                    feedback: mission.verification.feedback
                }],
                verifiers: [mission.verification.verifier_id]
            }
        );

        if (!settlementResult.success) {
            return NextResponse.json(
                {
                    error: settlementResult.error || 'Settlement failed',
                    code: 'SETTLEMENT_ERROR'
                },
                { status: 400 }
            );
        }

        // ============================================
        // STEP 4: Update mission status
        // ============================================
        missionStore.update(missionId, {
            status: settlementResult.outcome === 'PASS' ? 'settled' : 'failed',
            settled_at: new Date(),
            failure_reason: settlementResult.outcome === 'FAIL' ? 'Failed verification' : undefined
        });

        // ============================================
        // STEP 5: Return settlement details
        // ============================================
        return NextResponse.json({
            success: true,
            mission_id: missionId,
            outcome: settlementResult.outcome,
            settlement: {
                total_distributed: settlementResult.totalDistributed,
                total_slashed: settlementResult.totalSlashed,
                distributions: settlementResult.distributions,
                slashes: settlementResult.slashes
            },
            updated_mission: missionStore.get(missionId),
            message: `Settlement completed. Outcome: ${settlementResult.outcome}`
        });

    } catch (error: any) {
        console.error('[Verify] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
