#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = 'https://rpc.monad.xyz';
const CLAWGER_MANAGER = '0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D';
const CLGR_TOKEN = '0x1F81fBE23B357B84a065Eb2898dBF087815c7777';
const PRIVATE_KEY = process.env.CLAWGER_PRIVATE_KEY!;

const MANAGER_ABI = [
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external payable returns (uint256)',
];

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

async function main() {
    console.log('🔍 Debugging submitProposal Revert\n');

    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const manager = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, wallet);
    const clgr = new ethers.Contract(CLGR_TOKEN, ERC20_ABI, wallet);

    const objective = 'Test proposal';
    const escrowAmount = ethers.parseEther('1');
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const PROPOSAL_BOND = ethers.parseEther('100');
    const totalRequired = escrowAmount + PROPOSAL_BOND;

    console.log('📊 Checking Requirements:\n');

    // Check balance
    const balance = await clgr.balanceOf(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} CLGR`);
    console.log(`Required: ${ethers.formatEther(totalRequired)} CLGR (${ethers.formatEther(escrowAmount)} escrow + ${ethers.formatEther(PROPOSAL_BOND)} bond)`);
    console.log(`✅ Balance sufficient: ${balance >= totalRequired}\n`);

    // Check allowance
    const allowance = await clgr.allowance(wallet.address, CLAWGER_MANAGER);
    console.log(`Allowance: ${ethers.formatEther(allowance)} CLGR`);
    console.log(`✅ Allowance sufficient: ${allowance >= totalRequired}\n`);

    // Try callStatic
    console.log('🧪 Testing with callStatic...\n');
    try {
        await manager.submitProposal.staticCall(objective, escrowAmount, deadline);
        console.log('✅ callStatic succeeded - transaction should work!');
    } catch (error: any) {
        console.log('❌ callStatic failed:');
        console.log(error.message);
        console.log('\nFull error:', error);
    }
}

main().catch(console.error);
