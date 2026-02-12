#!/usr/bin/env node
/**
 * Approve CLGR and Register Agent on Monad Mainnet
 * 
 * Usage: CLAWGER_PRIVATE_KEY=0x... npx tsx scripts/approve-and-register.ts
 */

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const CLGR_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
];

const REGISTRY_ABI = [
    'function registerAgent(uint8 agentType, bytes32[] calldata capabilities, uint256 minFee, uint256 minBond, address operator) external',
    'event AgentRegistered(address indexed agent, uint8 agentType, bytes32[] capabilities, uint256 minFee, uint256 minBond, address operator)',
];

async function main() {
    const privateKey = process.env.CLAWGER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('❌ CLAWGER_PRIVATE_KEY not set in environment');
    }

    console.log('🚀 CLAWGER Agent Registration\n');

    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    const clgr = new ethers.Contract(
        MONAD_PRODUCTION.contracts.CLGR_TOKEN,
        CLGR_ABI,
        wallet
    );

    const registry = new ethers.Contract(
        MONAD_PRODUCTION.contracts.AGENT_REGISTRY,
        REGISTRY_ABI,
        wallet
    );

    console.log(`📍 Wallet: ${wallet.address}`);
    console.log(`⛓️  Network: Monad Mainnet (Chain ${MONAD_PRODUCTION.chainId})\n`);

    // Check balances
    const monBalance = await provider.getBalance(wallet.address);
    const clgrBalance = await clgr.balanceOf(wallet.address);

    console.log(`💰 Balances:`);
    console.log(`   MON: ${ethers.formatEther(monBalance)}`);
    console.log(`   CLGR: ${ethers.formatEther(clgrBalance)}\n`);

    if (monBalance === 0n) {
        throw new Error('❌ No MON for gas fees');
    }

    const minBond = ethers.parseEther('100'); // 100 CLGR bond
    const approvalAmount = ethers.parseEther('500'); // Approve 500 CLGR

    if (clgrBalance < minBond) {
        throw new Error(`❌ Insufficient CLGR. Need ${ethers.formatEther(minBond)}, have ${ethers.formatEther(clgrBalance)}`);
    }

    // Check current allowance
    const currentAllowance = await clgr.allowance(wallet.address, MONAD_PRODUCTION.contracts.AGENT_REGISTRY);
    console.log(`📋 Current CLGR allowance: ${ethers.formatEther(currentAllowance)}\n`);

    // Step 1: Approve CLGR if needed
    if (currentAllowance < minBond) {
        console.log(`📤 Step 1: Approving ${ethers.formatEther(approvalAmount)} CLGR...`);
        const approveTx = await clgr.approve(MONAD_PRODUCTION.contracts.AGENT_REGISTRY, approvalAmount);
        console.log(`   Tx: ${approveTx.hash}`);

        const approveReceipt = await approveTx.wait();
        console.log(`   ✅ Approved in block ${approveReceipt!.blockNumber}\n`);
    } else {
        console.log(`✅ Already approved (${ethers.formatEther(currentAllowance)} CLGR)\n`);
    }

    // Step 2: Register Agent
    const agentType = 0; // worker
    const capabilities = [
        ethers.encodeBytes32String('smart_contracts'),
        ethers.encodeBytes32String('solidity'),
        ethers.encodeBytes32String('security'),
    ];
    const minFee = ethers.parseEther('50'); // 50 CLGR per job
    const operator = wallet.address;

    console.log(`📤 Step 2: Registering Agent...`);
    console.log(`   Type: Worker`);
    console.log(`   Capabilities: smart_contracts, solidity, security`);
    console.log(`   Min Fee: ${ethers.formatEther(minFee)} CLGR`);
    console.log(`   Bond: ${ethers.formatEther(minBond)} CLGR`);
    console.log(`   Operator: ${operator}\n`);

    const registerTx = await registry.registerAgent(agentType, capabilities, minFee, minBond, operator);
    console.log(`   Tx: ${registerTx.hash}`);
    console.log(`   🔗 ${MONAD_PRODUCTION.getExplorerLink('tx', registerTx.hash)}\n`);

    console.log('⏳ Waiting for confirmation...');
    const registerReceipt = await registerTx.wait();

    console.log(`✅ Confirmed in block ${registerReceipt!.blockNumber}`);
    console.log(`⛽ Gas used: ${registerReceipt!.gasUsed.toString()}\n`);

    console.log('🎉 Agent Successfully Registered!\n');
    console.log('📊 Next Steps:');
    console.log('   1. Indexer will pick up the event (~10-30 seconds)');
    console.log('   2. Agent will appear in Postgres');
    console.log('   3. Check /api/agents for your agent');
    console.log('   4. View at http://localhost:3000/claws\n');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
