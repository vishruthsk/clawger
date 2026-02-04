/**
 * Delegation Rules & Management
 * Scoped, time-bound, revocable delegation from humans to AI agents
 */

import { Capability, HumanIdentity, AIAgentIdentity } from './identity';
import { getLogPrefix } from '../../config/demo-config';

const logger = console;

export interface Delegation {
    delegation_id: string;
    delegator: string;           // Human wallet address
    delegate: string;            // AI agent ID
    capabilities: Capability[];  // Scoped permissions
    valid_from: Date;
    valid_until: Date;           // Time-bound
    revoked: boolean;
    revoked_at?: Date;
    created_at: Date;
}

// In-memory delegation store (would be on-chain in PUBLIC mode)
const delegations: Map<string, Delegation> = new Map();

/**
 * Create a delegation from human to AI agent
 */
export function createDelegation(
    delegator: string,
    delegate: string,
    capabilities: Capability[],
    durationMs: number
): Delegation {
    const prefix = getLogPrefix();

    // Validation
    if (capabilities.length === 0) {
        throw new Error('Delegation must include at least one capability');
    }

    if (durationMs <= 0) {
        throw new Error('Delegation duration must be positive');
    }

    const now = new Date();
    const delegation: Delegation = {
        delegation_id: `DEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        delegator: delegator,
        delegate: delegate,
        capabilities: capabilities,
        valid_from: now,
        valid_until: new Date(now.getTime() + durationMs),
        revoked: false,
        created_at: now
    };

    delegations.set(delegation.delegation_id, delegation);

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DELEGATION CREATED`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} ID: ${delegation.delegation_id}`);
    logger.info(`${prefix} Delegator: ${delegator}`);
    logger.info(`${prefix} Delegate: ${delegate}`);
    logger.info(`${prefix} Capabilities: ${capabilities.join(', ')}`);
    logger.info(`${prefix} Valid until: ${delegation.valid_until.toISOString()}`);
    logger.info(`${prefix} ========================================\n`);

    return delegation;
}

/**
 * Revoke a delegation
 */
export function revokeDelegation(delegationId: string, revoker: string): void {
    const prefix = getLogPrefix();
    const delegation = delegations.get(delegationId);

    if (!delegation) {
        throw new Error(`Delegation not found: ${delegationId}`);
    }

    // Only delegator can revoke
    if (delegation.delegator !== revoker) {
        throw new Error(`Only delegator can revoke (delegator: ${delegation.delegator}, revoker: ${revoker})`);
    }

    if (delegation.revoked) {
        logger.warn(`${prefix} [DELEGATION] Already revoked: ${delegationId}`);
        return;
    }

    delegation.revoked = true;
    delegation.revoked_at = new Date();

    logger.warn(`${prefix} ========================================`);
    logger.warn(`${prefix} DELEGATION REVOKED`);
    logger.warn(`${prefix} ========================================`);
    logger.warn(`${prefix} ID: ${delegationId}`);
    logger.warn(`${prefix} Delegator: ${delegation.delegator}`);
    logger.warn(`${prefix} Delegate: ${delegation.delegate}`);
    logger.warn(`${prefix} ========================================\n`);
}

/**
 * Check if delegation is currently valid
 */
export function isDelegationValid(delegation: Delegation): boolean {
    if (delegation.revoked) {
        return false;
    }

    const now = new Date();
    return now >= delegation.valid_from && now <= delegation.valid_until;
}

/**
 * Get active delegation for an agent and capability
 */
export function getActiveDelegation(
    agentId: string,
    capability: Capability
): Delegation | null {
    for (const delegation of delegations.values()) {
        if (
            delegation.delegate === agentId &&
            delegation.capabilities.includes(capability) &&
            !delegation.revoked &&
            isDelegationValid(delegation)
        ) {
            return delegation;
        }
    }

    return null;
}

/**
 * Get all delegations for an agent
 */
export function getDelegationsForAgent(agentId: string): Delegation[] {
    return Array.from(delegations.values())
        .filter(d => d.delegate === agentId);
}

/**
 * Get all delegations by a delegator
 */
export function getDelegationsByDelegator(delegator: string): Delegation[] {
    return Array.from(delegations.values())
        .filter(d => d.delegator === delegator);
}

/**
 * Get delegation by ID
 */
export function getDelegation(delegationId: string): Delegation | null {
    return delegations.get(delegationId) || null;
}

/**
 * Clean up expired delegations (maintenance)
 */
export function cleanupExpiredDelegations(): number {
    const prefix = getLogPrefix();
    const now = new Date();
    let cleaned = 0;

    for (const [id, delegation] of delegations.entries()) {
        if (now > delegation.valid_until) {
            delegations.delete(id);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info(`${prefix} [DELEGATION] Cleaned up ${cleaned} expired delegations`);
    }

    return cleaned;
}

/**
 * Get delegation statistics
 */
export function getDelegationStats(): {
    total: number;
    active: number;
    revoked: number;
    expired: number;
} {
    const now = new Date();
    let active = 0;
    let revoked = 0;
    let expired = 0;

    for (const delegation of delegations.values()) {
        if (delegation.revoked) {
            revoked++;
        } else if (now > delegation.valid_until) {
            expired++;
        } else {
            active++;
        }
    }

    return {
        total: delegations.size,
        active,
        revoked,
        expired
    };
}
