/**
 * Authority & Capability-Based Permissions
 * Deterministic authorization checks for all actions
 */

import { Identity, Capability, HumanIdentity, AIAgentIdentity, SystemIdentity } from './identity';
import { getActiveDelegation, isDelegationValid } from './delegation';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface AuthorizationResult {
    authorized: boolean;
    reason?: string;
    via_delegation?: string;  // Delegation ID if authorized via delegation
}

export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Default capabilities by identity type
 */
const DEFAULT_CAPABILITIES: Record<string, Capability[]> = {
    HUMAN: ['submit_contract', 'run_local_mode', 'view_observer'],
    AI_AGENT: [],  // AI agents get capabilities from registration
    SYSTEM: ['submit_contract', 'execute_work', 'verify_work', 'run_local_mode', 'view_observer', 'admin_override']
};

/**
 * Check if identity has a capability directly
 */
export function hasCapability(identity: Identity, capability: Capability): boolean {
    switch (identity.type) {
        case 'HUMAN':
            return DEFAULT_CAPABILITIES.HUMAN.includes(capability);

        case 'AI_AGENT':
            return identity.capabilities.includes(capability);

        case 'SYSTEM':
            return DEFAULT_CAPABILITIES.SYSTEM.includes(capability);

        default:
            return false;
    }
}

/**
 * Authorize an action for an identity
 */
export function authorize(
    identity: Identity,
    action: Capability,
    context?: any
): AuthorizationResult {
    const prefix = getLogPrefix();

    // 1. Check if identity has capability directly
    if (hasCapability(identity, action)) {
        logger.debug(`${prefix} [AUTH] ✅ ${identity.type} authorized for ${action} (direct capability)`);
        return { authorized: true };
    }

    // 2. Check if acting under delegation (AI agents only)
    if (identity.type === 'AI_AGENT') {
        const delegation = getActiveDelegation(identity.agent_id, action);

        if (delegation && !delegation.revoked && isDelegationValid(delegation)) {
            logger.debug(`${prefix} [AUTH] ✅ ${identity.agent_id} authorized for ${action} (via delegation ${delegation.delegation_id})`);
            return {
                authorized: true,
                via_delegation: delegation.delegation_id
            };
        }
    }

    // 3. Reject
    const reason = `${identity.type} lacks capability: ${action}`;
    logger.warn(`${prefix} [AUTH] ❌ Authorization denied: ${reason}`);

    return {
        authorized: false,
        reason: reason
    };
}

/**
 * Require authorization (throws if unauthorized)
 */
export function requireAuthorization(
    identity: Identity,
    action: Capability,
    context?: any
): void {
    const result = authorize(identity, action, context);

    if (!result.authorized) {
        throw new UnauthorizedError(result.reason || 'Unauthorized');
    }
}

/**
 * Check multiple capabilities (all must be authorized)
 */
export function authorizeAll(
    identity: Identity,
    actions: Capability[],
    context?: any
): AuthorizationResult {
    for (const action of actions) {
        const result = authorize(identity, action, context);
        if (!result.authorized) {
            return result;
        }
    }

    return { authorized: true };
}

/**
 * Check multiple capabilities (at least one must be authorized)
 */
export function authorizeAny(
    identity: Identity,
    actions: Capability[],
    context?: any
): AuthorizationResult {
    for (const action of actions) {
        const result = authorize(identity, action, context);
        if (result.authorized) {
            return result;
        }
    }

    return {
        authorized: false,
        reason: `None of the required capabilities: ${actions.join(', ')}`
    };
}

/**
 * Get all capabilities for an identity (including delegations)
 */
export function getAllCapabilities(identity: Identity): Capability[] {
    const capabilities: Capability[] = [];

    // Add direct capabilities
    switch (identity.type) {
        case 'HUMAN':
            capabilities.push(...DEFAULT_CAPABILITIES.HUMAN);
            break;
        case 'AI_AGENT':
            capabilities.push(...identity.capabilities);
            break;
        case 'SYSTEM':
            capabilities.push(...DEFAULT_CAPABILITIES.SYSTEM);
            break;
    }

    // Add delegated capabilities (AI agents only)
    if (identity.type === 'AI_AGENT') {
        // This would query all active delegations
        // For now, we'll skip to avoid circular dependency
    }

    return [...new Set(capabilities)];  // Remove duplicates
}
