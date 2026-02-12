import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * CLAWGER Full Economic Lifecycle Demo on Monad Mainnet
 * 
 * This script proves the complete CLAWGER economy works end-to-end:
 * 1. Register worker + verifier agents
 * 2. Approve CLGR tokens
 * 3. Submit proposal with escrow
 * 4. Generate EIP-712 signature for acceptance
 * 5. Accept proposal (creates task)
 * 6. Worker posts bond
 * 7. Worker starts and completes task
 * 8. Verifier verifies success
 * 9. Assert worker receives payout + reputation increase
 */

// Deployed contract addresses on Monad Mainnet
const MONAD_ADDRESSES = {
    CLGR_TOKEN: '0x1F81fBE23B357B84a065Eb2898dBF087815c7777',
    AGENT_REGISTRY: '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36',
    CLAWGER_MANAGER: '0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D',
};

// CLAWGER operator address (signs accept/reject)
const CLAWGER_OPERATOR = '0x08143c39150d9f4326d3124E2Bea8308292A62A8';

// Test amounts
const ESCROW_AMOUNT = ethers.parseEther('50'); // 50 CLGR
const WORKER_BOND = ethers.parseEther('10'); // 10 CLGR
const PROPOSAL_BOND = ethers.parseEther('100'); // 100 CLGR (constant in contract)

// ABIs
const CLGR_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

const REGISTRY_ABI = [
    'function registerAgent(uint8 agentType, bytes32[] capabilities, uint256 minFee, uint256 minBond, address operator)',
    'function getAgent(address agent) view returns (tuple(address wallet, uint8 agentType, bytes32[] capabilities, uint256 minFee, uint256 minBond, address operator, uint256 reputation, bool active, bool exists, uint256 registeredAt, uint256 updatedAt))',
    'function getReputation(address agent) view returns (uint256)',
];

const MANAGER_ABI = [
    'function submitProposal(string objective, uint256 escrowAmount, uint256 deadline) returns (uint256)',
    'function acceptProposalWithSignature(uint256 proposalId, address worker, address verifier, uint256 workerBond, uint256 deadline, bytes signature) returns (uint256)',
    'function postWorkerBond(uint256 taskId)',
    'function startTask(uint256 taskId)',
    'function submitWork(uint256 taskId)',
    'function verifyTask(uint256 taskId, bool success)',
    'function proposals(uint256) view returns (uint256 id, address proposer, string objective, uint256 escrow, uint256 deadline, uint8 status, uint256 createdAt)',
    'function tasks(uint256) view returns (uint256 id, uint256 proposalId, address worker, address verifier, uint256 escrow, uint256 workerBond, uint8 status, bool settled, uint256 createdAt, uint256 completedAt)',
    'function getDomainSeparator() view returns (bytes32)',
    'function ACCEPT_PROPOSAL_TYPEHASH() view returns (bytes32)',
];

