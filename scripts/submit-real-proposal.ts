#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = 'https://rpc.monad.xyz';
const CLAWGER_MANAGER = '0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D';
const CLGR_TOKEN = '0x1F81fBE23B357B84a065Eb2898dBF087815c7777';
const PRIVATE_KEY = process.env.CLAWGER_PRIVATE_KEY!;

const MANAGER_ABI = [
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external returns (uint256)',
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 escrow, uint256 deadline)',
];

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

async function main() {
    console.log('🚀 Submitting REAL Proposal to Monad Mainnet\n');

    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const manager = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, wallet);
    const clgr = new ethers.Contract(CLGR_TOKEN, ERC20_ABI, wallet);

    const objective = `Build autonomous agent reputation system with on-chain verification - ${Date.now()}`;
    const escrowAmount = ethers.parseEther('1');
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const PROPOSAL_BOND = ethers.parseEther('100');
    const totalRequired = escrowAmount + PROPOSAL_BOND;

    console.log(`📝 Objective: "${objective}"`);
    console.log(`💰 Escrow: ${ethers.formatEther(escrowAmount)} CLGR`);
    console.log(`🔒 Bond: ${ethers.formatEther(PROPOSAL_BOND)} CLGR`);
    console.log(`💵 Total: ${ethers.formatEther(totalRequired)} CLGR`);
    console.log(`⏰ Deadline: ${new Date(deadline * 1000).toISOString()}\n`);

    // Check balance
    const balance = await clgr.balanceOf(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} CLGR`);
    if (balance < totalRequired) {
        console.error(`❌ Insufficient balance! Need ${ethers.formatEther(totalRequired)} CLGR`);
        process.exit(1);
    }

    // Check and set allowance
    const currentAllowance = await clgr.allowance(wallet.address, CLAWGER_MANAGER);
    console.log(`Current allowance: ${ethers.formatEther(currentAllowance)} CLGR`);

    if (currentAllowance < totalRequired) {
        console.log(`\n📝 Approving ${ethers.formatEther(totalRequired)} CLGR...`);
        const approveTx = await clgr.approve(CLAWGER_MANAGER, totalRequired);
        console.log(`   TX: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`   ✅ Approved!\n`);
    } else {
        console.log(`✅ Allowance sufficient\n`);
    }

    // Submit proposal
    console.log('📤 Submitting proposal...');
    const tx = await manager.submitProposal(objective, escrowAmount, deadline);
    console.log(`   TX: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt?.blockNumber}\n`);

    // Parse event
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
        const proposalId = event.args[0].toString();
        console.log(`\n🎉 SUCCESS!`);
        console.log(`📋 Proposal ID: ${proposalId}`);
        console.log(`🔗 TX: ${tx.hash}`);
        console.log(`📦 Block: ${receipt?.blockNumber}`);
        console.log(`\n⏳ Wait 30s for indexer, then verify:`);
        console.log(`   psql $DATABASE_URL -c "SELECT * FROM proposals WHERE id = '${proposalId}'"`);
    }
}

main().catch(console.error);
