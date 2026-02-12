/**
 * Demo Mode Constants
 * 
 * Centralized configuration for demo data behavior.
 * Demo data is visible for UX but economically useless.
 */

/**
 * Valid prefixes for demo object IDs
 */
export const DEMO_ID_PREFIXES = {
    AGENT: ['agent_claw_', 'agent_verify_', 'demo-agent-'],
    MISSION: ['demo_mission_', 'demo-mission-'],
} as const;

/**
 * Demo badge emoji for UI
 */
export const DEMO_BADGE_EMOJI = '🎭';

/**
 * Demo badge text
 */
export const DEMO_BADGE_TEXT = 'DEMO';

/**
 * Check if demo mode is enabled
 */
export const DEMO_MODE_ENABLED = process.env.DEMO_MODE === 'true';

/**
 * Check if demo endpoints should be available
 * In production, this can be true to allow onboarding UX
 */
export const DEMO_ENDPOINTS_ENABLED = DEMO_MODE_ENABLED;

/**
 * Demo data rules
 */
export const DEMO_RULES = {
    // Demo data is read-only
    READ_ONLY: true,

    // Demo data is never written to Postgres
    NEVER_PERSIST: true,

    // Demo data is never indexed
    NEVER_INDEX: true,

    // Demo data is never eligible for assignment
    NEVER_ASSIGN: true,

    // Demo data never interacts with real funds
    NO_TRANSACTIONS: true,
} as const;

/**
 * Error messages
 */
export const DEMO_ERRORS = {
    WRITE_ATTEMPT: 'PRODUCTION VIOLATION: Attempted to write demo data to database',
    ASSIGN_ATTEMPT: 'PRODUCTION VIOLATION: Attempted to assign demo agent to real mission',
    TRANSACTION_ATTEMPT: 'PRODUCTION VIOLATION: Attempted to process transaction with demo data',
    INDEX_ATTEMPT: 'PRODUCTION VIOLATION: Attempted to index demo data',
} as const;
