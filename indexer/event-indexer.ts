/**
 * CLAWGER Event Indexer
 * 
 * Indexes on-chain events from AgentRegistry and ClawgerManager contracts
 * to enable off-chain agent discovery and task tracking.
 * 
 * Events Indexed:
 * - AgentRegistered
 * - AgentUpdated
 * - AgentDeactivated
 * - AgentReactivated
 * - ProposalCreated
 * - ProposalAccepted
 * - ProposalRejected
 * - TaskVerified
 * 
 * Storage: SQLite database for fast queries
 */

import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import path from 'path';

// Monad configuration
const MONAD_RPC = 'https://rpc.monad.xyz';
const AGENT_REGISTRY = '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36';
const CLAWGER_MANAGER = '0x13ec4679b38F67cA627Ba03Fa82ce46E9b383691';

// Database setup
const DB_PATH = path.join(process.cwd(), 'data', 'events.db');
const db = new Database(DB_PATH);

// Initialize database schema
function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
            address TEXT PRIMARY KEY,
            agent_type INTEGER,
            capabilities TEXT,
            min_fee INTEGER,
            reputation INTEGER,
            active INTEGER,
            registered_at INTEGER,
            updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS agent_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_address TEXT,
            block_number INTEGER,
            timestamp INTEGER,
            event_type TEXT,
            data TEXT,
            FOREIGN KEY (agent_address) REFERENCES agents(address)
        );

        CREATE TABLE IF NOT EXISTS proposals (
            proposal_id INTEGER PRIMARY KEY,
            requester TEXT,
            description TEXT,
            escrow INTEGER,
            bond_required INTEGER,
            created_at INTEGER,
            status TEXT
        );

        CREATE TABLE IF NOT EXISTS tasks (
            task_id INTEGER PRIMARY KEY,
            proposal_id INTEGER,
            worker TEXT,
            verifier TEXT,
            worker_bond INTEGER,
            status TEXT,
            created_at INTEGER,
            verified_at INTEGER,
            success INTEGER,
            FOREIGN KEY (proposal_id) REFERENCES proposals(proposal_id)
        );

        CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);
        CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
        CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
}

// AgentRegistry ABI (events only)
const REGISTRY_ABI = [
    'event AgentRegistered(address indexed agent, uint8 agentType, bytes32[] capabilities, uint256 minFee)',
    'event AgentUpdated(address indexed agent, bytes32[] capabilities, uint256 minFee)',
    'event AgentDeactivated(address indexed agent)',
    'event AgentReactivated(address indexed agent)',
    'event ReputationUpdated(address indexed agent, uint256 newScore, string reason)',
];

// ClawgerManager ABI (events only)
const MANAGER_ABI = [
    'event ProposalCreated(uint256 indexed proposalId, address indexed requester, string description, uint256 escrow, uint256 bondRequired)',
    'event ProposalAccepted(uint256 indexed proposalId, address indexed worker, address indexed verifier, uint256 workerBond)',
    'event ProposalRejected(uint256 indexed proposalId, string reason)',
    'event TaskVerified(uint256 indexed taskId, bool success, uint256 payout)',
];

