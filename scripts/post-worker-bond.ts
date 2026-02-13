/**
 * Post Worker Bond Script
 * 
 * Worker approves and posts bond for a task.
 */

import { config } from 'dotenv';
config();

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const MANAGER_ABI = [
    'function postWorkerBond(uint256 taskId) external',
    'function tasks(uint256) external view returns (uint256 id, uint256 proposalId, address worker, address verifier, uint256 escrow, uint256 workerBond, uint8 status, bool settled, uint256 createdAt, uint256 completedAt)',
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
];

async function main() {
    const taskId = process.argv[2];

    if (!taskId) {
        console.error('Usage: npx ts-node scripts/post-worker-bond.ts <taskId>');
        console.error('Example: npx ts-node scripts/post-worker-bond.ts 1');
        process.exit(1);
    }

    console.log('💰 Post Worker Bond');
    console.log('===================');
    console.log(`Task ID: ${taskId}`);

    // Setup provider and contracts
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const workerWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, workerWallet);
    const clgr = new ethers.Contract(MONAD_PRODUCTION.contracts.CLGR_TOKEN, ERC20_ABI, workerWallet);

    console.log(`\n👷 Worker Address: ${workerWallet.address}`);

    // Get task details
    console.log('\n📋 Fetching task details...');
    const task = await manager.tasks(taskId);
    const workerBond = task.workerBond;

    console.log(`   Worker Bond Required: ${ethers.formatEther(workerBond)} CLGR`);
    console.log(`   Task Status: ${task.status}`);

    // Check balance
    const balance = await clgr.balanceOf(workerWallet.address);
    console.log(`\n💵 Worker Balance: ${ethers.formatEther(balance)} CLGR`);

    if (balance < workerBond) {
        console.error(`❌ Insufficient balance! Need ${ethers.formatEther(workerBond)} CLGR`);
        process.exit(1);
    }

    // Check allowance
    const allowance = await clgr.allowance(workerWallet.address, MONAD_PRODUCTION.contracts.CLAWGER_MANAGER);
    console.log(`   Current Allowance: ${ethers.formatEther(allowance)} CLGR`);

    if (allowance < workerBond) {
        console.log('\n🔓 Approving CLGR...');
        const approveTx = await clgr.approve(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, workerBond);
        console.log(`   TX Hash: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('   ✅ Approved!');
    }

    // Post bond
    console.log('\n📤 Posting worker bond...');
    const tx = await manager.postWorkerBond(taskId);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log('   ⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`\n✅ Bond posted in block ${receipt!.blockNumber}`);

    console.log('\n✅ Done!');
}

main().catch(console.error);
