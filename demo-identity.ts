/**
 * Identity & Access Control Demo
 * Demonstrates authorization, delegation, and violation handling
 */

import {
    createHumanIdentity,
    createAIAgentIdentity,
    createSystemIdentity,
    getIdentityName
} from './core/identity/identity';
import {
    authorize,
    requireAuthorization,
    UnauthorizedError
} from './core/identity/authority';
import {
    createDelegation,
    revokeDelegation,
    getDelegationStats
} from './core/identity/delegation';
import { getLogPrefix } from './config/demo-config';

const logger = console;

async function runIdentityDemo() {
    const prefix = getLogPrefix();

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} IDENTITY & ACCESS CONTROL DEMO`);
    logger.info(`${prefix} ========================================\n`);

    // ============ Setup Identities ============

    const alice = createHumanIdentity('0xALICE', 'Alice', true);
    const bob = createHumanIdentity('0xBOB', 'Bob', true);

    const workerAgent = createAIAgentIdentity(
        'AGENT_WORKER_001',
        'pubkey_worker_001',
        '0xALICE',
        ['execute_work'],
        75
    );

    const verifierAgent = createAIAgentIdentity(
        'AGENT_VERIFIER_001',
        'pubkey_verifier_001',
        '0xBOB',
        ['verify_work'],
        80
    );

    const assistantAgent = createAIAgentIdentity(
        'AGENT_ASSISTANT_001',
        'pubkey_assistant_001',
        '0xALICE',
        [],  // No capabilities initially
        60
    );

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} IDENTITIES CREATED`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} Humans: ${getIdentityName(alice)}, ${getIdentityName(bob)}`);
    logger.info(`${prefix} AI Agents: ${getIdentityName(workerAgent)}, ${getIdentityName(verifierAgent)}, ${getIdentityName(assistantAgent)}`);
    logger.info(`${prefix} ========================================\n`);

    await sleep(500);

    // ============ Scenario 1: Human Submits Contract ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 1: Human Submits Contract`);
    logger.info(`${prefix} ========================================\n`);

    try {
        requireAuthorization(alice, 'submit_contract');
        logger.info(`${prefix} ✅ Alice authorized to submit contract (default human capability)\n`);
    } catch (error) {
        logger.error(`${prefix} ❌ Authorization failed: ${error}\n`);
    }

    await sleep(500);

    // ============ Scenario 2: AI Agent Executes Work ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 2: AI Agent Executes Work`);
    logger.info(`${prefix} ========================================\n`);

    try {
        requireAuthorization(workerAgent, 'execute_work');
        logger.info(`${prefix} ✅ Worker Agent authorized to execute work (registered capability)\n`);
    } catch (error) {
        logger.error(`${prefix} ❌ Authorization failed: ${error}\n`);
    }

    await sleep(500);

    // ============ Scenario 3: Unauthorized Action Rejected ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 3: Unauthorized Action Rejected`);
    logger.info(`${prefix} ========================================\n`);

    try {
        requireAuthorization(workerAgent, 'submit_contract');
        logger.info(`${prefix} ✅ Worker Agent authorized to submit contract\n`);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            logger.error(`${prefix} ❌ Authorization denied: ${error.message}`);
            logger.error(`${prefix} Reason: Worker Agent lacks submit_contract capability\n`);
        }
    }

    await sleep(500);

    // ============ Scenario 4: Delegation (AI Agent Acts for Human) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 4: Delegation (AI Agent for Human)`);
    logger.info(`${prefix} ========================================\n`);

    // Alice delegates submit_contract to her assistant agent
    const delegation = createDelegation(
        alice.wallet_address,
        assistantAgent.agent_id,
        ['submit_contract'],
        24 * 60 * 60 * 1000  // 24 hours
    );

    await sleep(500);

    // Now assistant can submit contracts on behalf of Alice
    try {
        const result = authorize(assistantAgent, 'submit_contract');
        if (result.authorized) {
            logger.info(`${prefix} ✅ Assistant Agent authorized to submit contract`);
            logger.info(`${prefix} Via delegation: ${result.via_delegation}`);
            logger.info(`${prefix} Acting on behalf of: ${alice.wallet_address}\n`);
        }
    } catch (error) {
        logger.error(`${prefix} ❌ Authorization failed: ${error}\n`);
    }

    await sleep(500);

    // ============ Scenario 5: Delegation Revocation ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 5: Delegation Revocation`);
    logger.info(`${prefix} ========================================\n`);

    // Alice revokes the delegation
    revokeDelegation(delegation.delegation_id, alice.wallet_address);

    await sleep(500);

    // Now assistant can no longer submit contracts
    try {
        requireAuthorization(assistantAgent, 'submit_contract');
        logger.info(`${prefix} ✅ Assistant Agent still authorized\n`);
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            logger.error(`${prefix} ❌ Authorization denied: ${error.message}`);
            logger.error(`${prefix} Reason: Delegation was revoked\n`);
        }
    }

    await sleep(500);

    // ============ Scenario 6: AI Agent Cannot Re-Delegate ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 6: AI Agent Cannot Re-Delegate`);
    logger.info(`${prefix} ========================================\n`);

    // Create a new delegation for testing
    const delegation2 = createDelegation(
        alice.wallet_address,
        assistantAgent.agent_id,
        ['submit_contract'],
        24 * 60 * 60 * 1000
    );

    await sleep(500);

    // Try to create delegation from AI agent (should fail in real implementation)
    logger.warn(`${prefix} ⚠️  AI agents cannot create delegations`);
    logger.warn(`${prefix} Only humans can delegate authority\n`);

    await sleep(500);

    // ============ Scenario 7: System Identity (Internal) ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} SCENARIO 7: System Identity`);
    logger.info(`${prefix} ========================================\n`);

    const supervisor = createSystemIdentity('SUPERVISOR');

    try {
        requireAuthorization(supervisor, 'admin_override');
        logger.info(`${prefix} ✅ System (SUPERVISOR) authorized for admin_override`);
        logger.info(`${prefix} System components have all capabilities\n`);
    } catch (error) {
        logger.error(`${prefix} ❌ Authorization failed: ${error}\n`);
    }

    await sleep(500);

    // ============ Final Statistics ============

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DELEGATION STATISTICS`);
    logger.info(`${prefix} ========================================`);

    const stats = getDelegationStats();
    logger.info(`${prefix} Total: ${stats.total}`);
    logger.info(`${prefix} Active: ${stats.active}`);
    logger.info(`${prefix} Revoked: ${stats.revoked}`);
    logger.info(`${prefix} Expired: ${stats.expired}`);
    logger.info(`${prefix} ========================================\n`);

    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} DEMO COMPLETE`);
    logger.info(`${prefix} ========================================`);
    logger.info(`${prefix} `);
    logger.info(`${prefix} Summary:`);
    logger.info(`${prefix}   - Humans have default capabilities (submit, view)`);
    logger.info(`${prefix}   - AI agents have registered capabilities`);
    logger.info(`${prefix}   - Delegations are scoped and time-bound`);
    logger.info(`${prefix}   - Unauthorized actions are rejected immediately`);
    logger.info(`${prefix}   - System components have full authority`);
    logger.info(`${prefix} ========================================`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
    runIdentityDemo().catch(error => {
        console.error('Demo error:', error);
        process.exit(1);
    });
}

export { runIdentityDemo };
