/**
 * Demo Data Validators
 * 
 * Type guards and runtime validators to ensure demo data
 * never contaminates the production economy.
 */

import { DEMO_ID_PREFIXES, DEMO_ERRORS } from './demo-constants';
import type { DemoAgent, DemoMission } from './seed-data';

/**
 * Type guard: Check if object is a demo agent
 */
export function isDemoAgent(obj: any): obj is DemoAgent {
    if (!obj || typeof obj !== 'object') return false;

    // Must have demo flag
    if (obj.demo !== true) return false;

    // Must have valid demo ID prefix
    const hasValidPrefix = DEMO_ID_PREFIXES.AGENT.some(prefix =>
        obj.id?.startsWith(prefix)
    );

    return hasValidPrefix;
}

/**
 * Type guard: Check if object is a demo mission
 */
export function isDemoMission(obj: any): obj is DemoMission {
    if (!obj || typeof obj !== 'object') return false;

    // Must have demo flag
    if (obj.demo !== true) return false;

    // Must have valid demo ID prefix
    const hasValidPrefix = DEMO_ID_PREFIXES.MISSION.some(prefix =>
        obj.id?.startsWith(prefix)
    );

    return hasValidPrefix;
}

/**
 * Type guard: Check if object is any demo data
 */
export function isDemoData(obj: any): boolean {
    return isDemoAgent(obj) || isDemoMission(obj);
}

/**
 * Runtime validator: Ensure object has demo flag
 * Throws if demo flag is missing or false
 */
export function ensureDemoFlag(obj: any): void {
    if (!obj || typeof obj !== 'object') {
        throw new Error('Invalid object: must be an object');
    }

    if (obj.demo !== true) {
        throw new Error(`Demo flag missing or false on object: ${obj.id}`);
    }
}

/**
 * Runtime validator: Prevent demo data from being written to DB
 * Throws if object is demo data
 */
export function preventDemoWrite(obj: any, operation: string = 'write'): void {
    if (isDemoData(obj)) {
        throw new Error(
            `${DEMO_ERRORS.WRITE_ATTEMPT}: Attempted to ${operation} demo object ${obj.id}`
        );
    }
}

/**
 * Runtime validator: Prevent demo agent assignment
 * Throws if agent is demo data
 */
export function preventDemoAssignment(agent: any, mission: any): void {
    if (isDemoAgent(agent)) {
        throw new Error(
            `${DEMO_ERRORS.ASSIGN_ATTEMPT}: Agent ${agent.id} is demo data`
        );
    }

    if (isDemoMission(mission)) {
        throw new Error(
            `${DEMO_ERRORS.ASSIGN_ATTEMPT}: Mission ${mission.id} is demo data`
        );
    }
}

/**
 * Runtime validator: Prevent demo transactions
 * Throws if any participant is demo data
 */
export function preventDemoTransaction(participants: any[]): void {
    for (const participant of participants) {
        if (isDemoData(participant)) {
            throw new Error(
                `${DEMO_ERRORS.TRANSACTION_ATTEMPT}: Participant ${participant.id} is demo data`
            );
        }
    }
}

/**
 * Filter: Remove demo data from array
 */
export function filterDemoData<T extends { demo?: boolean; id?: string }>(items: T[]): T[] {
    return items.filter(item => !isDemoData(item));
}

/**
 * Filter: Get only demo data from array
 */
export function filterOnlyDemoData<T extends { demo?: boolean; id?: string }>(items: T[]): T[] {
    return items.filter(item => isDemoData(item));
}

/**
 * Validator: Ensure array contains no demo data
 */
export function assertNoDemo<T extends { demo?: boolean; id?: string }>(
    items: T[],
    context: string = 'operation'
): void {
    const demoItems = filterOnlyDemoData(items);

    if (demoItems.length > 0) {
        const demoIds = demoItems.map(item => item.id).join(', ');
        throw new Error(
            `${DEMO_ERRORS.WRITE_ATTEMPT}: Found demo data in ${context}: ${demoIds}`
        );
    }
}
