/**
 * Rejection ledger
 * Permanent storage of all rejected proposals
 */

import { RejectionRecord } from '../types';
import { getLogPrefix } from '../../config/demo-config';
import Database from 'better-sqlite3';
import * as path from 'path';

const logger = console;

export class RejectionLedger {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const defaultPath = path.join(process.cwd(), 'data', 'rejection-ledger.db');
        this.db = new Database(dbPath || defaultPath);
        this.initializeDatabase();
    }

    /**
     * Initialize database schema
     */
    private initializeDatabase(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS rejections (
        proposal_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        objective TEXT NOT NULL,
        budget TEXT NOT NULL,
        deadline TEXT NOT NULL,
        reason TEXT NOT NULL,
        bond_burned TEXT NOT NULL,
        bond_to_clawger TEXT NOT NULL,
        proposer TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON rejections(timestamp);
      CREATE INDEX IF NOT EXISTS idx_proposer ON rejections(proposer);
    `);
    }

    /**
     * Record a rejection (permanent, cannot be deleted)
     */
    recordRejection(record: RejectionRecord): void {
        const prefix = getLogPrefix();

        const stmt = this.db.prepare(`
      INSERT INTO rejections (
        proposal_id,
        timestamp,
        objective,
        budget,
        deadline,
        reason,
        bond_burned,
        bond_to_clawger,
        proposer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            record.proposal_id,
            record.timestamp.getTime(),
            record.objective,
            record.budget,
            record.deadline,
            record.reason,
            record.bond_burned,
            record.bond_to_clawger,
            record.proposer
        );

        logger.info(`${prefix} REJECTION RECORDED: ${record.proposal_id}`);
        logger.info(`${prefix} Reason: ${record.reason}`);
        logger.info(`${prefix} Bond burned: ${record.bond_burned} MON`);
    }

    /**
     * Get all rejections (newest first)
     */
    getAllRejections(limit?: number): RejectionRecord[] {
        const stmt = this.db.prepare(`
      SELECT * FROM rejections
      ORDER BY timestamp DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `);

        const rows = stmt.all() as any[];

        return rows.map(row => ({
            proposal_id: row.proposal_id,
            timestamp: new Date(row.timestamp),
            objective: row.objective,
            budget: row.budget,
            deadline: row.deadline,
            reason: row.reason,
            bond_burned: row.bond_burned,
            bond_to_clawger: row.bond_to_clawger,
            proposer: row.proposer
        }));
    }

    /**
     * Get rejections by proposer
     */
    getRejectionsByProposer(proposer: string): RejectionRecord[] {
        const stmt = this.db.prepare(`
      SELECT * FROM rejections
      WHERE proposer = ?
      ORDER BY timestamp DESC
    `);

        const rows = stmt.all(proposer) as any[];

        return rows.map(row => ({
            proposal_id: row.proposal_id,
            timestamp: new Date(row.timestamp),
            objective: row.objective,
            budget: row.budget,
            deadline: row.deadline,
            reason: row.reason,
            bond_burned: row.bond_burned,
            bond_to_clawger: row.bond_to_clawger,
            proposer: row.proposer
        }));
    }

    /**
     * Get rejection statistics
     */
    getStatistics(): {
        total_rejections: number;
        total_bonds_burned: string;
        total_bonds_to_clawger: string;
        unique_proposers: number;
    } {
        const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_rejections,
        SUM(CAST(bond_burned AS REAL)) as total_bonds_burned,
        SUM(CAST(bond_to_clawger AS REAL)) as total_bonds_to_clawger,
        COUNT(DISTINCT proposer) as unique_proposers
      FROM rejections
    `).get() as any;

        return {
            total_rejections: stats.total_rejections || 0,
            total_bonds_burned: (stats.total_bonds_burned || 0).toFixed(2),
            total_bonds_to_clawger: (stats.total_bonds_to_clawger || 0).toFixed(2),
            unique_proposers: stats.unique_proposers || 0
        };
    }

    /**
     * Search rejections by reason
     */
    searchByReason(searchTerm: string): RejectionRecord[] {
        const stmt = this.db.prepare(`
      SELECT * FROM rejections
      WHERE reason LIKE ?
      ORDER BY timestamp DESC
    `);

        const rows = stmt.all(`%${searchTerm}%`) as any[];

        return rows.map(row => ({
            proposal_id: row.proposal_id,
            timestamp: new Date(row.timestamp),
            objective: row.objective,
            budget: row.budget,
            deadline: row.deadline,
            reason: row.reason,
            bond_burned: row.bond_burned,
            bond_to_clawger: row.bond_to_clawger,
            proposer: row.proposer
        }));
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}
