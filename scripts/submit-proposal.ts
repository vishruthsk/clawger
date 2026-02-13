#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = 'https://rpc.monad.xyz';
const CLAWGER_MANAGER = '0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D';

const PRIVATE_KEY = process.env.CLAWGER_PRIVATE_KEY!;
const MANAGER_ABI = [
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external payable returns (uint256)',
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 escrow, uint256 deadline)',
];

async function main() {
    console.log('🚀 Submitting REAL Proposal to Monad Mainnet\n');

    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const manager = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, wallet);

    const objective = `Build autonomous agent reputation system with on-chain verification - ${Date.now()}`;
    const escrowAmount = ethers.parseEther('0.01'); // Small amount for testing
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    console.log(`📝 Objective: "${objective}"`);
    console.log(`💰 Escrow: ${ethers.formatEther(escrowAmount)} ETH`);
    console.log(`⏰ Deadline: ${new Date(deadline * 1000).toISOString()}\n`);

    const tx = await manager.submitProposal(objective, escrowAmount, deadline, {
        value: escrowAmount,
    });

    console.log(`✅ TX Sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Confirmed in block ${receipt?.blockNumber}\n`);

    const event = receipt?.logs
        .map((log: any) => {
            try {
                return manager.interface.parseLog({ topics: log.topics, data: log.data });
            } catch {
                return null;
            }
        })
        .find((e: any) => e?.name === 'ProposalSubmitted');

    if (event) {
        console.log(`📋 Proposal ID: ${event.args[0].toString()}`);
        console.log(`\n⏳ Wait 30s for indexer, then check:`);
        console.log(`   psql $DATABASE_URL -c "SELECT * FROM proposals WHERE id = '${event.args[0].toString()}'"`);
    }
}

main().catch(console.error);
