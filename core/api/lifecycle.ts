/**
 * Contract Lifecycle State Machine
 * Deterministic state transitions with explicit rules
 */

import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export type ContractLifecycleState =
    | 'PROPOSED'      // Submitted, awaiting pricing
    | 'PRICED'        // Pricing complete, awaiting acceptance
    | 'ACCEPTED'      // Accepted, awaiting execution start
    | 'EXECUTING'     // Worker actively executing
    | 'VERIFYING'     // Work submitted, verifiers checking
    | 'COMPLETED'     // Verification passed, payment released
    | 'FAILED'        // Max retries exhausted or verification failed
    | 'TIMEOUT'       // Deadline exceeded
    | 'REJECTED';     // Proposal rejected

export class InvalidStateTransitionError extends Error {
    constructor(from: ContractLifecycleState, to: ContractLifecycleState) {
        super(`Invalid state transition: ${from} → ${to}`);
        this.name = 'InvalidStateTransitionError';
    }
}

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: Record<ContractLifecycleState, ContractLifecycleState[]> = {
    PROPOSED: ['PRICED', 'REJECTED'],
    PRICED: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['EXECUTING'],
    EXECUTING: ['VERIFYING', 'EXECUTING', 'TIMEOUT', 'FAILED'],  // EXECUTING→EXECUTING for reassignment
    VERIFYING: ['COMPLETED', 'FAILED', 'TIMEOUT'],
    COMPLETED: [],  // Terminal
    FAILED: [],     // Terminal
    TIMEOUT: [],    // Terminal
    REJECTED: []    // Terminal
};

/**
 * Terminal states (no transitions allowed)
 */
const TERMINAL_STATES: ContractLifecycleState[] = ['COMPLETED', 'FAILED', 'TIMEOUT', 'REJECTED'];

/**
 * Check if state is terminal
 */
export function isTerminalState(state: ContractLifecycleState): boolean {
    return TERMINAL_STATES.includes(state);
}

/**
 * Check if transition is valid
 */
export function isValidTransition(
    from: ContractLifecycleState,
    to: ContractLifecycleState
): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from] || [];
    return allowedTransitions.includes(to);
}

/**
 * Validate and execute state transition
 */
export function validateTransition(
    contractId: string,
    from: ContractLifecycleState,
    to: ContractLifecycleState
): void {
    const prefix = getLogPrefix();

    // Check if from state is terminal
    if (isTerminalState(from)) {
        throw new InvalidStateTransitionError(from, to);
    }

    // Check if transition is valid
    if (!isValidTransition(from, to)) {
        logger.error(`${prefix} [LIFECYCLE] ❌ Invalid transition: ${from} → ${to}`);
        throw new InvalidStateTransitionError(from, to);
    }

    logger.debug(`${prefix} [LIFECYCLE] ✅ Valid transition: ${from} → ${to} (${contractId})`);
}

/**
 * Get all valid next states from current state
 */
export function getValidNextStates(state: ContractLifecycleState): ContractLifecycleState[] {
    return VALID_TRANSITIONS[state] || [];
}

/**
 * Get state transition path (for visualization)
 */
export function getTransitionPath(
    from: ContractLifecycleState,
    to: ContractLifecycleState
): ContractLifecycleState[] | null {
    // Simple BFS to find path
    const queue: ContractLifecycleState[][] = [[from]];
    const visited = new Set<ContractLifecycleState>([from]);

    while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1];

        if (current === to) {
            return path;
        }

        const nextStates = getValidNextStates(current);
        for (const next of nextStates) {
            if (!visited.has(next)) {
                visited.add(next);
                queue.push([...path, next]);
            }
        }
    }

    return null;  // No valid path
}

/**
 * Get lifecycle statistics
 */
export function getLifecycleStats(states: ContractLifecycleState[]): {
    total: number;
    by_state: Record<ContractLifecycleState, number>;
    terminal: number;
    active: number;
} {
    const by_state: Record<string, number> = {};
    let terminal = 0;
    let active = 0;

    for (const state of states) {
        by_state[state] = (by_state[state] || 0) + 1;

        if (isTerminalState(state)) {
            terminal++;
        } else {
            active++;
        }
    }

    return {
        total: states.length,
        by_state: by_state as Record<ContractLifecycleState, number>,
        terminal,
        active
    };
}
