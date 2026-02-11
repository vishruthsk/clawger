import { TokenLedger } from '../ledger/token-ledger';
import { BondManager } from '../bonds/bond-manager';
import { AgentAuth } from '../registry/agent-auth';
import { ECONOMY_CONFIG, calculateSuccessDistribution, calculateFailureDistribution } from '../../config/economy';
import { JobHistoryManager } from '../jobs/job-history-manager';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * SettlementEngine - Deterministic settlement with escrow, bonds, and rewards
 * 
 * Responsibilities:
 * - Calculate distributions based on outcome (PASS/FAIL)
 * - Execute atomic fund transfers
 * - Slash bonds on failure
 * - Distribute verifier rewards
 * - Apply protocol fees
 * - Ensure balance conservation (no funds created/lost)
 */
export class SettlementEngine {
    private ledger: TokenLedger;
    private bondManager: BondManager;
    private agentAuth: AgentAuth;
    private dataDir: string;
    private settlementsFile: string;
    private settlements: Map<string, SettlementResult>;
    private jobHistory: JobHistoryManager;

    constructor(
        ledger: TokenLedger,
        bondManager: BondManager,
        agentAuth: AgentAuth,
        jobHistory: JobHistoryManager,
        dataDir: string = './data'
    ) {
        this.ledger = ledger;
        this.bondManager = bondManager;
        this.agentAuth = agentAuth;
        this.jobHistory = jobHistory;
        this.dataDir = dataDir;
        this.settlementsFile = path.join(dataDir, 'settlements.json');
        this.settlements = new Map();
        this.load();
    }

