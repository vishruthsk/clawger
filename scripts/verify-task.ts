/**
 * Verify Task Script
 * 
 * Verifier verifies task and triggers settlement.
 */

import { config } from 'dotenv';
config();

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const MANAGER_ABI = [
    'function verifyTask(uint256 taskId, bool success) external',
    'function tasks(uint256) external view returns (uint256 id, uint256 proposalId, address worker, address verifier, uint256 escrow, uint256 workerBond, uint8 status, bool settled, uint256 createdAt, uint256 completedAt)',
];

const ERC20_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
];

const REGISTRY_ABI = [
    'function getReputation(address agent) external view returns (uint256)',
];

async function main() {
    const taskId = process.argv[2];
    const success = process.argv[3] !== 'false'; // Default to true unless explicitly 'false'

    if (!taskId) {
        console.error('Usage: npx ts-node scripts/verify-task.ts <taskId> [success]');
        console.error('Example: npx ts-node scripts/verify-task.ts 1 true');
        console.error('Example: npx ts-node scripts/verify-task.ts 1 false');
        process.exit(1);
    }

    console.log('✅ Verify Task');
    console.log('==============');
    console.log(`Task ID: ${taskId}`);
    console.log(`Success: ${success}`);

    // Setup provider and contracts
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const verifierWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, verifierWallet);
    const clgr = new ethers.Contract(MONAD_PRODUCTION.contracts.CLGR_TOKEN, ERC20_ABI, provider);
    const registry = new ethers.Contract(MONAD_PRODUCTION.contracts.AGENT_REGISTRY, REGISTRY_ABI, provider);

    console.log(`\n🔍 Verifier Address: ${verifierWallet.address}`);

    // Get task details
    console.log('\n📋 Fetching task details...');
    const task = await manager.tasks(taskId);
    console.log(`   Task Status: ${task.status}`);
    console.log(`   Worker: ${task.worker}`);
    console.log(`   Verifier: ${task.verifier}`);
    console.log(`   Escrow: ${ethers.formatEther(task.escrow)} CLGR`);
    console.log(`   Worker Bond: ${ethers.formatEther(task.workerBond)} CLGR`);

    // Get worker's current state
    const workerBalanceBefore = await clgr.balanceOf(task.worker);
    const workerReputationBefore = await registry.getReputation(task.worker);

    console.log(`\n📊 Worker State Before:`);
    console.log(`   Balance: ${ethers.formatEther(workerBalanceBefore)} CLGR`);
    console.log(`   Reputation: ${workerReputationBefore}`);

    // Verify task
    console.log(`\n📤 Verifying task (${success ? 'SUCCESS' : 'FAILURE'})...`);
    const tx = await manager.verifyTask(taskId, success);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log('   ⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`\n✅ Task verified in block ${receipt!.blockNumber}`);

    // Get worker's new state
    const workerBalanceAfter = await clgr.balanceOf(task.worker);
    const workerReputationAfter = await registry.getReputation(task.worker);

    console.log(`\n📊 Worker State After:`);
    console.log(`   Balance: ${ethers.formatEther(workerBalanceAfter)} CLGR`);
    console.log(`   Reputation: ${workerReputationAfter}`);

    const balanceChange = workerBalanceAfter - workerBalanceBefore;
    const reputationChange = Number(workerReputationAfter) - Number(workerReputationBefore);

    console.log(`\n📈 Changes:`);
    console.log(`   Balance: ${balanceChange >= 0 ? '+' : ''}${ethers.formatEther(balanceChange)} CLGR`);
    console.log(`   Reputation: ${reputationChange >= 0 ? '+' : ''}${reputationChange}`);

    if (success) {
        const expectedPayout = task.escrow + task.workerBond;
        console.log(`\n✅ Expected payout: ${ethers.formatEther(expectedPayout)} CLGR`);
        console.log(`   Actual payout: ${ethers.formatEther(balanceChange)} CLGR`);
        console.log(`   Match: ${balanceChange === expectedPayout ? '✅' : '❌'}`);
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
