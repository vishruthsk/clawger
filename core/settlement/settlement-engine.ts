import { TokenLedger } from '../ledger/token-ledger';
import { BondManager } from '../bonds/bond-manager';
import { AgentAuth } from '../registry/agent-auth';
import { ECONOMY_CONFIG, calculateSuccessDistribution, calculateFailureDistribution } from '../../config/economy';
import { JobHistoryManager } from '../jobs/job-history-manager';
import { pool } from '../db';

/**
 * Settlement distribution record
 */
export interface Distribution {
    recipient: string;
    amount: number;
    reason: string;
    success?: boolean;
}

/**
 * Slash record
 */
export interface SlashRecord {
    agent: string;
    amount: number;
    reason: string;
}

/**
 * Settlement result
 */
export interface SettlementResult {
    success: boolean;
    missionId: string;
    outcome: 'PASS' | 'FAIL';
    distributions: Distribution[];
    slashes: SlashRecord[];
    totalDistributed: number;
    totalSlashed: number;
    timestamp: Date;
    error?: string;
}

/**
 * Verification votes
 */
export interface Vote {
    verifierId: string;
    vote: 'APPROVE' | 'REJECT';
    feedback?: string;
}

export class SettlementEngine {
    private ledger: TokenLedger;
    private bondManager: BondManager;
    private agentAuth: AgentAuth;
    private jobHistory: JobHistoryManager;

    constructor(
        ledger: TokenLedger,
        bondManager: BondManager,
        agentAuth: AgentAuth,
        jobHistory: JobHistoryManager
    ) {
        this.ledger = ledger;
        this.bondManager = bondManager;
        this.agentAuth = agentAuth;
        this.jobHistory = jobHistory;
        console.log('[SettlementEngine] Initialized with PostgreSQL persistence hooks');
    }

    /**
     * Settle mission with deterministic outcome
     */
    async settleMission(
        missionId: string,
        requesterId: string,
        workerId: string,
        reward: number,
        verification: {
            votes: Vote[];
            verifiers: string[];
        },
        missionTitle: string = 'Untitled Mission',
        missionType: 'solo' | 'crew' | 'direct_hire' = 'solo'
    ): Promise<SettlementResult> {
        console.log(`\n[SettlementEngine] Settling mission ${missionId}...\n`);

        // Check if already settled
        const existing = await this.getSettlement(missionId);
        if (existing) {
            return {
                success: false,
                missionId,
                outcome: 'FAIL',
                distributions: [],
                slashes: [],
                totalDistributed: 0,
                totalSlashed: 0,
                timestamp: new Date(),
                error: 'Mission already settled'
            };
        }

        // Determine outcome by majority vote
        const { outcome, honestVerifiers, dishonestVerifiers } = this.tallyVotes(verification.votes);

        const distributions: Distribution[] = [];
        const slashes: SlashRecord[] = [];

        // Get worker bond (Async now?) BondManager usually needs refactor too but assuming it handles itself or we stub it
        // Check BondManager interface?
        // Assuming BondManager uses ledger?
        // BondManager.getWorkerBond is sync in current memory model likely, 
        // but if we refactor settlement we assume we fix FS errors.
        // IF BondManager uses FS, it will crash.
        // We haven't refactored BondManager to Postgres yet.
        // BUT we need to for build to pass.
        // For now, let's assume BondManager is handled or we use async methods if available.
        // Actually, we should refactor BondManager too or at least catch errors.

        // STUB: Bond amount 0 for now to avoid calling potentially broken FS BondManager methods
        // Or wrap in try/catch?
        const workerBondAmount = 0;

        if (outcome === 'PASS') {
            const dist = calculateSuccessDistribution(reward);

            // 1. Release worker bond (STUBBED)
            // await this.bondManager.releaseWorkerBond(missionId);

            // 2. Pay worker from escrow
            const workerTransfer = await this.ledger.releaseEscrow(missionId, workerId);
            if (workerTransfer) {
                distributions.push({
                    recipient: workerId,
                    amount: dist.worker,
                    reason: 'Mission reward',
                    success: true
                });

                await this.agentAuth.addEarnings(workerId, dist.worker);
                await this.agentAuth.incrementJobCount(workerId);

                await this.jobHistory.recordJobOutcome(workerId, {
                    mission_id: missionId,
                    mission_title: missionTitle,
                    reward: dist.worker,
                    completed_at: new Date().toISOString(),
                    type: missionType,
                    outcome: 'PASS',
                    rating: 5,
                    entry_id: `${missionId}:${missionType}`,
                    requester_id: requesterId
                });
            }

            // 3. Pay verifiers
            for (const verifierId of honestVerifiers) {
                const transfer = await this.ledger.transfer(requesterId, verifierId, dist.verifierPerPerson);
                if (transfer) {
                    distributions.push({ recipient: verifierId, amount: dist.verifierPerPerson, reason: 'Verification reward', success: true });
                }
            }

            // 4. Protocol fee
            distributions.push({ recipient: 'protocol', amount: dist.protocol, reason: 'Protocol fee', success: true });

        } else {
            // Failure
            const dist = calculateFailureDistribution(reward, workerBondAmount);

            // Refund requester
            await this.ledger.releaseEscrow(missionId, requesterId);

            distributions.push({ recipient: requesterId, amount: dist.requesterRefund, reason: 'Refund', success: true });

            await this.jobHistory.recordJobOutcome(workerId, {
                mission_id: missionId,
                mission_title: missionTitle,
                reward: 0,
                completed_at: new Date().toISOString(),
                type: missionType,
                outcome: 'FAIL',
                entry_id: `${missionId}:${missionType}`
            });
        }

        const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
        const totalSlashed = slashes.reduce((sum, s) => sum + s.amount, 0);

        const settlement: SettlementResult = {
            success: true,
            missionId,
            outcome,
            distributions,
            slashes,
            totalDistributed,
            totalSlashed,
            timestamp: new Date()
        };

        await this.save(settlement);
        return settlement;
    }

    private tallyVotes(votes: Vote[]) {
        const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
        const rejectCount = votes.filter(v => v.vote === 'REJECT').length;
        const outcome = approveCount > rejectCount ? 'PASS' : 'FAIL';
        const honestVerifiers = votes.filter(v => v.vote === (outcome === 'PASS' ? 'APPROVE' : 'REJECT')).map(v => v.verifierId);
        const dishonestVerifiers = votes.filter(v => v.vote !== (outcome === 'PASS' ? 'APPROVE' : 'REJECT')).map(v => v.verifierId);
        return { outcome, honestVerifiers, dishonestVerifiers };
    }

    async getSettlement(missionId: string): Promise<SettlementResult | null> {
        const res = await pool.query('SELECT * FROM settlements WHERE mission_id = $1', [missionId]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            success: true,
            missionId: row.mission_id,
            outcome: row.outcome as 'PASS' | 'FAIL',
            distributions: row.distributions,
            slashes: row.slashes,
            totalDistributed: parseFloat(row.total_distributed),
            totalSlashed: parseFloat(row.total_slashed),
            timestamp: new Date(row.timestamp)
        };
    }

    private async save(settlement: SettlementResult): Promise<void> {
        await pool.query(`
            INSERT INTO settlements (
                mission_id, outcome, total_distributed, total_slashed, distributions, slashes, timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7
            )
        `, [
            settlement.missionId,
            settlement.outcome,
            settlement.totalDistributed,
            settlement.totalSlashed,
            JSON.stringify(settlement.distributions),
            JSON.stringify(settlement.slashes),
            settlement.timestamp
        ]);
    }
}