    /**
     * Load settlement records from disk
     */
    private load(): void {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        if (fs.existsSync(this.settlementsFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.settlementsFile, 'utf-8'));

                if (data.settlements) {
                    for (const [missionId, settlement] of Object.entries(data.settlements)) {
                        this.settlements.set(missionId, {
                            ...(settlement as any),
                            timestamp: new Date((settlement as any).timestamp)
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to load settlements:', error);
            }
        }
    }

    /**
     * Save settlement records to disk
     */
    private save(): void {
        const data = {
            settlements: Object.fromEntries(
                Array.from(this.settlements.entries()).map(([id, settlement]) => [
                    id,
                    {
                        ...settlement,
                        timestamp: settlement.timestamp.toISOString()
                    }
                ])
            )
        };

        fs.writeFileSync(this.settlementsFile, JSON.stringify(data, null, 2));
    }

    /**
     * Settle mission with deterministic outcome
     * 
     * @param missionId Mission to settle
     * @param requesterId Requester who posted the mission
     * @param workerId Worker who completed/failed the mission
     * @param reward Mission reward amount
     * @param verification Verification data with votes
     * @returns Settlement result with all distributions and slashes
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
        if (this.settlements.has(missionId)) {
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

        console.log(`  Outcome: ${outcome}`);
        console.log(`  Honest verifiers: ${honestVerifiers.join(', ')}`);
        if (dishonestVerifiers.length > 0) {
            console.log(`  Dishonest verifiers: ${dishonestVerifiers.join(', ')}`);
        }

        const distributions: Distribution[] = [];
        const slashes: SlashRecord[] = [];

        // Get worker bond
        const workerBond = this.bondManager.getWorkerBond(missionId);
        const workerBondAmount = workerBond?.amount || 0;

        if (outcome === 'PASS') {
            // Success: Pay worker + verifiers + protocol fee
            const dist = calculateSuccessDistribution(reward);

            // 1. Release worker bond
            if (workerBond) {
                const released = await this.bondManager.releaseWorkerBond(missionId);
                if (released.success) {
                    distributions.push({
                        recipient: workerId,
                        amount: workerBondAmount,
                        reason: 'Worker bond returned',
                        success: true
                    });
                }
            }

            // 2. Pay worker from escrow
            const workerTransfer = this.ledger.releaseEscrow(missionId, workerId);
            if (workerTransfer) {
                distributions.push({
                    recipient: workerId,
                    amount: dist.worker,
                    reason: 'Mission reward',
                    success: true
                });

                // Track earnings for agent profile
                this.agentAuth.addEarnings(workerId, dist.worker);
                this.agentAuth.incrementJobCount(workerId);

                // Record PASS in history
                this.jobHistory.recordJobOutcome(workerId, {
                    mission_id: missionId,
                    mission_title: missionTitle,
                    reward: dist.worker,
                    completed_at: new Date().toISOString(),
                    type: missionType,
                    outcome: 'PASS',
                    rating: 5, // Default rating, will be updated by rating system if generic
                    entry_id: `${missionId}:${missionType}`, // Explicit entry ID for idempotency
                    requester_id: requesterId // Track requester for anti-farming
                });
            }

            // 3. Pay verifiers (split among honest verifiers)
            for (const verifierId of honestVerifiers) {
                const transfer = this.ledger.transfer(
                    requesterId, // From requester's account
                    verifierId,
                    dist.verifierPerPerson
                );

                if (transfer) {
                    distributions.push({
                        recipient: verifierId,
                        amount: dist.verifierPerPerson,
                        reason: 'Verification reward',
                        success: true
                    });
                }

                // Release verifier bond
                const bond = this.bondManager.getVerifierBond(missionId, verifierId);
                if (bond) {
                    // This will be handled by settleVerifierBonds below
                }
            }

            // 4. Protocol fee (keep in requester's account as it was part of escrow)
            distributions.push({
                recipient: 'protocol',
                amount: dist.protocol,
                reason: 'Protocol fee',
                success: true
            });

            // 5. Settle verifier bonds
            await this.bondManager.settleVerifierBonds(
                missionId,
                honestVerifiers,
                dishonestVerifiers
            );

        } else {
            // Failure: Refund requester + slash worker + pay verifiers
            const dist = calculateFailureDistribution(reward, workerBondAmount);

            // 1. Slash worker bond
            if (workerBond) {
                const slashed = await this.bondManager.slashWorkerBond(
                    missionId,
                    'Mission failed verification',
                    ECONOMY_CONFIG.BOND.SLASH_RATES.FAILED_VERIFICATION
                );

                if (slashed.success && slashed.slashedAmount) {
                    slashes.push({
                        agent: workerId,
                        amount: slashed.slashedAmount,
                        reason: 'Mission failed verification'
                    });
                }
            }

            // 2. Refund requester (release escrow back to requester)
            const refunded = this.ledger.releaseEscrow(missionId, requesterId);
            if (refunded) {
                distributions.push({
                    recipient: requesterId,
                    amount: dist.requesterRefund,
                    reason: 'Mission failed - reward refunded',
                    success: true
                });
            }

            // 3. Record failure in job history
            // 3. Record failure in job history
            this.jobHistory.recordJobOutcome(workerId, {
                mission_id: missionId,
                mission_title: missionTitle,
                reward: 0,
                completed_at: new Date().toISOString(),
                type: missionType,
                outcome: 'FAIL',
                entry_id: `${missionId}:${missionType}`
            });

            // 4. Pay verifiers from slashed funds
            for (const verifierId of honestVerifiers) {
                const transfer = this.ledger.transfer(
                    requesterId, // From protocol treasury (represented as requester for now)
                    verifierId,
                    dist.verifierPerPerson
                );

                if (transfer) {
                    distributions.push({
                        recipient: verifierId,
                        amount: dist.verifierPerPerson,
                        reason: 'Verification reward (failed mission)',
                        success: true
                    });
                }
            }

            // 4. Protocol receives portion of slashed funds
            distributions.push({
                recipient: 'protocol',
                amount: dist.protocol,
                reason: 'Slashed bond - protocol share',
                success: true
            });

            // 5. Settle verifier bonds
            await this.bondManager.settleVerifierBonds(
                missionId,
                honestVerifiers,
                dishonestVerifiers
            );
        }

        // Calculate totals
        const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
        const totalSlashed = slashes.reduce((sum, s) => sum + s.amount, 0);

        // Create settlement record
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

        this.settlements.set(missionId, settlement);
        this.save();

        // Log settlement details
        console.log(`\n  Distributions:`);
        for (const dist of distributions) {
            console.log(`    ${dist.recipient}: +${dist.amount} $CLAWGER (${dist.reason})`);
        }

        if (slashes.length > 0) {
            console.log(`\n  Slashes:`);
            for (const slash of slashes) {
                console.log(`    ${slash.agent}: -${slash.amount} $CLAWGER (${slash.reason})`);
            }
        }

        console.log(`\n  Total distributed: ${totalDistributed} $CLAWGER`);
        console.log(`  Total slashed: ${totalSlashed} $CLAWGER`);
        console.log(`\n✅ Settlement complete\n`);

        return settlement;
    }

    /**
     * Tally votes to determine outcome and honest/dishonest verifiers
     */
    private tallyVotes(votes: Vote[]): {
        outcome: 'PASS' | 'FAIL';
        honestVerifiers: string[];
        dishonestVerifiers: string[];
    } {
        const approveCount = votes.filter(v => v.vote === 'APPROVE').length;
        const rejectCount = votes.filter(v => v.vote === 'REJECT').length;

        // Majority determines outcome
        const outcome = approveCount > rejectCount ? 'PASS' : 'FAIL';

        // Honest verifiers voted with majority
        const honestVerifiers = votes
            .filter(v => v.vote === (outcome === 'PASS' ? 'APPROVE' : 'REJECT'))
            .map(v => v.verifierId);

        // Dishonest verifiers voted against majority
        const dishonestVerifiers = votes
            .filter(v => v.vote !== (outcome === 'PASS' ? 'APPROVE' : 'REJECT'))
            .map(v => v.verifierId);

        return {
            outcome,
            honestVerifiers,
            dishonestVerifiers
        };
    }

    /**
     * Get settlement for a mission
     */
    getSettlement(missionId: string): SettlementResult | null {
        return this.settlements.get(missionId) || null;
    }

    /**
     * Get all settlements
     */
    getAllSettlements(): SettlementResult[] {
        return Array.from(this.settlements.values());
    }

    /**
     * Get settlement stats
     */
    getStats(): {
        totalSettlements: number;
        successfulSettlements: number;
        failedSettlements: number;
        totalDistributed: number;
        totalSlashed: number;
    } {
        const settlements = this.getAllSettlements();

        return {
            totalSettlements: settlements.length,
            successfulSettlements: settlements.filter(s => s.outcome === 'PASS').length,
            failedSettlements: settlements.filter(s => s.outcome === 'FAIL').length,
            totalDistributed: settlements.reduce((sum, s) => sum + s.totalDistributed, 0),
            totalSlashed: settlements.reduce((sum, s) => sum + s.totalSlashed, 0)
        };
    }
}
