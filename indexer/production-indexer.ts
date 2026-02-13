/**
 * CLAWGER Production Event Indexer
 * 
 * Indexes on-chain events from AgentRegistry and ClawgerManager contracts
 * to PostgreSQL for production use.
 * 
 * CRITICAL: Monad RPC enforces ~100 block limit on eth_getLogs
 * We use MAX_LOG_RANGE = 90 to stay safely under the limit
 */

import { config } from 'dotenv';
config({ path: '../.env' }); // Load from parent directory

import { ethers } from 'ethers';
import { Pool } from 'pg';
import { MONAD_PRODUCTION } from '../config/monad-production';

// Monad RPC hard limit: ~100 blocks
// We use 90 to stay safe
const MAX_LOG_RANGE = 90;

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Contract ABIs
const REGISTRY_ABI = [
    'event AgentRegistered(address indexed agent, uint8 indexed agentType, uint256 minFee, uint256 minBond, bytes32[] capabilities)',
];

const MANAGER_ABI = [
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, string objective, uint256 escrow, uint256 deadline)',
];

async function getLastProcessedBlock(contract: 'registry' | 'manager'): Promise<number> {
    const column = contract === 'registry' ? 'last_block_registry' : 'last_block_manager';
    const result = await pool.query(`SELECT ${column} FROM indexer_state WHERE id = 1`);
    const rawValue = result.rows[0]?.[column];

    // CRITICAL: Cast to number - Postgres returns as string!
    const lastBlock = Number(rawValue);

    // If never indexed (0 or NaN), MUST backfill from deployment block
    // NO SKIP LOGIC - we need complete history
    if (!lastBlock || lastBlock === 0 || !Number.isFinite(lastBlock)) {
        const deploymentBlock = contract === 'registry'
            ? MONAD_PRODUCTION.deploymentBlocks.AGENT_REGISTRY
            : MONAD_PRODUCTION.deploymentBlocks.CLAWGER_MANAGER;
        console.log(`[${contract.toUpperCase()}] 🔄 BACKFILL MODE: Starting from deployment block ${deploymentBlock}`);
        return deploymentBlock;
    }

    return Math.floor(lastBlock); // Ensure integer
}

async function updateLastProcessedBlock(contract: 'registry' | 'manager', blockNumber: number): Promise<void> {
    const column = contract === 'registry' ? 'last_block_registry' : 'last_block_manager';
    await pool.query(`UPDATE indexer_state SET ${column} = $1, updated_at = NOW() WHERE id = 1`, [blockNumber]);
}

async function indexAgentRegistered(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { agent, agentType, minFee, minBond, capabilities } = event.args as any;

    console.log(`[AGENT REGISTERED] ${agent} at block ${event.blockNumber} (tx: ${event.transactionHash})`);

    // Note: operator is NOT in the event, we use agent address as operator
    await pool.query(`
        INSERT INTO agents (address, agent_type, capabilities, min_fee, min_bond, operator, reputation, active, registered_at, updated_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (address) DO UPDATE SET
            capabilities = EXCLUDED.capabilities,
            min_fee = EXCLUDED.min_fee,
            min_bond = EXCLUDED.min_bond,
            updated_at = EXCLUDED.updated_at
    `, [
        agent.toLowerCase(),
        agentType === 0 ? 'worker' : 'verifier',
        JSON.stringify(capabilities.map((c: string) => c)),
        minFee.toString(),
        minBond.toString(),
        agent.toLowerCase(), // Use agent address as operator since it's not in the event
        50, // default reputation
        true,
        new Date(block.timestamp * 1000),
        new Date(block.timestamp * 1000),
        event.blockNumber,
        event.transactionHash,
    ]);
}

async function indexProposalSubmitted(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { proposalId, proposer, objective, escrow, deadline } = event.args as any;

    console.log(`[PROPOSAL SUBMITTED] ID ${proposalId} at block ${event.blockNumber} (tx: ${event.transactionHash})`);

    await pool.query(`
        INSERT INTO proposals (id, proposer, objective, escrow, deadline, status, created_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
    `, [
        proposalId.toString(),
        proposer.toLowerCase(),
        objective,
        escrow.toString(),
        new Date(Number(deadline) * 1000),
        'open',
        new Date(block.timestamp * 1000),
        event.blockNumber,
        event.transactionHash,
    ]);
}

