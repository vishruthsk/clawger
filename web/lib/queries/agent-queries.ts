import { getDatabase } from '../../../lib/database';

export interface Agent {
    address: string;
    agent_type: string;
    capabilities: string[];
    min_fee: string;
    min_bond: string;
    operator: string;
    reputation: number;
    active: boolean;
    registered_at: Date;
    updated_at: Date;
    block_number: number;
    tx_hash: string;
}

export interface AgentFilters {
    type?: 'worker' | 'verifier';
    capability?: string;
    min_reputation?: number;
    active?: boolean;
    search?: string;
}

/**
 * Query agents from Postgres database
 */
export class AgentQueries {
    private db = getDatabase();

    /**
     * List all agents with optional filters
     */
    async listAgents(filters?: AgentFilters): Promise<Agent[]> {
        let query = `
            SELECT 
                address,
                agent_type,
                capabilities,
                min_fee,
                min_bond,
                operator,
                reputation,
                active,
                registered_at,
                updated_at,
                block_number,
                tx_hash
            FROM agents
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        // Apply filters
        if (filters?.type) {
            query += ` AND agent_type = $${paramIndex}`;
            params.push(filters.type === 'worker' ? 0 : 1);
            paramIndex++;
        }

        if (filters?.capability) {
            query += ` AND capabilities @> $${paramIndex}::jsonb`;
            params.push(JSON.stringify([filters.capability]));
            paramIndex++;
        }

        if (filters?.min_reputation !== undefined) {
            query += ` AND reputation >= $${paramIndex}`;
            params.push(filters.min_reputation);
            paramIndex++;
        }

        if (filters?.active !== undefined) {
            query += ` AND active = $${paramIndex}`;
            params.push(filters.active);
            paramIndex++;
        }

        if (filters?.search) {
            query += ` AND (address ILIKE $${paramIndex} OR operator ILIKE $${paramIndex})`;
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        query += ` ORDER BY reputation DESC, registered_at DESC`;

        const result = await this.db.query(query, params);

        return result.rows.map((row: any) => ({
            ...row,
            capabilities: typeof row.capabilities === 'string'
                ? JSON.parse(row.capabilities)
                : row.capabilities
        }));
    }

    /**
     * Get a single agent by address
     */
    async getAgent(address: string): Promise<Agent | null> {
        const result = await this.db.query(
            `SELECT * FROM agents WHERE address = $1`,
            [address]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ...row,
            capabilities: typeof row.capabilities === 'string'
                ? JSON.parse(row.capabilities)
                : row.capabilities
        };
    }

    /**
     * Get agent job history from task settlements
     */
    async getAgentJobHistory(address: string): Promise<any[]> {
        const result = await this.db.query(
            `
            SELECT 
                t.id as task_id,
                p.objective as title,
                t.completed_at,
                t.escrow as reward,
                CASE WHEN t.status = 'settled' THEN 5 ELSE 3 END as rating
            FROM tasks t
            JOIN proposals p ON t.proposal_id = p.id
            WHERE t.worker = $1 AND t.settled = true
            ORDER BY t.completed_at DESC
            LIMIT 10
            `,
            [address]
        );

        return result.rows;
    }

    /**
     * Get total value secured by agent
     */
    async getTotalValueSecured(address: string): Promise<number> {
        const result = await this.db.query(
            `
            SELECT COALESCE(SUM(escrow), 0) as total
            FROM tasks
            WHERE worker = $1 AND settled = true AND status = 'settled'
            `,
            [address]
        );

        return parseFloat(result.rows[0]?.total || '0');
    }

    /**
     * Get agent statistics
     */
    async getAgentStats(address: string) {
        const result = await this.db.query(
            `
            SELECT 
                COUNT(*) as jobs_completed,
                COALESCE(SUM(escrow), 0) as total_earnings,
                COUNT(CASE WHEN status = 'settled' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as success_rate
            FROM tasks
            WHERE worker = $1 AND settled = true
            `,
            [address]
        );

        return {
            jobs_completed: parseInt(result.rows[0]?.jobs_completed || '0'),
            total_earnings: parseFloat(result.rows[0]?.total_earnings || '0'),
            success_rate: parseFloat(result.rows[0]?.success_rate || '100')
        };
    }
}
