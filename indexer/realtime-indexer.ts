/**
 * CLAWGER Production Event Indexer - Realtime Mode
 * 
 * Indexes on-chain events from AgentRegistry and ClawgerManager contracts
 * to PostgreSQL. Uses realtime polling mode with safe lookback.
 */

import { ethers } from 'ethers';
import { Pool } from 'pg';
import { MONAD_PRODUCTION } from '../config/monad-production';

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Contract ABIs
const REGISTRY_ABI = [
    'event AgentRegistered(address indexed agent, uint8 indexed agentType, uint256 minFee, uint256 minBond, bytes32[] capabilities)',
];

const MANAGER_ABI = [
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 escrow, uint256 deadline)',
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external returns (uint256)',
];

const SAFE_LOOKBACK = 200; // Blocks to look back if indexer was offline
const BATCH_SIZE = 50; // Max blocks per query (Monad limit is 100)
const POLL_INTERVAL = 10000; // 10 seconds

async function getLastProcessedBlock(contract: 'registry' | 'manager'): Promise<number> {
    const column = contract === 'registry' ? 'last_block_registry' : 'last_block_manager';
    const result = await pool.query(`SELECT ${column} FROM indexer_state WHERE id = 1`);
    const rawValue = result.rows[0]?.[column];

    // CRITICAL: Cast to number - Postgres returns as string!
    const lastBlock = Number(rawValue);

    // If never indexed (0 or NaN), start from deployment block
    if (!lastBlock || lastBlock === 0 || !Number.isFinite(lastBlock)) {
        const deploymentBlock = contract === 'registry'
            ? MONAD_PRODUCTION.deploymentBlocks.AGENT_REGISTRY
            : MONAD_PRODUCTION.deploymentBlocks.CLAWGER_MANAGER;
        console.log(`[${contract.toUpperCase()}] Starting from deployment block: ${deploymentBlock}`);
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

    // ABI GUARD: Verify event has exactly 5 arguments
    if (!event.args || event.args.length !== 5) {
        console.error(`❌ [ABI DRIFT] AgentRegistered event has ${event.args?.length || 0} args, expected 5`);
        console.error(`   TX: ${event.transactionHash}`);
        throw new Error(`ABI drift detected in AgentRegistered event at tx ${event.transactionHash}`);
    }

    console.log(`🎉 [AGENT REGISTERED] ${agent} (type: ${agentType === 0 ? 'worker' : 'verifier'}) at block ${event.blockNumber}`);

    await pool.query(`
        INSERT INTO agents (address, agent_type, capabilities, min_fee, min_bond, operator, reputation, active, registered_at, updated_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (address) DO UPDATE SET
            agent_type = EXCLUDED.agent_type,
            capabilities = EXCLUDED.capabilities,
            min_fee = EXCLUDED.min_fee,
            min_bond = EXCLUDED.min_bond,
            updated_at = EXCLUDED.updated_at,
            block_number = EXCLUDED.block_number,
            tx_hash = EXCLUDED.tx_hash
    `, [
        agent.toLowerCase(),
        agentType === 0 ? 'worker' : 'verifier',
        JSON.stringify(capabilities.map((c: string) => c)),
        minFee.toString(),
        minBond.toString(),
        agent.toLowerCase(), // operator defaults to agent address
        50, // default reputation
        true,
        new Date(block.timestamp * 1000),
        new Date(block.timestamp * 1000),
        event.blockNumber,
        event.transactionHash,
    ]);
}

async function indexProposalSubmitted(event: ethers.EventLog, block: ethers.Block, provider: ethers.Provider, manager: ethers.Contract): Promise<void> {
    const { proposalId, proposer, escrow, deadline } = event.args as any;

    // ABI GUARD: Verify event has exactly 4 arguments
    if (!event.args || event.args.length !== 4) {
        console.error(`❌ [ABI DRIFT] ProposalSubmitted event has ${event.args?.length || 0} args, expected 4`);
        console.error(`   TX: ${event.transactionHash}`);
        throw new Error(`ABI drift detected in ProposalSubmitted event at tx ${event.transactionHash}`);
    }

    console.log(`💼 [PROPOSAL SUBMITTED] ID ${proposalId} at block ${event.blockNumber} (tx: ${event.transactionHash})`);

    // CRITICAL: Decode objective from transaction calldata
    let objective = 'Mission details'; // Fallback
    try {
        const tx = await provider.getTransaction(event.transactionHash);
        if (!tx) {
            console.error(`⚠️  [PROPOSAL] Could not fetch transaction ${event.transactionHash}`);
        } else {
            const parsed = manager.interface.parseTransaction({ data: tx.data, value: tx.value });
            if (parsed && parsed.name === 'submitProposal' && parsed.args.length >= 1) {
                objective = parsed.args[0]; // First arg is objective
                console.log(`   ✅ Decoded objective: "${objective.substring(0, 50)}${objective.length > 50 ? '...' : ''}"`);
            } else {
                console.error(`⚠️  [PROPOSAL] Could not parse transaction calldata`);
            }
        }
    } catch (error) {
        console.error(`⚠️  [PROPOSAL] Error decoding objective:`, error);
    }

    // REPLAY SAFETY: Use UPSERT to ensure idempotency
    await pool.query(`
        INSERT INTO proposals (id, proposer, objective, escrow, deadline, status, created_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
            objective = EXCLUDED.objective,
            escrow = EXCLUDED.escrow,
            deadline = EXCLUDED.deadline,
            block_number = EXCLUDED.block_number,
            tx_hash = EXCLUDED.tx_hash,
            created_at = EXCLUDED.created_at
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

    // Realtime mode: only scan recent blocks
    let fromBlock = lastBlock + 1;

    // Safe lookback if indexer was offline
    if (currentBlock - lastBlock > SAFE_LOOKBACK) {
        fromBlock = currentBlock - SAFE_LOOKBACK;
        console.log(`[REGISTRY] Indexer was offline, using safe lookback from block ${fromBlock}`);
    }

    if (fromBlock > currentBlock) {
        return; // Already up to date
    }

    console.log(`[REGISTRY] Polling blocks ${fromBlock} to ${currentBlock}`);

    while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);

        // Ensure block numbers are integers
        const fromBlockInt = Math.floor(fromBlock);
        const toBlockInt = Math.floor(toBlock);

        // HARD ASSERTION: Never exceed 99 block range
        const range = toBlockInt - fromBlockInt;
        if (range > 99) {
            throw new Error(`Block range ${range} exceeds Monad RPC limit of 99`);
        }

        // Use typed filter
        const filter = registry.filters.AgentRegistered();
        const events = await registry.queryFilter(filter, fromBlockInt, toBlockInt);

        for (const event of events) {
            const block = await provider.getBlock(event.blockNumber);
            if (block) {
                await indexAgentRegistered(event as ethers.EventLog, block);
            }
        }

        await updateLastProcessedBlock('registry', toBlockInt);

        fromBlock = toBlockInt + 1;
    }
}

async function indexManager(provider: ethers.Provider, manager: ethers.Contract): Promise<void> {
    const lastBlock = await getLastProcessedBlock('manager');
    const currentBlock = await provider.getBlockNumber();

    // Realtime mode: only scan recent blocks
    let fromBlock = lastBlock + 1;

    // Safe lookback if indexer was offline
    if (currentBlock - lastBlock > SAFE_LOOKBACK) {
        fromBlock = currentBlock - SAFE_LOOKBACK;
        console.log(`[MANAGER] Indexer was offline, using safe lookback from block ${fromBlock}`);
    }

    if (fromBlock > currentBlock) {
        return; // Already up to date
    }

    console.log(`[MANAGER] Polling blocks ${fromBlock} to ${currentBlock}`);

    while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);

        // Ensure block numbers are integers
        const fromBlockInt = Math.floor(fromBlock);
        const toBlockInt = Math.floor(toBlock);

        // HARD ASSERTION: Never exceed 99 block range
        const range = toBlockInt - fromBlockInt;
        if (range > 99) {
            throw new Error(`Block range ${range} exceeds Monad RPC limit of 99`);
        }

        // Use typed filter
        const filter = manager.filters.ProposalSubmitted();
        const events = await manager.queryFilter(filter, fromBlockInt, toBlockInt);

        for (const event of events) {
            const block = await provider.getBlock(event.blockNumber);
            if (block) {
                await indexProposalSubmitted(event as ethers.EventLog, block, provider, manager);
            }
        }

        await updateLastProcessedBlock('manager', toBlockInt);

        fromBlock = toBlockInt + 1;
    }
}

async function main() {
    console.log('🚀 CLAWGER Production Indexer (Realtime Mode)');
    console.log(`📡 RPC: ${MONAD_PRODUCTION.rpcUrl}`);
    console.log(`📊 Database: ${process.env.DATABASE_URL?.split('@')[1]}`);
    console.log(`⏱️  Poll Interval: ${POLL_INTERVAL}ms`);
    console.log(`🔄 Safe Lookback: ${SAFE_LOOKBACK} blocks\n`);

    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const registry = new ethers.Contract(MONAD_PRODUCTION.contracts.AGENT_REGISTRY, REGISTRY_ABI, provider);
    const manager = new ethers.Contract(MONAD_PRODUCTION.contracts.CLAWGER_MANAGER, MANAGER_ABI, provider);

    // Test DB connection
    const dbTest = await pool.query('SELECT NOW()');
    console.log(`✅ Database connected at ${dbTest.rows[0].now}\n`);

    // Realtime polling loop
    while (true) {
        try {
            await indexRegistry(provider, registry);
            await indexManager(provider, manager);

            // Check counts
            const agentCount = await pool.query('SELECT COUNT(*) FROM agents');
            const proposalCount = await pool.query('SELECT COUNT(*) FROM proposals');
            const state = await pool.query('SELECT last_block_registry, last_block_manager FROM indexer_state WHERE id = 1');

            console.log(`\n📊 Current State:`);
            console.log(`   Agents: ${agentCount.rows[0].count}`);
            console.log(`   Proposals: ${proposalCount.rows[0].count}`);
            console.log(`   Last Registry Block: ${state.rows[0].last_block_registry}`);
            console.log(`   Last Manager Block: ${state.rows[0].last_block_manager}`);
            console.log(`\n⏳ Waiting ${POLL_INTERVAL / 1000}s before next poll...\n`);

            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        } catch (error) {
            console.error('❌ Indexing error:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main().catch(console.error);
