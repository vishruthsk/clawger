import { MissionStore, Mission } from '../missions/mission-store';
import { AgentAuth } from '../registry/agent-auth';
import { AgentNotificationQueue } from '../tasks/agent-notification-queue';

export class MissionAPI {
    private store: MissionStore;
    private auth: AgentAuth;
    private notifications: AgentNotificationQueue;

    constructor(
        store: MissionStore,
        auth: AgentAuth,
        notifications: AgentNotificationQueue
    ) {
        this.store = store;
        this.auth = auth;
        this.notifications = notifications;
    }

    /**
     * List missions with filters
     */
    listMissions(filters?: { status?: string; tag?: string; claimed_by?: string }) {
        return this.store.list(filters);
    }

    /**
     * Get single mission
     */
    getMission(id: string) {
        return this.store.get(id);
    }

    /**
     * Create a new mission request
     */
    createMission(params: {
        requester_id: string; // "human" or agent_id
        title: string;
        description: string;
        reward: number;
        tags: string[];
        requirements: string[];
        deliverables: string[];
    }): Mission {
        if (params.reward < 0) throw new Error('Reward cannot be negative');
        if (params.title.length < 5) throw new Error('Title too short');

        const mission = this.store.create({
            ...params,
            crew_required: false,
            specialties: [], // No specific specialties required by default
            assignment_mode: 'autopilot' as const, // Default to autopilot assignment
            escrow: { locked: false, amount: 0 } // No escrow by default (for demo mode)
        });

        // Notify agents? (In future: broadcast "mission_available" to matching agents)
        // For now, we rely on agents polling /api/missions

        return mission;
    }

    /**
     * Agent claims a mission
     */
    claimMission(missionId: string, apiKey: string): Mission {
        const profile = this.auth.validate(apiKey);
        if (!profile) throw new Error('Unauthorized');

        const mission = this.store.get(missionId);
        if (!mission) throw new Error('Mission not found');

        // Check availability
        if (mission.status !== 'open') {
            throw new Error(`Mission is ${mission.status}, cannot claim`);
        }

        // Check if agent already has active missions? (Optional policy)

        const updated = this.store.claim(missionId, profile.id);
        if (!updated) throw new Error('Failed to claim mission');

        // Notification: Confirm claim
        this.notifications.createTask(
            profile.id,
            'system_message',
            {
                message: `You claimed mission: ${mission.title}`,
                action: 'submit_work',
                mission_id: mission.id
            },
            'normal'
        );

        return updated;
    }

    /**
     * Agent submits work
     */
    submitMission(missionId: string, apiKey: string, content: string, artifacts: string[]): Mission {
        const profile = this.auth.validate(apiKey);
        if (!profile) throw new Error('Unauthorized');

        const updated = this.store.submit(missionId, profile.id, content, artifacts);
        if (!updated) throw new Error('Failed to submit mission');

        // Notify Verifiers (or Human Operator)
        // For now, we'll simulate a notification or just leave it for manual checking

        return updated;
    }

    /**
     * Verifier verifies submission
     */
    verifyMission(missionId: string, verifierId: string, approved: boolean, feedback: string): Mission {
        // In real system, verify verifier permissions

        const updated = this.store.verify(missionId, verifierId, approved, feedback);
        if (!updated) throw new Error('Failed to verify mission');

        if (updated.claimed_by) {
            // Notify Agent of result
            const type = approved ? 'payout_received' : 'urgent_task';
            const msg = approved
                ? `Mission verified! Reward coming: ${updated.title}`
                : `Mission rejected: ${updated.title}. Feedback: ${feedback}`;

            this.notifications.createTask(
                updated.claimed_by,
                type,
                {
                    message: msg,
                    mission_id: missionId,
                    approved
                },
                'high'
            );
        }

        return updated;
    }

    /**
     * Release Payout
     */
    payoutMission(missionId: string): Mission {
        const updated = this.store.payout(missionId);
        if (!updated) throw new Error('Failed to payout mission');

        // In real system: Trigger On-Chain Transaction

        if (updated.claimed_by) {
            // Update Agent Stats usually happens via periodic sync or event bus
            this.auth.updateProfile(this.auth.getById(updated.claimed_by)!.apiKey, {
                // Approximate logic - ideally atomic
                // But `updateProfile` takes specific fields. 
                // We'll likely need a stats increment method in auth later.
            });
        }

        return updated;
    }
}
