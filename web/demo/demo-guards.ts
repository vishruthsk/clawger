/**
 * Demo Guards
 * 
 * Centralized guards to prevent demo data from affecting production.
 * 
 * CRITICAL RULES:
 * - Demo data NEVER touches PostgreSQL
 * - Demo data NEVER triggers contract calls
 * - Demo data NEVER updates reputation
 * - Demo data NEVER gets assigned to real missions
 */

import { DEMO_ERRORS } from './demo-constants';

/**
 * Check if an ID is a demo ID
 */
export function isDemoId(id: string | null | undefined): boolean {
    if (!id) return false;

    // Check for DEMO- prefix
    if (id.startsWith('DEMO-')) return true;

    // Check for legacy demo prefixes
    const demoPrefixes = [
        'agent_claw_',
        'agent_verify_',
        'demo-agent-',
        'demo_mission_',
        'demo-mission-',
        'demo_requester_',
    ];

    return demoPrefixes.some(prefix => id.startsWith(prefix));
}

/**
 * Check if an agent is a demo agent
 */
export function isDemoAgent(agent: any): boolean {
    if (!agent) return false;

    // Explicit demo flag
    if (agent.demo === true) return true;

    // Check ID
    return isDemoId(agent.id) || isDemoId(agent.address);
}

/**
 * Check if a mission is a demo mission
 */
export function isDemoMission(mission: any): boolean {
    if (!mission) return false;

    // Explicit demo flag
    if (mission.demo === true) return true;

    // Check ID
    return isDemoId(mission.id);
}

/**
 * Prevent demo data from being written to database
 * Throws error if demo data is detected
 */
export function preventDemoDbWrite(data: any): void {
    if (!data) return;

    // Check if data has demo flag
    if (data.demo === true) {
        throw new Error(DEMO_ERRORS.WRITE_ATTEMPT);
    }

    // Check if data has demo ID
    if (isDemoId(data.id) || isDemoId(data.address)) {
        throw new Error(DEMO_ERRORS.WRITE_ATTEMPT);
    }
}

/**
 * Prevent demo agents from making contract calls
 * Throws error if demo agent is detected
 */
export function preventDemoContractCall(agentId: string | null | undefined): void {
    if (isDemoId(agentId)) {
        throw new Error(DEMO_ERRORS.TRANSACTION_ATTEMPT);
    }
}

/**
 * Prevent demo agent reputation updates
 * Throws error if demo agent is detected
 */
export function preventDemoReputationUpdate(agentId: string | null | undefined): void {
    if (isDemoId(agentId)) {
        throw new Error(DEMO_ERRORS.TRANSACTION_ATTEMPT);
    }
}

/**
 * Prevent demo agents from being assigned to real missions
 * Throws error if demo agent or demo mission is detected
 */
export function preventDemoMissionAssignment(
    agentId: string | null | undefined,
    missionId: string | null | undefined
): void {
    if (isDemoId(agentId)) {
        throw new Error(DEMO_ERRORS.ASSIGN_ATTEMPT);
    }

    if (isDemoId(missionId)) {
        throw new Error(DEMO_ERRORS.ASSIGN_ATTEMPT);
    }
}

/**
 * Prevent demo data from being indexed
 * Throws error if demo data is detected
 */
export function preventDemoIndexing(data: any): void {
    if (!data) return;

    if (data.demo === true || isDemoId(data.id) || isDemoId(data.address)) {
        throw new Error(DEMO_ERRORS.INDEX_ATTEMPT);
    }
}

/**
 * Filter out demo items from an array
 */
export function filterOutDemo<T extends { id?: string; demo?: boolean }>(items: T[]): T[] {
    return items.filter(item => !isDemoAgent(item) && !isDemoMission(item));
}

/**
 * Tag demo items in an array with demo flag
 */
export function tagDemoItems<T extends { id?: string; demo?: boolean }>(items: T[]): T[] {
    return items.map(item => ({
        ...item,
        demo: isDemoAgent(item) || isDemoMission(item) || item.demo === true,
    }));
}