// Event handlers
const handlers = {
    AgentRegistered: (event: ethers.Event) => {
        const { agent, agentType, capabilities, minFee } = event.args!;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO agents (address, agent_type, capabilities, min_fee, reputation, active, registered_at, updated_at)
            VALUES (?, ?, ?, ?, 50, 1, ?, ?)
        `);
        const timestamp = Math.floor(Date.now() / 1000);
        stmt.run(
            agent,
            agentType,
            JSON.stringify(capabilities),
            minFee.toString(),
            timestamp,
            timestamp
        );
        console.log(`✅ Agent registered: ${agent}`);
    },

    AgentUpdated: (event: ethers.Event) => {
        const { agent, capabilities, minFee } = event.args!;
        const stmt = db.prepare(`
            UPDATE agents SET capabilities = ?, min_fee = ?, updated_at = ?
            WHERE address = ?
        `);
        stmt.run(
            JSON.stringify(capabilities),
            minFee.toString(),
            Math.floor(Date.now() / 1000),
            agent
        );
        console.log(`📝 Agent updated: ${agent}`);
    },

    AgentDeactivated: (event: ethers.Event) => {
        const { agent } = event.args!;
        const stmt = db.prepare('UPDATE agents SET active = 0, updated_at = ? WHERE address = ?');
        stmt.run(Math.floor(Date.now() / 1000), agent);
        console.log(`⏸️  Agent deactivated: ${agent}`);
    },

    AgentReactivated: (event: ethers.Event) => {
        const { agent } = event.args!;
        const stmt = db.prepare('UPDATE agents SET active = 1, updated_at = ? WHERE address = ?');
        stmt.run(Math.floor(Date.now() / 1000), agent);
        console.log(`▶️  Agent reactivated: ${agent}`);
    },

    ReputationUpdated: (event: ethers.Event) => {
        const { agent, newScore } = event.args!;
        const stmt = db.prepare('UPDATE agents SET reputation = ?, updated_at = ? WHERE address = ?');
        stmt.run(newScore.toString(), Math.floor(Date.now() / 1000), agent);
        console.log(`⭐ Reputation updated: ${agent} -> ${newScore}`);
    },

    ProposalCreated: (event: ethers.Event) => {
        const { proposalId, requester, description, escrow, bondRequired } = event.args!;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO proposals (proposal_id, requester, description, escrow, bond_required, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `);
        stmt.run(
            proposalId.toString(),
            requester,
            description,
            escrow.toString(),
            bondRequired.toString(),
            Math.floor(Date.now() / 1000)
        );
        console.log(`📋 Proposal created: #${proposalId}`);
    },

    ProposalAccepted: (event: ethers.Event) => {
        const { proposalId, worker, verifier, workerBond } = event.args!;

        // Update proposal status
        db.prepare('UPDATE proposals SET status = ? WHERE proposal_id = ?')
            .run('accepted', proposalId.toString());

        // Create task record
        const stmt = db.prepare(`
            INSERT INTO tasks (task_id, proposal_id, worker, verifier, worker_bond, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'executing', ?)
        `);
        stmt.run(
            proposalId.toString(), // Using proposalId as taskId for now
            proposalId.toString(),
            worker,
            verifier,
            workerBond.toString(),
            Math.floor(Date.now() / 1000)
        );
        console.log(`✅ Proposal accepted: #${proposalId} -> Worker: ${worker}`);
    },

    ProposalRejected: (event: ethers.Event) => {
        const { proposalId, reason } = event.args!;
        db.prepare('UPDATE proposals SET status = ? WHERE proposal_id = ?')
            .run('rejected', proposalId.toString());
        console.log(`❌ Proposal rejected: #${proposalId} - ${reason}`);
    },

    TaskVerified: (event: ethers.Event) => {
        const { taskId, success, payout } = event.args!;
        const stmt = db.prepare(`
            UPDATE tasks SET status = ?, verified_at = ?, success = ?
            WHERE task_id = ?
        `);
        stmt.run(
            'verified',
            Math.floor(Date.now() / 1000),
            success ? 1 : 0,
            taskId.toString()
        );
        console.log(`🔍 Task verified: #${taskId} - ${success ? 'SUCCESS' : 'FAILED'} (${payout})`);
    },
};

// Main indexer
async function startIndexer() {
    console.log('🚀 Starting CLAWGER Event Indexer...\n');

    // Initialize database
    initDatabase();
    console.log('✅ Database initialized\n');

    // Connect to Monad
    const provider = new ethers.JsonRpcProvider(MONAD_RPC);
    const network = await provider.getNetwork();
    console.log(`🔗 Connected to Monad (Chain ID: ${network.chainId})\n`);

    // Create contract instances
    const registry = new ethers.Contract(AGENT_REGISTRY, REGISTRY_ABI, provider);
    const manager = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, provider);

    console.log('📡 Listening for events...\n');

    // Listen to AgentRegistry events
    registry.on('AgentRegistered', handlers.AgentRegistered);
    registry.on('AgentUpdated', handlers.AgentUpdated);
    registry.on('AgentDeactivated', handlers.AgentDeactivated);
    registry.on('AgentReactivated', handlers.AgentReactivated);
    registry.on('ReputationUpdated', handlers.ReputationUpdated);

    // Listen to ClawgerManager events
    manager.on('ProposalCreated', handlers.ProposalCreated);
    manager.on('ProposalAccepted', handlers.ProposalAccepted);
    manager.on('ProposalRejected', handlers.ProposalRejected);
    manager.on('TaskVerified', handlers.TaskVerified);

    console.log('✅ Event listeners active!\n');
}

// Query functions for API
export function queryWorkers(capability?: string): any[] {
    let query = 'SELECT * FROM agents WHERE agent_type = 0 AND active = 1';
    const params: any[] = [];

    if (capability) {
        query += ' AND capabilities LIKE ?';
        params.push(`%${capability}%`);
    }

    query += ' ORDER BY reputation DESC';

    return db.prepare(query).all(...params);
}

export function queryVerifiers(): any[] {
    return db.prepare('SELECT * FROM agents WHERE agent_type = 1 AND active = 1 ORDER BY reputation DESC').all();
}

export function getAgent(address: string): any {
    return db.prepare('SELECT * FROM agents WHERE address = ?').get(address);
}

export function getProposal(proposalId: number): any {
    return db.prepare('SELECT * FROM proposals WHERE proposal_id = ?').get(proposalId);
}

export function getTask(taskId: number): any {
    return db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
}

// Start indexer if run directly
if (require.main === module) {
    startIndexer().catch(console.error);
}

export { startIndexer };
