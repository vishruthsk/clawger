/**
 * State manager
 * Persistent storage for CLAWGER's state using SQLite
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import {
    ClawgerState,
    TreasuryState,
    AgentProfile,
    Proposal,
    Task,
    RiskProfile
} from '../types';
import { CONSTRAINTS } from '../../config/constraints';
import { DEMO_CONFIG } from '../../config/demo-config';

export class StateManager {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const defaultPath = path.join(process.cwd(), 'data', 'clawger-state.db');
        this.db = new Database(dbPath || defaultPath);
        this.initializeDatabase();
    }

    /**
     * Initialize database schema
     */
    private initializeDatabase(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS treasury (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total TEXT NOT NULL,
        allocated TEXT NOT NULL,
        available TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS agents (
        address TEXT PRIMARY KEY,
        reputation INTEGER NOT NULL,
        tasks_completed INTEGER NOT NULL,
        tasks_assigned INTEGER NOT NULL,
        total_earned TEXT NOT NULL,
        total_slashed TEXT NOT NULL,
        success_rate REAL NOT NULL,
        last_active INTEGER NOT NULL,
        status TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        proposer TEXT NOT NULL,
        objective TEXT NOT NULL,
        budget TEXT NOT NULL,
        deadline TEXT NOT NULL,
        risk_tolerance TEXT NOT NULL,
        constraints TEXT,
        status TEXT NOT NULL,
        bond_amount TEXT NOT NULL,
        submission_time INTEGER NOT NULL,
        decision_time INTEGER,
        counter_expiration INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        worker TEXT NOT NULL,
        verifier TEXT NOT NULL,
        escrow TEXT NOT NULL,
        worker_bond TEXT NOT NULL,
        clawger_fee TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id)
      );
      
      CREATE TABLE IF NOT EXISTS risk_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        max_task_budget TEXT NOT NULL,
        max_agent_exposure TEXT NOT NULL,
        min_agent_reputation INTEGER NOT NULL,
        current_failure_threshold REAL NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    `);

        // Initialize treasury if not exists
        this.initializeTreasury();

        // Initialize risk profile if not exists
        this.initializeRiskProfile();
    }

    /**
     * Initialize treasury with demo or zero values
     */
    private initializeTreasury(): void {
        const existing = this.db.prepare('SELECT * FROM treasury WHERE id = 1').get();

        if (!existing) {
            const initialBalance = DEMO_CONFIG.mockTreasuryBalance || '0';

            this.db.prepare(`
        INSERT INTO treasury (id, total, allocated, available, updated_at)
        VALUES (1, ?, ?, ?, ?)
      `).run(initialBalance, '0', initialBalance, Date.now());
        }
    }

    /**
     * Initialize risk profile with default values
     */
    private initializeRiskProfile(): void {
        const existing = this.db.prepare('SELECT * FROM risk_profile WHERE id = 1').get();

        if (!existing) {
            this.db.prepare(`
        INSERT INTO risk_profile (
          id,
          max_task_budget,
          max_agent_exposure,
          min_agent_reputation,
          current_failure_threshold,
          updated_at
        ) VALUES (1, ?, ?, ?, ?, ?)
      `).run(
                '10', // 10 MON max per task initially
                '5', // 5 MON max per agent
                CONSTRAINTS.MIN_WORKER_REPUTATION,
                CONSTRAINTS.MAX_FAILURE_RATE,
                Date.now()
            );
        }
    }

    // ============ Treasury Operations ============

    getTreasury(): TreasuryState {
        const row = this.db.prepare('SELECT * FROM treasury WHERE id = 1').get() as any;

        return {
            total: row.total,
            allocated: row.allocated,
            available: row.available
        };
    }

    updateTreasury(treasury: TreasuryState): void {
        this.db.prepare(`
      UPDATE treasury
      SET total = ?, allocated = ?, available = ?, updated_at = ?
      WHERE id = 1
    `).run(treasury.total, treasury.allocated, treasury.available, Date.now());
    }

    // ============ Agent Operations ============

    getAgent(address: string): AgentProfile | null {
        const row = this.db.prepare('SELECT * FROM agents WHERE address = ?').get(address) as any;

        if (!row) return null;

        return {
            address: row.address,
            reputation: row.reputation,
            tasks_completed: row.tasks_completed,
            tasks_assigned: row.tasks_assigned,
            total_earned: row.total_earned,
            total_slashed: row.total_slashed,
            success_rate: row.success_rate,
            last_active: new Date(row.last_active),
            status: row.status
        };
    }

    getAllAgents(): AgentProfile[] {
        const rows = this.db.prepare('SELECT * FROM agents').all() as any[];

        return rows.map(row => ({
            address: row.address,
            reputation: row.reputation,
            tasks_completed: row.tasks_completed,
            tasks_assigned: row.tasks_assigned,
            total_earned: row.total_earned,
            total_slashed: row.total_slashed,
            success_rate: row.success_rate,
            last_active: new Date(row.last_active),
            status: row.status
        }));
    }

    upsertAgent(agent: AgentProfile): void {
        this.db.prepare(`
      INSERT OR REPLACE INTO agents (
        address,
        reputation,
        tasks_completed,
        tasks_assigned,
        total_earned,
        total_slashed,
        success_rate,
        last_active,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            agent.address,
            agent.reputation,
            agent.tasks_completed,
            agent.tasks_assigned,
            agent.total_earned,
            agent.total_slashed,
            agent.success_rate,
            agent.last_active.getTime(),
            agent.status
        );
    }

    // ============ Proposal Operations ============

    getProposal(id: string): Proposal | null {
        const row = this.db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            proposer: row.proposer,
            objective: row.objective,
            budget: row.budget,
            deadline: row.deadline,
            risk_tolerance: row.risk_tolerance,
            constraints: row.constraints ? JSON.parse(row.constraints) : undefined,
            status: row.status,
            bond_amount: row.bond_amount,
            submission_time: new Date(row.submission_time),
            decision_time: row.decision_time ? new Date(row.decision_time) : undefined,
            counter_expiration: row.counter_expiration ? new Date(row.counter_expiration) : undefined
        };
    }

    upsertProposal(proposal: Proposal): void {
        this.db.prepare(`
      INSERT OR REPLACE INTO proposals (
        id,
        proposer,
        objective,
        budget,
        deadline,
        risk_tolerance,
        constraints,
        status,
        bond_amount,
        submission_time,
        decision_time,
        counter_expiration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            proposal.id,
            proposal.proposer,
            proposal.objective,
            proposal.budget,
            proposal.deadline,
            proposal.risk_tolerance,
            proposal.constraints ? JSON.stringify(proposal.constraints) : null,
            proposal.status,
            proposal.bond_amount,
            proposal.submission_time.getTime(),
            proposal.decision_time?.getTime() || null,
            proposal.counter_expiration?.getTime() || null
        );
    }

    // ============ Task Operations ============

    getTask(id: string): Task | null {
        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            proposal_id: row.proposal_id,
            worker: row.worker,
            verifier: row.verifier,
            escrow: row.escrow,
            worker_bond: row.worker_bond,
            clawger_fee: row.clawger_fee,
            status: row.status,
            created_at: new Date(row.created_at),
            completed_at: row.completed_at ? new Date(row.completed_at) : undefined
        };
    }

    upsertTask(task: Task): void {
        this.db.prepare(`
      INSERT OR REPLACE INTO tasks (
        id,
        proposal_id,
        worker,
        verifier,
        escrow,
        worker_bond,
        clawger_fee,
        status,
        created_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            task.id,
            task.proposal_id,
            task.worker,
            task.verifier,
            task.escrow,
            task.worker_bond,
            task.clawger_fee,
            task.status,
            task.created_at.getTime(),
            task.completed_at?.getTime() || null
        );
    }

    // ============ Risk Profile Operations ============

    getRiskProfile(): RiskProfile {
        const row = this.db.prepare('SELECT * FROM risk_profile WHERE id = 1').get() as any;

        return {
            max_task_budget: row.max_task_budget,
            max_agent_exposure: row.max_agent_exposure,
            min_agent_reputation: row.min_agent_reputation,
            current_failure_threshold: row.current_failure_threshold
        };
    }

    updateRiskProfile(profile: RiskProfile): void {
        this.db.prepare(`
      UPDATE risk_profile
      SET max_task_budget = ?,
          max_agent_exposure = ?,
          min_agent_reputation = ?,
          current_failure_threshold = ?,
          updated_at = ?
      WHERE id = 1
    `).run(
            profile.max_task_budget,
            profile.max_agent_exposure,
            profile.min_agent_reputation,
            profile.current_failure_threshold,
            Date.now()
        );
    }

    // ============ Analytics ============

    getRecentTasks(limit: number = 20): Task[] {
        const rows = this.db.prepare(`
      SELECT * FROM tasks
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as any[];

        return rows.map(row => ({
            id: row.id,
            proposal_id: row.proposal_id,
            worker: row.worker,
            verifier: row.verifier,
            escrow: row.escrow,
            worker_bond: row.worker_bond,
            clawger_fee: row.clawger_fee,
            status: row.status,
            created_at: new Date(row.created_at),
            completed_at: row.completed_at ? new Date(row.completed_at) : undefined
        }));
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}
