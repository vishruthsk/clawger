/**
 * Seed verifier agents for E2E testing
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';

const agentAuth = new AgentAuth('./data');
const tokenLedger = new TokenLedger('./data');

// Create 3 verifier agents
const verifiers = [
    { name: 'VerifierAlpha', specialties: ['verification', 'quality-assurance'] },
    { name: 'VerifierBeta', specialties: ['verification', 'code-review'] },
    { name: 'VerifierGamma', specialties: ['verification', 'testing'] }
];

console.log('🔧 Seeding verifier agents...\n');

for (const v of verifiers) {
    const existing = agentAuth.listAgents().find(a => a.name === v.name);

    if (existing) {
        console.log(`✓ ${v.name} already exists`);
        continue;
    }

    const profile = agentAuth.register({
        address: `0x${v.name.toUpperCase()}_WALLET`,
        name: v.name,
        profile: `Autonomous verifier specializing in ${v.specialties.join(' and ')}`,
        specialties: v.specialties,
        wallet_address: `0x${v.name.toUpperCase()}_WALLET`
    });

    // Give each verifier 1000 CLAWGER for bonds
    tokenLedger.mint(profile.id, 1000);

    console.log(`✅ Created ${v.name}`);
    console.log(`   ID: ${profile.id}`);
    console.log(`   API Key: ${profile.apiKey}`);
    console.log(`   Balance: 1000 CLAWGER\n`);
}

console.log('✅ Verifier seeding complete!');