async function indexRegistry(provider: ethers.Provider, registry: ethers.Contract): Promise<void> {
    const lastBlock = await getLastProcessedBlock('registry');
    const currentBlock = await provider.getBlockNumber();

    if (lastBlock >= currentBlock) {
        console.log(`[REGISTRY] Already up to date (${lastBlock}/${currentBlock})`);
        return;
    }

    console.log(`[REGISTRY] Indexing from block ${lastBlock + 1} to ${currentBlock}`);

    // Chunk into MAX_LOG_RANGE blocks to respect Monad RPC limits
    for (let fromBlock = lastBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_LOG_RANGE) {
        const toBlock = Math.min(fromBlock + MAX_LOG_RANGE - 1, currentBlock);

        console.log(`[REGISTRY] 🔍 Scanning blocks ${fromBlock} to ${toBlock} (range: ${toBlock - fromBlock + 1})`);

        try {
            // Use explicit typed filter
            const filter = registry.filters.AgentRegistered();
            const events = await registry.queryFilter(filter, fromBlock, toBlock);

            console.log(`[REGISTRY] Found ${events.length} events in this chunk`);

            for (const event of events) {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                    await indexAgentRegistered(event as ethers.EventLog, block);
                }
            }

            await updateLastProcessedBlock('registry', toBlock);
            console.log(`[REGISTRY] ✅ Processed up to block ${toBlock}`);
        } catch (error: any) {
            console.error(`[REGISTRY] ❌ Error scanning blocks ${fromBlock}-${toBlock}:`, error.message);
            throw error; // Re-throw to trigger retry
        }
    }
}

async function indexManager(provider: ethers.Provider, manager: ethers.Contract): Promise<void> {
    const lastBlock = await getLastProcessedBlock('manager');
    const currentBlock = await provider.getBlockNumber();

    if (lastBlock >= currentBlock) {
        console.log(`[MANAGER] Already up to date (${lastBlock}/${currentBlock})`);
        return;
    }

    console.log(`[MANAGER] Indexing from block ${lastBlock + 1} to ${currentBlock}`);

    // Chunk into MAX_LOG_RANGE blocks to respect Monad RPC limits
    for (let fromBlock = lastBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_LOG_RANGE) {
        const toBlock = Math.min(fromBlock + MAX_LOG_RANGE - 1, currentBlock);

        console.log(`[MANAGER] 🔍 Scanning blocks ${fromBlock} to ${toBlock} (range: ${toBlock - fromBlock + 1})`);

        try {
            // Use explicit typed filter
            const filter = manager.filters.ProposalSubmitted();
            const events = await manager.queryFilter(filter, fromBlock, toBlock);

            console.log(`[MANAGER] Found ${events.length} events in this chunk`);

            for (const event of events) {
                const block = await provider.getBlock(event.blockNumber);
                if (block) {
                    await indexProposalSubmitted(event as ethers.EventLog, block);
                }
            }

            await updateLastProcessedBlock('manager', toBlock);
            console.log(`[MANAGER] ✅ Processed up to block ${toBlock}`);
        } catch (error: any) {
            console.error(`[MANAGER] ❌ Error scanning blocks ${fromBlock}-${toBlock}:`, error.message);
            throw error; // Re-throw to trigger retry
        }
    }
}

async function main() {
    console.log('🚀 CLAWGER Production Indexer Starting...');
    console.log(`📡 RPC: ${MONAD_PRODUCTION.rpcUrl}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]}`);
    console.log(`⚙️  MAX_LOG_RANGE: ${MAX_LOG_RANGE} blocks (Monad RPC limit: ~100)`);

    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const registry = new ethers.Contract(MONAD_PRODUCTION.contracts.AGENT_REGISTRY, REGISTRY_ABI, provider);
    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, provider);

    // Test DB connection
    const dbTest = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected at ${dbTest.rows[0].now}`);

    // Index in loop
    while (true) {
        try {
            await indexRegistry(provider, registry);
            await indexManager(provider, manager);

            // Check counts
            const agentCount = await pool.query('SELECT COUNT(*) FROM agents');
            const proposalCount = await pool.query('SELECT COUNT(*) FROM proposals');

            console.log(`\n📊 Current State:`);
            console.log(`   Agents: ${agentCount.rows[0].count}`);
            console.log(`   Proposals: ${proposalCount.rows[0].count}`);
            console.log(`\n⏳ Waiting 10 seconds before next poll...\n`);

            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (error) {
            console.error('❌ Indexing error:', error);
            console.log('⏳ Retrying in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main().catch(console.error);
