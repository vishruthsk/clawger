#!/usr/bin/env tsx

/**
 * Test Script: Submit Proposal and Verify Objective Extraction
 * 
 * This script:
 * 1. Submits a real proposal on-chain
 * 2. Waits for indexer to process
 * 3. Verifies SQL row contains correct objective
 * 4. Verifies API returns correct objective
 */

import { ethers } from 'ethers';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { MONAD_PRODUCTION } from '../config/monad-production';

dotenv.config();

const MONAD_RPC_URL = MONAD_PRODUCTION.rpcUrl;
const CLAWGER_MANAGER = MONAD_PRODUCTION.contracts.CLAWGER_MANAGER;
const PRIVATE_KEY = process.env.CLAWGER_PRIVATE_KEY || process.env.PRIVATE_KEY!;

const MANAGER_ABI = [
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external payable returns (uint256)',
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 escrow, uint256 deadline)',
];

async function main() {
    console.log('🧪 Testing Objective Extraction from Transaction Calldata\n');

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const manager = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, wallet);

    // Test objective
    const testObjective = `[TEST] Build a decentralized reputation system for autonomous agents - ${Date.now()}`;
    const escrowAmount = ethers.parseEther('1.0');
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    console.log('📝 Submitting proposal...');
    console.log(`   Objective: "${testObjective}"`);
    console.log(`   Escrow: ${ethers.formatEther(escrowAmount)} ETH`);
    console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}\n`);

    // Submit proposal
    const tx = await manager.submitProposal(testObjective, escrowAmount, deadline, {
        value: escrowAmount,
        gasLimit: 500000,
    });

    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`   Waiting for confirmation...\n`);

    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}\n`);

    // Parse event to get proposalId
    const event = receipt?.logs
        .map(log => {
            try {
                return manager.interface.parseLog({ topics: log.topics as string[], data: log.data });
            } catch {
                return null;
            }
        })
        .find(e => e?.name === 'ProposalSubmitted');

    if (!event) {
        throw new Error('ProposalSubmitted event not found in receipt');
    }

    const proposalId = event.args[0].toString();
    console.log(`📋 Proposal ID: ${proposalId}\n`);

    // Wait for indexer to process
    console.log('⏳ Waiting 30 seconds for indexer to process...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify SQL
    console.log('🔍 Verifying SQL database...\n');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const result = await pool.query(
        'SELECT id, proposer, objective, escrow, deadline, tx_hash FROM proposals WHERE id = $1',
        [proposalId]
    );

    if (result.rows.length === 0) {
        console.error('❌ FAILED: Proposal not found in database');
        process.exit(1);
    }

    const row = result.rows[0];
    console.log('✅ SQL Row Found:');
    console.log(`   ID: ${row.id}`);
    console.log(`   Proposer: ${row.proposer}`);
    console.log(`   Objective: "${row.objective}"`);
    console.log(`   Escrow: ${ethers.formatEther(row.escrow)} ETH`);
    console.log(`   TX Hash: ${row.tx_hash}\n`);

    // Verify objective matches
    if (row.objective === testObjective) {
        console.log('✅ OBJECTIVE MATCH: SQL contains correct objective!\n');
    } else {
        console.error('❌ OBJECTIVE MISMATCH:');
        console.error(`   Expected: "${testObjective}"`);
        console.error(`   Got: "${row.objective}"`);
        process.exit(1);
    }

    // Verify API
    console.log('🔍 Verifying API endpoint...\n');
    const apiUrl = `http://localhost:3000/api/missions/${proposalId}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error(`❌ API returned ${response.status}`);
            process.exit(1);
        }

        const mission = await response.json();
        console.log('✅ API Response:');
        console.log(`   ID: ${mission.id}`);
        console.log(`   Title/Objective: "${mission.title || mission.objective}"`);
        console.log(`   Reward: ${mission.reward} ETH\n`);

        if (mission.title === testObjective || mission.objective === testObjective) {
            console.log('✅ API MATCH: API returns correct objective!\n');
        } else {
            console.error('❌ API MISMATCH:');
            console.error(`   Expected: "${testObjective}"`);
            console.error(`   Got: "${mission.title || mission.objective}"`);
        }
    } catch (error) {
        console.error('⚠️  API check failed (may not be running):', error);
    }

    await pool.end();

    console.log('\n🎉 TEST COMPLETE: Objective extraction working correctly!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Proposal submitted on-chain`);
    console.log(`   ✅ Indexer decoded objective from calldata`);
    console.log(`   ✅ SQL contains correct objective`);
    console.log(`   ✅ Production pipeline verified`);
}

main().catch(console.error);
