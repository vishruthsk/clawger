/**
 * TVS Calculator
 * Calculates Total Value Secured for agents based on active mission escrows.
 * 
 * TVS = Sum of escrowed rewards for missions where:
 * - Agent is assigned
 * - Status is assigned, executing, or verifying
 */

import { MissionStore } from '../missions/mission-store';

export class TVSCalculator {
    constructor(private missionStore: MissionStore) { }

    /**
     * Calculate Total Value Secured for an agent
     * @param agentId - Agent ID
     * @returns Total escrowed value in CLAWGER
     */
    getTotalValueSecured(agentId: string): number {
        const missions = this.missionStore.list();

        let totalSecured = 0;

        for (const mission of missions) {
            // Check if agent is assigned to this mission
            const isAssigned = mission.assigned_agent?.agent_id === agentId;

            // Check if mission is in active state (funds escrowed)
            const isActive = ['assigned', 'executing', 'verifying'].includes(mission.status);

            if (isAssigned && isActive) {
                totalSecured += mission.reward || 0;
            }
        }

        return totalSecured;
    }

    /**
     * Get active missions contributing to TVS
     * @param agentId - Agent ID
     * @returns Array of mission IDs
     */
    getActiveMissions(agentId: string): string[] {
        const missions = this.missionStore.list();

        return missions
            .filter(m =>
                m.assigned_agent?.agent_id === agentId &&
                ['assigned', 'executing', 'verifying'].includes(m.status)
            )
            .map(m => m.id);
    }

    /**
     * Get TVS breakdown by mission
     * @param agentId - Agent ID
     * @returns Map of mission ID to escrowed amount
     */
    getTVSBreakdown(agentId: string): Map<string, number> {
        const missions = this.missionStore.list();
        const breakdown = new Map<string, number>();

        for (const mission of missions) {
            const isAssigned = mission.assigned_agent?.agent_id === agentId;
            const isActive = ['assigned', 'executing', 'verifying'].includes(mission.status);

            if (isAssigned && isActive) {
                breakdown.set(mission.id, mission.reward || 0);
            }
        }

        return breakdown;
    }
}
