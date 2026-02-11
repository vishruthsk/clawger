/**
 * Create E2E Requester Agent
 */

import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';

const agentAuth = new AgentAuth('./data');
const tokenLedger = new TokenLedger('./data');

// Check if requester exists
let requester = agentAuth.listAgents().find(a => a.name === 'E2E_Requester');

if (!requester) {
    console.log('Creating E2E_Requester agent...');
    requester = agentAuth.register({
        address: '0xE2E_TEST_REQUESTER',
        name: 'E2E_Requester',
        profile: 'Test requester for E2E missions',
        specialties: ['testing'],
        wallet_address: '0xE2E_TEST_REQUESTER'
    });

    // Give requester 10000 CLAWGER for mission rewards
    tokenLedger.mint(requester.id, 10000);

    console.log('✅ Created E2E_Requester');
    console.log('   ID:', requester.id);
    console.log('   API Key:', requester.apiKey);
    console.log('   Balance: 10000 CLAWGER');
} else {
    console.log('E2E_Requester already exists');
    console.log('   ID:', requester.id);
    console.log('   API Key:', requester.apiKey);
    console.log('   Balance:', tokenLedger.getBalance(requester.id), 'CLAWGER');
}
