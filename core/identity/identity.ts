/**
 * Identity Types
 * Defines identity types for humans, AI agents, and system components
 */

export type IdentityType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

export interface HumanIdentity {
    type: 'HUMAN';
    wallet_address: string;
    display_name?: string;
    verified: boolean;
    created_at: Date;
}

export interface AIAgentIdentity {
    type: 'AI_AGENT';
    agent_id: string;
    public_key: string;
    registered_by: string;  // Human wallet that registered this agent
    capabilities: Capability[];
    reputation: number;  // 0-100
    created_at: Date;
}

export interface SystemIdentity {
    type: 'SYSTEM';
    component: string;  // 'SUPERVISOR' | 'CONSENSUS' | 'OBSERVER'
    internal: true;
}

export type Identity = HumanIdentity | AIAgentIdentity | SystemIdentity;

export type Capability =
    | 'submit_contract'      // Submit work proposals
    | 'execute_work'         // Act as worker
    | 'verify_work'          // Act as verifier
    | 'run_local_mode'       // Execute in LOCAL mode
    | 'view_observer'        // Read-only observer access
    | 'admin_override';      // Emergency override (very limited)

/**
 * Create human identity
 */
export function createHumanIdentity(
    walletAddress: string,
    displayName?: string,
    verified: boolean = false
): HumanIdentity {
    return {
        type: 'HUMAN',
        wallet_address: walletAddress,
        display_name: displayName,
        verified: verified,
        created_at: new Date()
    };
}

/**
 * Create AI agent identity
 */
export function createAIAgentIdentity(
    agentId: string,
    publicKey: string,
    registeredBy: string,
    capabilities: Capability[],
    reputation: number = 50
): AIAgentIdentity {
    return {
        type: 'AI_AGENT',
        agent_id: agentId,
        public_key: publicKey,
        registered_by: registeredBy,
        capabilities: capabilities,
        reputation: Math.max(0, Math.min(100, reputation)),
        created_at: new Date()
    };
}

/**
 * Create system identity
 */
export function createSystemIdentity(component: string): SystemIdentity {
    return {
        type: 'SYSTEM',
        component: component,
        internal: true
    };
}

/**
 * Get identity display name
 */
export function getIdentityName(identity: Identity): string {
    switch (identity.type) {
        case 'HUMAN':
            return identity.display_name || identity.wallet_address;
        case 'AI_AGENT':
            return identity.agent_id;
        case 'SYSTEM':
            return `SYSTEM:${identity.component}`;
    }
}

/**
 * Verify identity signature (placeholder for real implementation)
 */
export function verifyIdentitySignature(
    identity: Identity,
    message: string,
    signature: string
): boolean {
    // In real implementation:
    // - For HUMAN: verify wallet signature
    // - For AI_AGENT: verify public key signature
    // - For SYSTEM: verify internal token

    // For now, always return true (demo mode)
    return true;
}