async function main() {
    console.log('🚀 CLAWGER Full Economic Lifecycle Demo on Monad Mainnet\n');
    console.log('============================================================');
    console.log('Deployed Addresses:');
    console.log(`  CLGR Token:       ${MONAD_ADDRESSES.CLGR_TOKEN}`);
    console.log(`  AgentRegistry:    ${MONAD_ADDRESSES.AGENT_REGISTRY}`);
    console.log(`  ClawgerManager:   ${MONAD_ADDRESSES.CLAWGER_MANAGER}`);
    console.log(`  CLAWGER Operator: ${CLAWGER_OPERATOR}`);
    console.log('============================================================\n');

    // Get signers - use deployer for all roles in this demo
    const signers = await ethers.getSigners();

    if (signers.length === 0) {
        throw new Error('No signers available. Make sure CLAWGER_PRIVATE_KEY is set in .env');
    }

    const deployer = signers[0];

    // For demo purposes, use the same wallet for all roles
    // In production, these would be different wallets
    const proposer = deployer;
    const worker = deployer;
    const verifier = deployer;

    console.log('Accounts (using single wallet for demo):');
    console.log(`  Deployer/All:  ${deployer.address}\n`);

    console.log('⚠️  Note: Using single wallet for proposer, worker, and verifier roles');
    console.log('    In production, these would be separate wallets.\n');

    // Connect to contracts
    const clgr = await ethers.getContractAt(CLGR_ABI, MONAD_ADDRESSES.CLGR_TOKEN);
    const registry = await ethers.getContractAt(REGISTRY_ABI, MONAD_ADDRESSES.AGENT_REGISTRY);
    const manager = await ethers.getContractAt(MANAGER_ABI, MONAD_ADDRESSES.CLAWGER_MANAGER);

    // ============================================================
    // STEP 1: Register Worker + Verifier
    // ============================================================
    console.log('📝 STEP 1: Registering Agents\n');

    // Try to register worker (will skip if already registered)
    try {
        console.log('Registering worker...');
        const workerCapabilities = [ethers.id('coding')];
        const tx1 = await registry.connect(worker).registerAgent(
            0, // AgentType.Worker
            workerCapabilities,
            ethers.parseEther('5'), // minFee: 5 CLGR
            ethers.parseEther('10'), // minBond: 10 CLGR
            worker.address // operator: self
        );
        await tx1.wait();
        console.log(`✅ Worker registered: ${worker.address}`);
    } catch (error: any) {
        if (error.message.includes('Already active')) {
            console.log(`✅ Worker already registered: ${worker.address}`);
        } else {
            console.log(`⚠️  Worker registration skipped: ${error.message}`);
        }
    }

    // Try to register verifier (will skip if already registered)
    try {
        console.log('Registering verifier...');
        const verifierCapabilities = [ethers.id('verification')];
        const tx2 = await registry.connect(verifier).registerAgent(
            1, // AgentType.Verifier
            verifierCapabilities,
            ethers.parseEther('2'), // minFee: 2 CLGR
            ethers.parseEther('5'), // minBond: 5 CLGR
            verifier.address // operator: self
        );
        await tx2.wait();
        console.log(`✅ Verifier registered: ${verifier.address}\n`);
    } catch (error: any) {
        if (error.message.includes('Already active')) {
            console.log(`✅ Verifier already registered: ${verifier.address}\n`);
        } else {
            console.log(`⚠️  Verifier registration skipped: ${error.message}\n`);
        }
    }

    // ============================================================
    // STEP 2: Check CLGR Balances & Approve
    // ============================================================
    console.log('💰 STEP 2: CLGR Token Setup\n');

    const proposerBalance = await clgr.balanceOf(proposer.address);
    const workerBalance = await clgr.balanceOf(worker.address);

    console.log(`Proposer CLGR balance: ${ethers.formatEther(proposerBalance)} CLGR`);
    console.log(`Worker CLGR balance:   ${ethers.formatEther(workerBalance)} CLGR\n`);

    const requiredProposerBalance = ESCROW_AMOUNT + PROPOSAL_BOND;
    if (proposerBalance < requiredProposerBalance) {
        throw new Error(`Proposer needs ${ethers.formatEther(requiredProposerBalance)} CLGR but has ${ethers.formatEther(proposerBalance)}`);
    }

    if (workerBalance < WORKER_BOND) {
        throw new Error(`Worker needs ${ethers.formatEther(WORKER_BOND)} CLGR but has ${ethers.formatEther(workerBalance)}`);
    }

    // Approve Manager to spend CLGR
    // Since we're using the same wallet for all roles, approve the total amount needed
    const totalApprovalNeeded = requiredProposerBalance + WORKER_BOND; // 150 + 10 = 160 CLGR

    console.log('Approving CLGR for Manager...');
    console.log(`Total approval needed: ${ethers.formatEther(totalApprovalNeeded)} CLGR`);

    const approveTx = await clgr.connect(deployer).approve(MONAD_ADDRESSES.CLAWGER_MANAGER, totalApprovalNeeded);
    await approveTx.wait();
    console.log(`✅ Approved ${ethers.formatEther(totalApprovalNeeded)} CLGR for Manager`);

    // Wait a bit for approval to be fully processed
    console.log('Waiting for approval to be mined...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify allowance
    const allowance = await clgr.allowance(deployer.address, MONAD_ADDRESSES.CLAWGER_MANAGER);
    console.log(`Verified allowance: ${ethers.formatEther(allowance)} CLGR\n`);

    // ============================================================
    // STEP 3: Submit Proposal
    // ============================================================
    console.log('📋 STEP 3: Submitting Proposal\n');

    const objective = 'Build a TypeScript SDK for CLAWGER smart contracts';
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

    console.log(`Objective: "${objective}"`);
    console.log(`Escrow:    ${ethers.formatEther(ESCROW_AMOUNT)} CLGR`);
    console.log(`Deadline:  ${new Date(deadline * 1000).toISOString()}\n`);

    const submitTx = await manager.connect(proposer).submitProposal(
        objective,
        ESCROW_AMOUNT,
        deadline
    );
    const submitReceipt = await submitTx.wait();

    // Get proposalId from event
    const proposalEvent = submitReceipt?.logs.find((log: any) => {
        try {
            const parsed = manager.interface.parseLog(log);
            return parsed?.name === 'ProposalSubmitted';
        } catch {
            return false;
        }
    });

    const proposalId = proposalEvent ? manager.interface.parseLog(proposalEvent)?.args[0] : 1n;
    console.log(`✅ Proposal submitted! ID: ${proposalId}\n`);

    // ============================================================
    // STEP 4: Generate EIP-712 Signature (CLAWGER Operator)
    // ============================================================
    console.log('✍️  STEP 4: Generating EIP-712 Signature\n');

    // Get domain separator and typehash
    const domainSeparator = await manager.getDomainSeparator();
    const typeHash = await manager.ACCEPT_PROPOSAL_TYPEHASH();

    console.log(`Domain Separator: ${domainSeparator}`);
    console.log(`Type Hash:        ${typeHash}\n`);

    // EIP-712 domain
    const domain = {
        name: 'ClawgerManagerV4',
        version: '1',
        chainId: 143, // Monad (actual chain ID)
        verifyingContract: MONAD_ADDRESSES.CLAWGER_MANAGER,
    };

    // EIP-712 types
    const types = {
        AcceptProposal: [
            { name: 'proposalId', type: 'uint256' },
            { name: 'worker', type: 'address' },
            { name: 'verifier', type: 'address' },
            { name: 'workerBond', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    };

    // Message to sign
    const signatureDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const message = {
        proposalId: proposalId,
        worker: worker.address,
        verifier: verifier.address,
        workerBond: WORKER_BOND,
        deadline: signatureDeadline,
    };

    console.log('Signing message:');
    console.log(`  proposalId:  ${message.proposalId}`);
    console.log(`  worker:      ${message.worker}`);
    console.log(`  verifier:    ${message.verifier}`);
    console.log(`  workerBond:  ${ethers.formatEther(message.workerBond)} CLGR`);
    console.log(`  deadline:    ${new Date(message.deadline * 1000).toISOString()}\n`);

    // Sign with deployer (acting as CLAWGER operator)
    const signature = await deployer.signTypedData(domain, types, message);
    console.log(`✅ Signature generated: ${signature}\n`);

    // ============================================================
    // STEP 5: Accept Proposal with Signature
    // ============================================================
    console.log('✅ STEP 5: Accepting Proposal (Gasless)\n');

    const acceptTx = await manager.connect(proposer).acceptProposalWithSignature(
        proposalId,
        worker.address,
        verifier.address,
        WORKER_BOND,
        signatureDeadline,
        signature
    );
    const acceptReceipt = await acceptTx.wait();

    // Get taskId from event
    const acceptEvent = acceptReceipt?.logs.find((log: any) => {
        try {
            const parsed = manager.interface.parseLog(log);
            return parsed?.name === 'ProposalAccepted';
        } catch {
            return false;
        }
    });

    const taskId = acceptEvent ? manager.interface.parseLog(acceptEvent)?.args[1] : 1n;
    console.log(`✅ Proposal accepted! Task ID: ${taskId}\n`);

    // ============================================================
    // STEP 6: Worker Posts Bond
    // ============================================================
    console.log('🔒 STEP 6: Posting Worker Bond\n');

    const bondTx = await manager.connect(worker).postWorkerBond(taskId);
    await bondTx.wait();
    console.log(`✅ Worker bond posted: ${ethers.formatEther(WORKER_BOND)} CLGR\n`);

    // ============================================================
    // STEP 7: Worker Starts & Completes Task
    // ============================================================
    console.log('⚙️  STEP 7: Task Execution\n');

    const startTx = await manager.connect(worker).startTask(taskId);
    await startTx.wait();
    console.log('✅ Task started');

    const submitTx2 = await manager.connect(worker).submitWork(taskId);
    await submitTx2.wait();
    console.log('✅ Work submitted\n');

    // ============================================================
    // STEP 8: Get Initial Balances & Reputation
    // ============================================================
    console.log('📊 STEP 8: Pre-Verification State\n');

    const workerBalanceBefore = await clgr.balanceOf(worker.address);
    const workerRepBefore = await registry.getReputation(worker.address);

    console.log(`Worker CLGR balance: ${ethers.formatEther(workerBalanceBefore)} CLGR`);
    console.log(`Worker reputation:   ${workerRepBefore}\n`);

    // ============================================================
    // STEP 9: Verifier Verifies Success
    // ============================================================
    console.log('🔍 STEP 9: Verification & Settlement\n');

    const verifyTx = await manager.connect(verifier).verifyTask(taskId, true); // success = true
    await verifyTx.wait();
    console.log('✅ Task verified as SUCCESS\n');

    // ============================================================
    // STEP 10: Assert Results
    // ============================================================
    console.log('🎯 STEP 10: Verifying Results\n');

    const workerBalanceAfter = await clgr.balanceOf(worker.address);
    const workerRepAfter = await registry.getReputation(worker.address);

    const expectedPayout = ESCROW_AMOUNT + WORKER_BOND;
    const actualPayout = workerBalanceAfter - workerBalanceBefore;

    console.log('Results:');
    console.log(`  Worker balance before: ${ethers.formatEther(workerBalanceBefore)} CLGR`);
    console.log(`  Worker balance after:  ${ethers.formatEther(workerBalanceAfter)} CLGR`);
    console.log(`  Payout received:       ${ethers.formatEther(actualPayout)} CLGR`);
    console.log(`  Expected payout:       ${ethers.formatEther(expectedPayout)} CLGR`);
    console.log();
    console.log(`  Reputation before:     ${workerRepBefore}`);
    console.log(`  Reputation after:      ${workerRepAfter}`);
    console.log(`  Reputation increase:   +${workerRepAfter - workerRepBefore}\n`);

    // Assertions
    if (actualPayout !== expectedPayout) {
        throw new Error(`❌ Payout mismatch! Expected ${ethers.formatEther(expectedPayout)} but got ${ethers.formatEther(actualPayout)}`);
    }

    if (workerRepAfter <= workerRepBefore) {
        throw new Error(`❌ Reputation did not increase! Before: ${workerRepBefore}, After: ${workerRepAfter}`);
    }

    console.log('============================================================');
    console.log('✅ ALL CHECKS PASSED!');
    console.log('============================================================\n');
    console.log('🎉 CLAWGER economic lifecycle proven on Monad Mainnet!');
    console.log(`   - Worker received full payout: ${ethers.formatEther(expectedPayout)} CLGR`);
    console.log(`   - Reputation increased by: +${workerRepAfter - workerRepBefore}`);
    console.log(`   - Task settled successfully on-chain\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Demo failed:');
        console.error(error);
        process.exit(1);
    });
