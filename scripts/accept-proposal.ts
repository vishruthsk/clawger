/**
 * Accept Proposal Script
 * 
 * Uses CLAWGER private key to sign EIP-712 AcceptProposal message
 * and submit it to the contract (gasless for CLAWGER).
 */

import { config } from 'dotenv';
config();

import { ethers } from 'ethers';
import { MONAD_PRODUCTION } from '../config/monad-production';

const MANAGER_ABI = [
    'function acceptProposalWithSignature(uint256 proposalId, address worker, address verifier, uint256 workerBond, uint256 deadline, bytes calldata signature) external returns (uint256)',
    'function getDomainSeparator() external view returns (bytes32)',
    'function getAcceptProposalHash(uint256 proposalId, address worker, address verifier, uint256 workerBond, uint256 deadline) external view returns (bytes32)',
];

async function main() {
    const proposalId = process.argv[2];
    const worker = process.argv[3];
    const verifier = process.argv[4];
    const workerBond = process.argv[5] || ethers.parseEther('1').toString(); // Default 1 CLGR

    if (!proposalId || !worker || !verifier) {
        console.error('Usage: npx ts-node scripts/accept-proposal.ts <proposalId> <worker> <verifier> [workerBond]');
        console.error('Example: npx ts-node scripts/accept-proposal.ts 4 0x123... 0x456... 1000000000000000000');
        process.exit(1);
    }

    console.log('🎯 CLAWGER Accept Proposal');
    console.log('========================');
    console.log(`Proposal ID: ${proposalId}`);
    console.log(`Worker: ${worker}`);
    console.log(`Verifier: ${verifier}`);
    console.log(`Worker Bond: ${ethers.formatEther(workerBond)} CLGR`);

    // Setup provider and contracts
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const clawgerWallet = new ethers.Wallet(process.env.CLAWGER_PRIVATE_KEY!, provider);
    const relayerWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider); // Relayer pays gas

    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, relayerWallet);

    console.log(`\n📝 CLAWGER Address: ${clawgerWallet.address}`);
    console.log(`📡 Relayer Address: ${relayerWallet.address}`);

    // Create EIP-712 signature
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const domain = {
        name: 'ClawgerManagerV4',
        version: '1',
        chainId: 143, // Monad mainnet
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
        worker,
        verifier,
        workerBond: BigInt(workerBond),
        deadline: BigInt(deadline),
    };

    console.log('\n🔐 Signing EIP-712 message...');
    const signature = await clawgerWallet.signTypedData(domain, types, value);
    console.log(`✅ Signature: ${signature}`);

    // Submit transaction (relayer pays gas)
    console.log('\n📤 Submitting transaction...');
    const tx = await manager.acceptProposalWithSignature(
        proposalId,
        worker,
        verifier,
        workerBond,
        deadline,
        signature
    );

    console.log(`⏳ TX Hash: ${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`\n✅ Transaction confirmed in block ${receipt!.blockNumber}`);

    // Parse events to get taskId
    const acceptedEvent = receipt!.logs
        .map(log => {
            try {
                return manager.interface.parseLog({ topics: log.topics as string[], data: log.data });
            } catch {
                return null;
            }
        })
        .find(event => event?.name === 'ProposalAccepted');

    if (acceptedEvent) {
        console.log(`\n🎉 PROPOSAL ACCEPTED!`);
        console.log(`   Task ID: ${acceptedEvent.args.taskId}`);
        console.log(`   Worker: ${acceptedEvent.args.worker}`);
        console.log(`   Verifier: ${acceptedEvent.args.verifier}`);
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
