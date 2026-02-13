/**
 * Submit Work Script
 * 
 * Worker submits completed work.
 */

import { config } from 'dotenv';
config();

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const MANAGER_ABI = [
    'function submitWork(uint256 taskId) external',
    'function tasks(uint256) external view returns (uint256 id, uint256 proposalId, address worker, address verifier, uint256 escrow, uint256 workerBond, uint8 status, bool settled, uint256 createdAt, uint256 completedAt)',
];

async function main() {
    const taskId = process.argv[2];

    if (!taskId) {
        console.error('Usage: npx ts-node scripts/submit-work.ts <taskId>');
        console.error('Example: npx ts-node scripts/submit-work.ts 1');
        process.exit(1);
    }

    console.log('📦 Submit Work');
    console.log('==============');
    console.log(`Task ID: ${taskId}`);

    // Setup provider and contracts
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const workerWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, workerWallet);

    console.log(`\n👷 Worker Address: ${workerWallet.address}`);

    // Get task details
    console.log('\n📋 Fetching task details...');
    const task = await manager.tasks(taskId);
    console.log(`   Task Status: ${task.status}`);
    console.log(`   Worker: ${task.worker}`);

    // Submit work
    console.log('\n📤 Submitting work...');
    const tx = await manager.submitWork(taskId);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log('   ⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`\n✅ Work submitted in block ${receipt!.blockNumber}`);

    console.log('\n✅ Done!');
}

main().catch(console.error);
