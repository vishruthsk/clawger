/**
 * End-to-End Worker Earning Lifecycle
 * 
 * Executes the complete flow for Proposal ID 4:
 * 1. Accept proposal
 * 2. Post worker bond
 * 3. Start task
 * 4. Submit work
 * 5. Verify task (success)
 */

import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '../.env') });

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';
import { Pool } from 'pg';

const MANAGER_ABI = [
    'function acceptProposalWithSignature(uint256 proposalId, address worker, address verifier, uint256 workerBond, uint256 deadline, bytes calldata signature) external returns (uint256)',
    'function postWorkerBond(uint256 taskId) external',
    'function startTask(uint256 taskId) external',
    'function submitWork(uint256 taskId) external',
    'function verifyTask(uint256 taskId, bool success) external',
    'function tasks(uint256) external view returns (uint256 id, uint256 proposalId, address worker, address verifier, uint256 escrow, uint256 workerBond, uint8 status, bool settled, uint256 createdAt, uint256 completedAt)',
    'event ProposalAccepted(uint256 indexed proposalId, uint256 indexed taskId, address indexed worker, address verifier)',
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
];

const REGISTRY_ABI = [
    'function getReputation(address agent) external view returns (uint256)',
];

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const proposalId = process.argv[2] || '4';

    console.log('🚀 CLAWGER Worker Earning Lifecycle - END TO END');
    console.log('================================================\n');
    console.log(`Proposal ID: ${proposalId}\n`);

    // Setup
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const clawgerWallet = new ethers.Wallet(process.env.CLAWGER_PRIVATE_KEY!, provider);
    const workerWallet = new ethers.Wallet(process.env.PRIVATE_KEY || process.env.CLAWGER_PRIVATE_KEY!, provider);
    const verifierWallet = workerWallet; // Same for demo

    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, workerWallet);
    const clgr = new ethers.Contract(MONAD_PRODUCTION.contracts.CLGR_TOKEN, ERC20_ABI, workerWallet);
    const registry = new ethers.Contract(MONAD_PRODUCTION.contracts.AGENT_REGISTRY, REGISTRY_ABI, provider);

    console.log(`📝 CLAWGER: ${clawgerWallet.address}`);
    console.log(`👷 Worker: ${workerWallet.address}`);
    console.log(`🔍 Verifier: ${verifierWallet.address}\n`);

    // Get initial state
    const workerBalanceInitial = await clgr.balanceOf(workerWallet.address);
    const workerReputationInitial = await registry.getReputation(workerWallet.address);

    console.log(`📊 Initial State:`);
    console.log(`   Worker Balance: ${ethers.formatEther(workerBalanceInitial)} CLGR`);
    console.log(`   Worker Reputation: ${workerReputationInitial}\n`);

    // ========================================
    // STEP 1: Accept Proposal
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Accept Proposal');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const workerBond = ethers.parseEther('1'); // 1 CLGR
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const domain = {
        name: 'ClawgerManagerV4',
        version: '1',
        chainId: 143,
        verifyingContract: MONAD_PRODUCTION.contracts.CLAWGER_MANAGER,
    };

    const types = {
        AcceptProposal: [
            { name: 'proposalId', type: 'uint256' },
            { name: 'worker', type: 'address' },
            { name: 'verifier', type: 'address' },
            { name: 'workerBond', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };

    const value = {
        proposalId: BigInt(proposalId),
        worker: workerWallet.address,
        verifier: verifierWallet.address,
        workerBond,
        deadline: BigInt(deadline),
    };

    console.log('🔐 Signing EIP-712 message...');
    const signature = await clawgerWallet.signTypedData(domain, types, value);

    console.log('📤 Submitting acceptProposalWithSignature...');
    const acceptTx = await manager.acceptProposalWithSignature(
        proposalId,
        workerWallet.address,
        verifierWallet.address,
        workerBond,
        deadline,
        signature
    );

    console.log(`   TX: ${acceptTx.hash}`);
    const acceptReceipt = await acceptTx.wait();

    const acceptedEvent = acceptReceipt!.logs
        .map((log: any) => {
            try {
                return manager.interface.parseLog({ topics: log.topics as string[], data: log.data });
            } catch {
                return null;
            }
        })
        .find((event: any) => event?.name === 'ProposalAccepted');

    const taskId = acceptedEvent!.args.taskId;
    console.log(`✅ Proposal accepted! Task ID: ${taskId}\n`);

    await sleep(2000); // Wait for indexer

    // ========================================
    // STEP 2: Post Worker Bond
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Post Worker Bond');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔓 Approving CLGR...');
    const approveTx = await clgr.approve(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, workerBond);
    await approveTx.wait();
    console.log('   ✅ Approved!');

    console.log('📤 Posting worker bond...');
    const bondTx = await manager.postWorkerBond(taskId);
    console.log(`   TX: ${bondTx.hash}`);
    await bondTx.wait();
    console.log(`✅ Bond posted!\n`);

    await sleep(2000);

    // ========================================
    // STEP 3: Start Task
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Start Task');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📤 Starting task...');
    const startTx = await manager.startTask(taskId);
    console.log(`   TX: ${startTx.hash}`);
    await startTx.wait();
    console.log(`✅ Task started!\n`);

    await sleep(2000);

    // ========================================
    // STEP 4: Submit Work
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Submit Work');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📤 Submitting work...');
    const submitTx = await manager.submitWork(taskId);
    console.log(`   TX: ${submitTx.hash}`);
    await submitTx.wait();
    console.log(`✅ Work submitted!\n`);

    await sleep(2000);

    // ========================================
    // STEP 5: Verify Task (Success)
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 5: Verify Task (Success)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const task = await manager.tasks(taskId);
    const expectedPayout = task.escrow + task.workerBond;

    console.log(`📋 Task Details:`);
    console.log(`   Escrow: ${ethers.formatEther(task.escrow)} CLGR`);
    console.log(`   Worker Bond: ${ethers.formatEther(task.workerBond)} CLGR`);
    console.log(`   Expected Payout: ${ethers.formatEther(expectedPayout)} CLGR\n`);

    console.log('📤 Verifying task (SUCCESS)...');
    const verifyTx = await manager.verifyTask(taskId, true);
    console.log(`   TX: ${verifyTx.hash}`);
    await verifyTx.wait();
    console.log(`✅ Task verified!\n`);

    await sleep(2000);

    // ========================================
    // FINAL STATE
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FINAL STATE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const workerBalanceFinal = await clgr.balanceOf(workerWallet.address);
    const workerReputationFinal = await registry.getReputation(workerWallet.address);

    const balanceChange = workerBalanceFinal - workerBalanceInitial;
    const reputationChange = Number(workerReputationFinal) - Number(workerReputationInitial);

    console.log(`📊 Worker Final State:`);
    console.log(`   Balance: ${ethers.formatEther(workerBalanceFinal)} CLGR`);
    console.log(`   Reputation: ${workerReputationFinal}\n`);

    console.log(`📈 Changes:`);
    console.log(`   Balance: ${balanceChange >= 0 ? '+' : ''}${ethers.formatEther(balanceChange)} CLGR`);
    console.log(`   Reputation: ${reputationChange >= 0 ? '+' : ''}${reputationChange}\n`);

    // Check database
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DATABASE VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const dbTask = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId.toString()]);
    if (dbTask.rows.length > 0) {
        console.log(`✅ Task found in database:`);
        console.log(`   Status: ${dbTask.rows[0].status}`);
        console.log(`   Settled: ${dbTask.rows[0].settled}`);
        console.log(`   Worker: ${dbTask.rows[0].worker}`);
        console.log(`   Verifier: ${dbTask.rows[0].verifier}\n`);
    } else {
        console.log(`❌ Task NOT found in database (indexer may be behind)\n`);
    }

    // ========================================
    // SUCCESS CRITERIA
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUCCESS CRITERIA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const checks = [
        { name: 'Worker received payout', pass: balanceChange === expectedPayout },
        { name: 'Reputation increased by 5', pass: reputationChange === 5 },
        { name: 'Task in database', pass: dbTask.rows.length > 0 },
        { name: 'Task status = verified', pass: dbTask.rows[0]?.status === 'verified' },
        { name: 'Task settled = true', pass: dbTask.rows[0]?.settled === true },
    ];

    checks.forEach(check => {
        console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every(c => c.pass);
    console.log(`\n${allPassed ? '🎉 ALL CHECKS PASSED!' : '⚠️  SOME CHECKS FAILED'}\n`);

    await pool.end();
}

main().catch(console.error);
