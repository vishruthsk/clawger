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
import { MONAD_PRODUCTION } from './monad-production';

// Monad RPC hard limit: ~100 blocks
// We use 90 to stay safe
const MAX_LOG_RANGE = 90;

// PostgreSQL connection with IPv4 enforcement for Railway
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Force IPv4 to avoid Railway IPv6 connectivity issues
    host: 'db.mneqlihnfgkvebdnrimy.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Vishruthsk2405*',
    ssl: { rejectUnauthorized: false },
});

// Contract ABIs
const REGISTRY_ABI = [
    'event AgentRegistered(address indexed agent, uint8 indexed agentType, uint256 minFee, uint256 minBond, bytes32[] capabilities)',
    'event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore, string reason)',
];

const MANAGER_ABI = [
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, uint256 escrow, uint256 deadline)',
    'event ProposalAccepted(uint256 indexed proposalId, uint256 indexed taskId, address indexed worker, address verifier)',
    'event WorkerBondPosted(uint256 indexed taskId, address indexed worker, uint256 amount)',
    'event TaskStarted(uint256 indexed taskId)',
    'event TaskCompleted(uint256 indexed taskId)',
    'event TaskSettled(uint256 indexed taskId, bool success, uint256 payout)',
    'event TaskExpired(uint256 indexed taskId)',
    'function submitProposal(string calldata objective, uint256 escrowAmount, uint256 deadline) external returns (uint256)',
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

