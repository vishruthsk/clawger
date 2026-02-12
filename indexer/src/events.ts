import { ethers } from 'ethers';
import { getPool } from './db';

const pool = getPool();

export async function indexAgentRegistered(event: ethers.EventLog) {
    const { agent, agentType, minFee, minBond, capabilities } = event.args as any;
    const block = await event.getBlock();

    await pool.query(
        `INSERT INTO agents (address, agent_type, capabilities, min_fee, min_bond, operator, reputation, active, registered_at, updated_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (address) DO UPDATE SET
            agent_type = EXCLUDED.agent_type,
            capabilities = EXCLUDED.capabilities,
            min_fee = EXCLUDED.min_fee,
            min_bond = EXCLUDED.min_bond,
            updated_at = EXCLUDED.updated_at`,
        [
            agent,
            agentType === 0 ? 'WORKER' : 'VERIFIER',
            JSON.stringify(capabilities),
            minFee.toString(),
            minBond.toString(),
            agent, // operator defaults to agent address
            50, // base reputation
            true,
            new Date(block.timestamp * 1000),
            new Date(block.timestamp * 1000),
            event.blockNumber,
            event.transactionHash,
        ]
    );

    console.log(`  📝 Indexed agent: ${agent}`);
}

export async function indexProposalSubmitted(event: ethers.EventLog) {
    const { proposalId, proposer, objective, escrow, deadline } = event.args as any;
    const block = await event.getBlock();

    await pool.query(
        `INSERT INTO proposals (id, proposer, objective, escrow, deadline, status, created_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING`,
        [
            proposalId.toString(),
            proposer,
            objective,
            escrow.toString(),
            new Date(Number(deadline) * 1000),
            'PENDING',
            new Date(block.timestamp * 1000),
            event.blockNumber,
            event.transactionHash,
        ]
    );

    console.log(`  📋 Indexed proposal: ${proposalId}`);
}

export async function indexTaskCreated(event: ethers.EventLog) {
    const { proposalId, taskId, worker, verifier } = event.args as any;
    const block = await event.getBlock();

    // Get proposal details to get escrow
    const proposal = await pool.query('SELECT escrow FROM proposals WHERE id = $1', [proposalId.toString()]);
    const escrow = proposal.rows[0]?.escrow || '0';

    await pool.query(
        `INSERT INTO tasks (id, proposal_id, worker, verifier, escrow, worker_bond, status, settled, created_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING`,
        [
            taskId.toString(),
            proposalId.toString(),
            worker,
            verifier,
            escrow,
            '0', // worker_bond will be updated when posted
            'CREATED',
            false,
            new Date(block.timestamp * 1000),
            event.blockNumber,
            event.transactionHash,
        ]
    );

    // Update proposal status
    await pool.query('UPDATE proposals SET status = $1 WHERE id = $2', ['ACCEPTED', proposalId.toString()]);

    console.log(`  ✅ Indexed task: ${taskId}`);
}

export async function indexTaskSettled(event: ethers.EventLog) {
    const { taskId, success, workerPayout } = event.args as any;
    const block = await event.getBlock();

    await pool.query(
        `UPDATE tasks SET status = $1, settled = $2, completed_at = $3 WHERE id = $4`,
        [success ? 'SUCCESS' : 'FAILED', true, new Date(block.timestamp * 1000), taskId.toString()]
    );

    console.log(`  💰 Indexed settlement: Task ${taskId} - ${success ? 'SUCCESS' : 'FAILED'}`);
}

export async function indexReputationUpdated(event: ethers.EventLog) {
    const { agent, oldScore, newScore, reason } = event.args as any;
    const block = await event.getBlock();

    await pool.query(
        `INSERT INTO reputation_updates (agent, old_score, new_score, reason, updated_at, block_number, tx_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            agent,
            Number(oldScore),
            Number(newScore),
            reason,
            new Date(block.timestamp * 1000),
            event.blockNumber,
            event.transactionHash,
        ]
    );

    // Update agent reputation
    await pool.query('UPDATE agents SET reputation = $1 WHERE address = $2', [Number(newScore), agent]);

    console.log(`  ⭐ Indexed reputation: ${agent} ${oldScore} → ${newScore}`);
}
