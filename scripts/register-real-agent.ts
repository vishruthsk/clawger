#!/usr/bin/env node
/**
 * Register a real agent on Monad Mainnet
 * 
 * Usage: CLAWGER_PRIVATE_KEY=0x... npx tsx scripts/register-real-agent.ts
 */

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const REGISTRY_ABI = [
    'function registerAgent(uint8 agentType, bytes32[] calldata capabilities, uint256 minFee, uint256 minBond) external',
    'function isAgentRegistered(address agent) external view returns (bool)',
    'event AgentRegistered(address indexed agent, uint8 agentType, bytes32[] capabilities, uint256 minFee, uint256 minBond, address operator)',
];

async function main() {
    const privateKey = process.env.CLAWGER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('❌ CLAWGER_PRIVATE_KEY not set in environment');
    }

    console.log('🚀 Registering Real Agent on Monad Mainnet\n');

    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const registry = new ethers.Contract(
        MONAD_PRODUCTION.contracts.AGENT_REGISTRY,
        REGISTRY_ABI,
        wallet
    );

    console.log(`📍 Wallet Address: ${wallet.address}`);
    console.log(`⛓️  Network: Monad Mainnet (Chain ID: ${MONAD_PRODUCTION.chainId})`);
    console.log(`📜 Registry: ${MONAD_PRODUCTION.contracts.AGENT_REGISTRY}\n`);

    // Skip registration check - contract might not have this function
    // const isRegistered = await registry.isAgentRegistered(wallet.address);
    // if (isRegistered) {
    //     console.log('✅ Agent already registered!');
    //     console.log(`🔗 View on explorer: ${MONAD_PRODUCTION.getExplorerLink('address', wallet.address)}`);
    //     return;
    // }

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} MON\n`);

    if (balance === 0n) {
        throw new Error('❌ Wallet has no MON for gas fees');
    }

    // Registration parameters
    const agentType = 0; // 0 = worker, 1 = verifier
    const capabilities = [
        ethers.encodeBytes32String('smart_contracts'),
        ethers.encodeBytes32String('solidity'),
        ethers.encodeBytes32String('security'),
    ];
    const minFee = ethers.parseEther('0.1'); // 0.1 CLGR
    const minBond = ethers.parseEther('0.05'); // 0.05 CLGR

    console.log('📋 Registration Parameters:');
    console.log(`   Type: ${agentType === 0 ? 'Worker' : 'Verifier'}`);
    console.log(`   Capabilities: smart_contracts, solidity, security`);
    console.log(`   Min Fee: ${ethers.formatEther(minFee)} CLGR`);
    console.log(`   Min Bond: ${ethers.formatEther(minBond)} CLGR\n`);

    console.log('📤 Sending transaction...');
    const tx = await registry.registerAgent(agentType, capabilities, minFee, minBond);

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`🔗 ${MONAD_PRODUCTION.getExplorerLink('tx', tx.hash)}\n`);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log(`✅ Confirmed in block ${receipt!.blockNumber}`);
    console.log(`⛽ Gas used: ${receipt!.gasUsed.toString()}\n`);

    console.log('🎉 Agent successfully registered!');
    console.log(`📍 Agent Address: ${wallet.address}`);
    console.log(`🔗 ${MONAD_PRODUCTION.getExplorerLink('address', wallet.address)}\n`);

    console.log('📊 Next Steps:');
    console.log('   1. Indexer will automatically pick up the AgentRegistered event');
    console.log('   2. Agent will appear in Postgres database');
    console.log('   3. Agent will be visible at http://localhost:3000/claws');
    console.log('   4. Check /api/agents to see the indexed data\n');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
