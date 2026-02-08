/**
 * Bidding Engine (Mode B: Competitive)
 * 
 * Manages competitive bidding for high-value missions.
 * Single round bidding with deterministic winner selection.
 */

import { AgentAuth, AgentProfile } from '../registry/agent-auth';
import { Mission, Bid } from './mission-store';
import { AgentNotificationQueue } from '../tasks/agent-notification-queue';

export interface BidScore {
    bid: Bid;
    price_score: number;
    eta_score: number;
    bond_score: number;
    final_score: number;
}

export interface BiddingResult {
    success: boolean;
    winner?: Bid;
    reason?: string;
    scores?: BidScore[];
}

export interface BiddingConfig {
    default_window_seconds: number;      // Default: 60
    weights: {
        price: number;                    // Default: 0.5
        eta: number;                      // Default: 0.3
        bond: number;                     // Default: 0.2
    };
}

const DEFAULT_CONFIG: BiddingConfig = {
    default_window_seconds: 60,
    weights: {
        price: 0.5,
        eta: 0.3,
        bond: 0.2
    }
};

export class BiddingEngine {
    private agentAuth: AgentAuth;
    private notifications: AgentNotificationQueue;
    private config: BiddingConfig;
    private activeBiddings: Map<string, NodeJS.Timeout> = new Map(); // mission_id -> timeout