async function indexReputationUpdated(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { agent, oldScore, newScore, reason } = event.args as any;

    console.log(`📊 [REPUTATION UPDATED] ${agent}: ${oldScore} → ${newScore} (${reason}) at block ${event.blockNumber}`);

    // Update agent reputation in database
    await pool.query(`
        UPDATE agents 
        SET reputation = $1, updated_at = $2
        WHERE address = $3
    `, [Number(newScore), new Date(block.timestamp * 1000), agent.toLowerCase()]);

    // Insert into reputation_updates table for history
    await pool.query(`
        INSERT INTO reputation_updates (agent, old_score, new_score, reason, updated_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        agent.toLowerCase(),
        Number(oldScore),
        Number(newScore),
        reason,
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

async function indexProposalAccepted(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { proposalId, taskId, worker, verifier } = event.args as any;

    console.log(`✅ [PROPOSAL ACCEPTED] Proposal ${proposalId} → Task ${taskId} at block ${event.blockNumber}`);

    // Get proposal data to populate task
    const proposalResult = await pool.query('SELECT escrow FROM proposals WHERE id = $1', [proposalId.toString()]);
    const escrow = proposalResult.rows[0]?.escrow || '0';

    // Get task data from contract to get workerBond
    // For now, use a default bond value - this will be updated when WorkerBondPosted fires
    const workerBond = '1000000000000000000'; // 1 CLGR default

    await pool.query(`
        INSERT INTO tasks (id, proposal_id, worker, verifier, escrow, worker_bond, status, settled, created_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
            worker = EXCLUDED.worker,
            verifier = EXCLUDED.verifier,
            escrow = EXCLUDED.escrow,
            status = EXCLUDED.status,
            block_number = EXCLUDED.block_number,
            tx_hash = EXCLUDED.tx_hash
    `, [
        taskId.toString(),
        proposalId.toString(),
        worker.toLowerCase(),
        verifier.toLowerCase(),
        escrow,
        workerBond,
        'created',
        false,
        new Date(block.timestamp * 1000),
        event.blockNumber,
        event.transactionHash,
    ]);

    // Update proposal status
    await pool.query('UPDATE proposals SET status = $1 WHERE id = $2', ['accepted', proposalId.toString()]);
}

async function indexWorkerBondPosted(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { taskId, worker, amount } = event.args as any;

    console.log(`💰 [WORKER BOND POSTED] Task ${taskId}: ${ethers.formatEther(amount)} CLGR at block ${event.blockNumber}`);

    await pool.query(`
        UPDATE tasks 
        SET status = $1, worker_bond = $2
        WHERE id = $3
    `, ['bonded', amount.toString(), taskId.toString()]);
}

async function indexTaskStarted(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { taskId } = event.args as any;

    console.log(`🚀 [TASK STARTED] Task ${taskId} at block ${event.blockNumber}`);

    await pool.query(`
        UPDATE tasks 
        SET status = $1
        WHERE id = $2
    `, ['in_progress', taskId.toString()]);
}

async function indexTaskCompleted(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { taskId } = event.args as any;

    console.log(`📦 [TASK COMPLETED] Task ${taskId} at block ${event.blockNumber}`);

    await pool.query(`
        UPDATE tasks 
        SET status = $1, completed_at = $2
        WHERE id = $3
    `, ['completed', new Date(block.timestamp * 1000), taskId.toString()]);
}

async function indexTaskSettled(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { taskId, success, payout } = event.args as any;

    console.log(`💸 [TASK SETTLED] Task ${taskId}: ${success ? 'SUCCESS' : 'FAILED'}, payout: ${ethers.formatEther(payout)} CLGR`);

    await pool.query(`
        UPDATE tasks 
        SET status = $1, settled = $2
        WHERE id = $3
    `, [success ? 'verified' : 'failed', true, taskId.toString()]);
}

async function indexTaskExpired(event: ethers.EventLog, block: ethers.Block): Promise<void> {
    const { taskId } = event.args as any;

    console.log(`⏰ [TASK EXPIRED] Task ${taskId} at block ${event.blockNumber}`);

    await pool.query(`
        UPDATE tasks 
        SET status = $1, settled = $2
        WHERE id = $3
    `, ['failed', true, taskId.toString()]);
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
            // Query both event types
            const agentRegisteredFilter = registry.filters.AgentRegistered();
            const reputationUpdatedFilter = registry.filters.ReputationUpdated();

            const [
                agentRegisteredEvents,
                reputationUpdatedEvents,
            ] = await Promise.all([
                registry.queryFilter(agentRegisteredFilter, fromBlock, toBlock),
                registry.queryFilter(reputationUpdatedFilter, fromBlock, toBlock),
            ]);

            const totalEvents = agentRegisteredEvents.length + reputationUpdatedEvents.length;

            console.log(`[REGISTRY] Found ${totalEvents} events in this chunk`);

            // Process all events in order by block number
            const allEvents = [
                ...agentRegisteredEvents.map(e => ({ event: e, type: 'AgentRegistered' })),
                ...reputationUpdatedEvents.map(e => ({ event: e, type: 'ReputationUpdated' })),
            ].sort((a, b) => a.event.blockNumber - b.event.blockNumber);

            for (const { event, type } of allEvents) {
                const block = await provider.getBlock(event.blockNumber);
                if (!block) continue;

                switch (type) {
                    case 'AgentRegistered':
                        await indexAgentRegistered(event as ethers.EventLog, block);
                        break;
                    case 'ReputationUpdated':
                        await indexReputationUpdated(event as ethers.EventLog, block);
                        break;
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
            // Query all event types
            const proposalSubmittedFilter = manager.filters.ProposalSubmitted();
            const proposalAcceptedFilter = manager.filters.ProposalAccepted();
            const workerBondPostedFilter = manager.filters.WorkerBondPosted();
            const taskStartedFilter = manager.filters.TaskStarted();
            const taskCompletedFilter = manager.filters.TaskCompleted();
            const taskSettledFilter = manager.filters.TaskSettled();
            const taskExpiredFilter = manager.filters.TaskExpired();

            const [
                proposalSubmittedEvents,
                proposalAcceptedEvents,
                workerBondPostedEvents,
                taskStartedEvents,
                taskCompletedEvents,
                taskSettledEvents,
                taskExpiredEvents,
            ] = await Promise.all([
                manager.queryFilter(proposalSubmittedFilter, fromBlock, toBlock),
                manager.queryFilter(proposalAcceptedFilter, fromBlock, toBlock),
                manager.queryFilter(workerBondPostedFilter, fromBlock, toBlock),
                manager.queryFilter(taskStartedFilter, fromBlock, toBlock),
                manager.queryFilter(taskCompletedFilter, fromBlock, toBlock),
                manager.queryFilter(taskSettledFilter, fromBlock, toBlock),
                manager.queryFilter(taskExpiredFilter, fromBlock, toBlock),
            ]);

            const totalEvents = proposalSubmittedEvents.length + proposalAcceptedEvents.length +
                workerBondPostedEvents.length + taskStartedEvents.length + taskCompletedEvents.length +
                taskSettledEvents.length + taskExpiredEvents.length;

            console.log(`[MANAGER] Found ${totalEvents} events in this chunk`);

            // Process all events in order by block number
            const allEvents = [
                ...proposalSubmittedEvents.map(e => ({ event: e, type: 'ProposalSubmitted' })),
                ...proposalAcceptedEvents.map(e => ({ event: e, type: 'ProposalAccepted' })),
                ...workerBondPostedEvents.map(e => ({ event: e, type: 'WorkerBondPosted' })),
                ...taskStartedEvents.map(e => ({ event: e, type: 'TaskStarted' })),
                ...taskCompletedEvents.map(e => ({ event: e, type: 'TaskCompleted' })),
                ...taskSettledEvents.map(e => ({ event: e, type: 'TaskSettled' })),
                ...taskExpiredEvents.map(e => ({ event: e, type: 'TaskExpired' })),
            ].sort((a, b) => a.event.blockNumber - b.event.blockNumber);

            for (const { event, type } of allEvents) {
                const block = await provider.getBlock(event.blockNumber);
                if (!block) continue;

                switch (type) {
                    case 'ProposalSubmitted':
                        await indexProposalSubmitted(event as ethers.EventLog, block, provider, manager);
                        break;
                    case 'ProposalAccepted':
                        await indexProposalAccepted(event as ethers.EventLog, block);
                        break;
                    case 'WorkerBondPosted':
                        await indexWorkerBondPosted(event as ethers.EventLog, block);
                        break;
                    case 'TaskStarted':
                        await indexTaskStarted(event as ethers.EventLog, block);
                        break;
                    case 'TaskCompleted':
                        await indexTaskCompleted(event as ethers.EventLog, block);
                        break;
                    case 'TaskSettled':
                        await indexTaskSettled(event as ethers.EventLog, block);
                        break;
                    case 'TaskExpired':
                        await indexTaskExpired(event as ethers.EventLog, block);
                        break;
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
