#!/usr/bin/env tsx
/**
 * Deterministic Economy Pre-Seed
 * 
 * Funds pre-registered bots with fixed wallet addresses
 * Persists to disk so all API endpoints see the same balances
 */

import { TokenLedger } from '../core/ledger/token-ledger';
import { AgentAuth } from '../core/registry/agent-auth';

async function preSeedEconomy() {
    console.log('\n💰 PRE-SEEDING CLAWGER ECONOMY\n');
    console.log('='.repeat(60) + '\n');

    const ledger = new TokenLedger('./data');
    const agentAuth = new AgentAuth('./data');

    // Use deterministic wallet addresses
    const strategyBotWallet = '0x1111111111111111111111111111111111111111';
    const codeBotWallet = '0x2222222222222222222222222222222222222222';
    const verifier1Wallet = '0x3333333333333333333333333333333333333333';
    const verifier2Wallet = '0x4444444444444444444444444444444444444444';
    const verifier3Wallet = '0x5555555555555555555555555555555555555555';

    // Register agents with fixed wallets
    console.log('📋 Registering Economy Actors...\n');

    const strategyBot = agentAuth.register({
        address: strategyBotWallet,
        wallet_address: strategyBotWallet,
        name: 'StrategyBot',
        profile: 'Strategic planning & project management expert',
        specialties: ['Strategy', 'Planning', 'Project Management'],
        platform: 'CLAWGER',
        hourly_rate: 60
    });
    console.log(`✅ StrategyBot: ${strategyBot.id}`);
    console.log(`   Wallet: ${strategyBot.wallet_address}`);
    console.log(`   API Key: ${strategyBot.apiKey}\n`);

    const codeBot = agentAuth.register({
        address: codeBotWallet,
        wallet_address: codeBotWallet,
        name: 'CodeBot',
        profile: 'Backend development specialist',
        specialties: ['Coding', 'Backend', 'APIs'],
        platform: 'CLAWGER',
        hourly_rate: 55
    });
    console.log(`✅ CodeBot: ${codeBot.id}`);
    console.log(`   Wallet: ${codeBot.wallet_address}`);
    console.log(`   API Key: ${codeBot.apiKey}\n`);

    const verifier1 = agentAuth.register({
        address: verifier1Wallet,
        wallet_address: verifier1Wallet,
        name: 'Verifier1',
        profile: 'Quality assurance verifier #1',
        specialties: ['Verification', 'QA', 'Testing'],
        platform: 'CLAWGER',
        hourly_rate: 40
    });
    console.log(`✅ Verifier1: ${verifier1.id}`);

    const verifier2 = agentAuth.register({
        address: verifier2Wallet,
        wallet_address: verifier2Wallet,
        name: 'Verifier2',
        profile: 'Quality assurance verifier #2',
        specialties: ['Verification', 'QA', 'Testing'],
        platform: 'CLAWGER',
        hourly_rate: 40
    });
    console.log(`✅ Verifier2: ${verifier2.id}`);

    const verifier3 = agentAuth.register({
        address: verifier3Wallet,
        wallet_address: verifier3Wallet,
        name: 'Verifier3',
        profile: 'Quality assurance verifier #3',
        specialties: ['Verification', 'QA', 'Testing'],
        platform: 'CLAWGER',
        hourly_rate: 40
    });
    console.log(`✅ Verifier3: ${verifier3.id}\n`);

    // Fund wallets
    console.log('💸 Funding Wallets...\n');

    ledger.mint(strategyBotWallet, 5000);
    ledger.mint(codeBotWallet, 2000);
    ledger.mint(verifier1Wallet, 1000);
    ledger.mint(verifier2Wallet, 1000);
    ledger.mint(verifier3Wallet, 1000);

    console.log(`💰 StrategyBot: ${ledger.getBalance(strategyBotWallet)} $CLAWGER`);
    console.log(`💰 CodeBot: ${ledger.getBalance(codeBotWallet)} $CLAWGER`);
    console.log(`💰 Verifier1: ${ledger.getBalance(verifier1Wallet)} $CLAWGER`);
    console.log(`💰 Verifier2: ${ledger.getBalance(verifier2Wallet)} $CLAWGER`);
    console.log(`💰 Verifier3: ${ledger.getBalance(verifier3Wallet)} $CLAWGER\n`);

    console.log('✅ Economy seeded and persisted to ./data/\n');
    console.log('🎯 Ready for bot-to-bot lifecycle demo!\n');
}

preSeedEconomy().catch(error => {
    console.error('\n❌ Seed Failed:', error.message);
    process.exit(1);
});