    constructor(
        agentAuth: AgentAuth,
        notifications: AgentNotificationQueue,
        config?: Partial<BiddingConfig>
    ) {
        this.agentAuth = agentAuth;
        this.notifications = notifications;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Open bidding window for mission
     */
    openBiddingWindow(mission: Mission, onClose: (missionId: string) => void): Date {
        const windowSeconds = mission.bidding_window_seconds || this.config.default_window_seconds;
        const windowEnd = new Date(Date.now() + windowSeconds * 1000);

        console.log(`[BiddingEngine] Opening bidding window for mission ${mission.id} (${windowSeconds}s)`);

        // Set timeout to auto-close window
        const timeout = setTimeout(() => {
            console.log(`[BiddingEngine] Bidding window closed for mission ${mission.id}`);
            this.activeBiddings.delete(mission.id);
            onClose(mission.id);
        }, windowSeconds * 1000);

        this.activeBiddings.set(mission.id, timeout);

        // Notify eligible agents
        this.notifyEligibleAgents(mission);

        return windowEnd;
    }

    /**
     * Close bidding window manually
     */
    closeBiddingWindow(missionId: string): void {
        const timeout = this.activeBiddings.get(missionId);
        if (timeout) {
            clearTimeout(timeout);
            this.activeBiddings.delete(missionId);
            console.log(`[BiddingEngine] Manually closed bidding window for mission ${missionId}`);
        }
    }

    /**
     * Submit bid for mission
     */
    async submitBid(mission: Mission, agentId: string, bidData: {
        price: number;
        eta_minutes: number;
        bond_offered: number;
        message?: string;
    }): Promise<{ success: boolean; reason?: string; bid?: Bid }> {
        // Validation 1: Bidding window must be open
        if (mission.status !== 'bidding_open') {
            return {
                success: false,
                reason: 'Bidding window is not open'
            };
        }

        // Validation 2: Window must not be expired
        if (mission.bidding_window_end && new Date() > mission.bidding_window_end) {
            return {
                success: false,
                reason: 'Bidding window has expired'
            };
        }

        // Validation 3: Agent must exist and be eligible
        const agent = this.agentAuth.getById(agentId);
        if (!agent) {
            return {
                success: false,
                reason: 'Agent not found'
            };
        }

        const eligibility = this.checkEligibility(agent, mission);
        if (!eligibility.eligible) {
            return {
                success: false,
                reason: eligibility.reason
            };
        }

        // Validation 4: Price must be within budget
        if (bidData.price > mission.reward) {
            return {
                success: false,
                reason: `Bid price (${bidData.price}) exceeds mission budget (${mission.reward})`
            };
        }

        // Validation 5: Agent must not have already bid
        const existingBid = mission.bids?.find(b => b.agent_id === agentId);
        if (existingBid) {
            return {
                success: false,
                reason: 'Agent has already submitted a bid'
            };
        }

        // Create bid
        const bid: Bid = {
            id: `bid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            agent_id: agentId,
            agent_name: agent.name,
            price: bidData.price,
            eta_minutes: bidData.eta_minutes,
            bond_offered: bidData.bond_offered,
            message: bidData.message,
            submitted_at: new Date()
        };

        console.log(`[BiddingEngine] Bid submitted by ${agent.name}: $${bidData.price}, ${bidData.eta_minutes}min, bond ${bidData.bond_offered}`);

        return {
            success: true,
            bid
        };
    }

    /**
     * Select winner from bids
     */
    selectWinner(mission: Mission): BiddingResult {
        if (!mission.bids || mission.bids.length === 0) {
            return {
                success: false,
                reason: 'No bids submitted'
            };
        }

        console.log(`[BiddingEngine] Selecting winner from ${mission.bids.length} bids`);

        // Calculate scores for all bids
        const scores = this.calculateBidScores(mission.bids, mission);

        // Check for exact tie (mission should fail)
        if (scores.length > 1 && scores[0].final_score === scores[1].final_score) {
            console.warn(`[BiddingEngine] Exact tie detected, mission should fail`);
            return {
                success: false,
                reason: 'Exact tie between top bids, mission failed',
                scores
            };
        }

        const winner = scores[0];

        console.log(`[BiddingEngine] Winner: ${winner.bid.agent_name} (score: ${winner.final_score.toFixed(3)})`);

        return {
            success: true,
            winner: winner.bid,
            scores
        };
    }

    /**
     * Calculate scores for all bids
     */
    private calculateBidScores(bids: Bid[], mission: Mission): BidScore[] {
        return bids.map(bid => {
            // Price score: lower price = higher score
            // Normalize: (max_price - bid_price) / max_price
            const price_score = (mission.reward - bid.price) / mission.reward;

            // ETA score: faster = higher score
            // Normalize: assume max acceptable ETA is 480 minutes (8 hours)
            const max_eta = 480;
            const eta_score = Math.max(0, (max_eta - bid.eta_minutes) / max_eta);

            // Bond score: higher bond = higher score
            // Normalize: assume max bond is 100
            const max_bond = 100;
            const bond_score = Math.min(bid.bond_offered / max_bond, 1);

            // Calculate final score
            const final_score =
                price_score * this.config.weights.price +
                eta_score * this.config.weights.eta +
                bond_score * this.config.weights.bond;

            return {
                bid,
                price_score,
                eta_score,
                bond_score,
                final_score
            };
        }).sort((a, b) => b.final_score - a.final_score); // Sort descending
    }

    /**
     * Check if agent is eligible to bid
     */
    private checkEligibility(agent: AgentProfile, mission: Mission): {
        eligible: boolean;
        reason?: string;
    } {
        // Check 1: Specialty match
        const hasMatchingSpecialty = mission.specialties?.some(specialty =>
            agent.specialties?.some(agentSpec =>
                agentSpec.toLowerCase().includes(specialty.toLowerCase()) ||
                specialty.toLowerCase().includes(agentSpec.toLowerCase())
            )
        );

        if (!hasMatchingSpecialty) {
            return {
                eligible: false,
                reason: 'Agent does not have required specialty'
            };
        }

        // Check 2: Agent must be available
        if (!agent.available) {
            return {
                eligible: false,
                reason: 'Agent is not available'
            };
        }

        // Check 3: Agent must not be suspended
        if (agent.status === 'suspended') {
            return {
                eligible: false,
                reason: 'Agent is suspended'
            };
        }

        return { eligible: true };
    }

    /**
     * Notify eligible agents about bidding opportunity
     */
    private notifyEligibleAgents(mission: Mission): void {
        const allAgents = this.agentAuth.listAgents();

        const eligibleAgents = allAgents.filter(agent => {
            const eligibility = this.checkEligibility(agent, mission);
            return eligibility.eligible;
        });

        console.log(`[BiddingEngine] Notifying ${eligibleAgents.length} eligible agents`);

        for (const agent of eligibleAgents) {
            this.notifications.createTask(
                agent.id,
                'mission_available',
                {
                    mission_id: mission.id,
                    title: mission.title,
                    reward: mission.reward,
                    bidding_window_end: mission.bidding_window_end?.toISOString(),
                    action: 'Submit bid at POST /api/missions/:id/bid'
                },
                'high'
            );
        }
    }

    /**
     * Get bidding statistics
     */
    getStats(): {
        active_biddings: number;
        missions: string[];
    } {
        return {
            active_biddings: this.activeBiddings.size,
            missions: Array.from(this.activeBiddings.keys())
        };
    }
}
