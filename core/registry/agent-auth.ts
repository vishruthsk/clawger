/**
 * Agent Authentication System
 * Manages API keys (Bearer Tokens) for autonomous agents.
 * 
 * Production Implementation: Uses PostgreSQL for persistence.
 */

import * as crypto from 'crypto';
import { pool } from '../db';

/**
 * Neural Specification
 * Defines an agent's AI model, capabilities, tool access, and operational limits.
 * This is the canonical identity of a bot worker.
 */
export interface NeuralSpec {
    model: string;                  // e.g., "gpt-4o", "claude-3.5-sonnet", "custom"
    provider: string;               // e.g., "OpenAI", "Anthropic", "Local"
    capabilities: string[];         // e.g., ["coding", "research", "design", "security-audit"]
    tool_access: string[];          // e.g., ["code", "browser", "wallet"], or ["none"]
    max_context_tokens?: number;    // Optional context window size
    response_style?: string;        // e.g., "concise", "deep", "fast"
    sla: {
        avg_latency_ms: number;     // Average response latency target
        uptime_target: number;      // Uptime target (0-1, e.g., 0.99 = 99%)
    };
    mission_limits: {
        max_reward: number;         // Maximum reward this agent can accept
        max_concurrent: number;     // Maximum concurrent missions
    };
    version: string;                // Spec version (e.g., "1.0")
    created_at: string;             // ISO timestamp
}

/**
 * Validates a NeuralSpec object
 */
export function validateNeuralSpec(spec: any): boolean {
    if (!spec || typeof spec !== 'object') return false;

    // Required string fields
    if (typeof spec.model !== 'string' || spec.model.length === 0) return false;
    if (typeof spec.provider !== 'string' || spec.provider.length === 0) return false;
    if (typeof spec.version !== 'string' || spec.version.length === 0) return false;
    if (typeof spec.created_at !== 'string' || spec.created_at.length === 0) return false;

    // Required arrays
    if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0) return false;
    if (!Array.isArray(spec.tool_access) || spec.tool_access.length === 0) return false;

    // Validate SLA
    if (!spec.sla || typeof spec.sla !== 'object') return false;
    if (typeof spec.sla.avg_latency_ms !== 'number' || spec.sla.avg_latency_ms <= 0) return false;
    if (typeof spec.sla.uptime_target !== 'number' || spec.sla.uptime_target < 0 || spec.sla.uptime_target > 1) return false;

    // Validate mission limits
    if (!spec.mission_limits || typeof spec.mission_limits !== 'object') return false;
    if (typeof spec.mission_limits.max_reward !== 'number' || spec.mission_limits.max_reward <= 0) return false;
    if (typeof spec.mission_limits.max_concurrent !== 'number' || spec.mission_limits.max_concurrent <= 0) return false;

    return true;
}


export interface AgentProfile {
    // Identity
    id: string;
    apiKey: string;
    address: string;
    name: string;

    // Profile
    description?: string;
    profile: string; // Detailed capabilities (min 100 chars)
    specialties: string[]; // e.g., ["coding", "research", "writing"]
    platform?: string; // e.g., "clawdbot", "custom"

    // Neural Specification (Bot Identity)
    neural_spec?: NeuralSpec;

    // Pricing & Availability
    hourly_rate?: number;
    available: boolean;

    // Oversight & Autonomy
    oversight_enabled: boolean;
    oversight_level: 'auto' | 'checkpoint' | 'full';

    // Wallet & Payments
    wallet_address?: string;
    webhook_url?: string;

    // Status & Reputation
    status: 'onboarding' | 'active' | 'suspended';
    reputation: number; // 0-100

    // Stats
    jobs_posted: number;
    jobs_completed: number;
    total_earnings?: number; // Cumulative earnings in CLAWGER

    // Timestamps
    createdAt: Date;
    lastActive: Date;
    last_seen?: Date;
}

// Legacy alias for backwards compatibility
export type AgentCredentials = AgentProfile;

export class AgentAuth {
    constructor() {
        console.log('[AgentAuth] Initialized with PostgreSQL persistence');
    }

    /**
     * Register a new agent with full profile
     */
    async register(params: {
        address: string;
        name: string;
        profile: string;
        specialties: string[];
        description?: string;
        platform?: string;
        hourly_rate?: number;
        wallet_address?: string;
        neural_spec?: NeuralSpec;
    }): Promise<AgentProfile> {
        // Validate hourly_rate
        if (!params.hourly_rate || params.hourly_rate <= 0) {
            throw new Error('hourly_rate is required and must be greater than 0');
        }

        // Check if already registered by address (or recreate key if lost)
        const check = await pool.query('SELECT * FROM agents WHERE address = $1', [params.address]);
        if (check.rows.length > 0 && check.rows[0].api_key) {
            return this.mapRowToProfile(check.rows[0]);
        }

        const apiKey = `claw_sk_${crypto.randomBytes(24).toString('hex')}`;
        // Use existing ID if present (from indexer), else create new
        let agentId = check.rows.length > 0 ? check.rows[0].id : `agent_${crypto.randomBytes(8).toString('hex')}`;

        // Upsert
        const result = await pool.query(`
            INSERT INTO agents (
                id, address, api_key, name, description, profile, specialties, platform, 
                hourly_rate, wallet_address, status, reputation, jobs_posted, 
                jobs_completed, created_at, last_active
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                'onboarding', 50, 0, 0, NOW(), NOW()
            ) 
            ON CONFLICT (address) DO UPDATE SET 
                api_key = EXCLUDED.api_key,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                profile = EXCLUDED.profile,
                specialties = EXCLUDED.specialties,
                hourly_rate = EXCLUDED.hourly_rate,
                wallet_address = EXCLUDED.wallet_address,
                last_active = NOW()
            RETURNING *
        `, [
            agentId, params.address, apiKey, params.name, params.description, params.profile,
            params.specialties, params.platform || 'clawdbot', params.hourly_rate,
            params.wallet_address || params.address
        ]);

        return this.mapRowToProfile(result.rows[0]);
    }

    /**
     * Validate an API key
     */
    async validate(apiKey: string): Promise<AgentCredentials | null> {
        const result = await pool.query(`
            UPDATE agents SET last_active = NOW() 
            WHERE api_key = $1 
            RETURNING *
        `, [apiKey]);

        if (result.rows.length === 0) return null;
        return this.mapRowToProfile(result.rows[0]);
    }

    /**
     * Activate an agent (after genesis mission)
     */
    async activate(apiKey: string): Promise<boolean> {
        const result = await pool.query(`
            UPDATE agents SET status = 'active' 
            WHERE api_key = $1
        `, [apiKey]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Update agent profile
     */
    async updateProfile(apiKey: string, updates: Partial<Pick<AgentProfile,
        'description' | 'profile' | 'specialties' | 'hourly_rate' |
        'available' | 'wallet_address' | 'webhook_url' | 'oversight_enabled' | 'oversight_level'
    >>): Promise<AgentProfile | null> {

        // Build dynamic update query
        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = $${idx++}`);
            values.push(value);
        }

        if (fields.length === 0) return this.validate(apiKey);

        values.push(apiKey);
        const query = `
            UPDATE agents SET ${fields.join(', ')}, last_active = NOW() 
            WHERE api_key = $${idx} 
            RETURNING *
        `;

        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        return this.mapRowToProfile(result.rows[0]);
    }

    /**
     * Get agent by ID
     */
    async getById(agentId: string): Promise<AgentProfile | null> {
        const result = await pool.query('SELECT * FROM agents WHERE id = $1', [agentId]);
        if (result.rows.length === 0) return null;
        return this.mapRowToProfile(result.rows[0]);
    }

    /**
     * List all agents (public)
     */
    async listAgents(filters?: {
        specialty?: string;
        available?: boolean;
        min_reputation?: number;
    }): Promise<AgentProfile[]> {
        let query = 'SELECT * FROM agents WHERE 1=1';
        const values: any[] = [];
        let idx = 1;

        if (filters?.specialty) {
            query += ` AND $${idx}::text = ANY(specialties)`;
            values.push(filters.specialty);
            idx++;
        }

        if (filters?.available !== undefined) {
            query += ` AND available = $${idx}`;
            values.push(filters.available);
            idx++;
        }

        if (filters?.min_reputation !== undefined) {
            query += ` AND reputation >= $${idx}`;
            values.push(filters.min_reputation);
            idx++;
        }

        const result = await pool.query(query, values);
        return result.rows.map(row => this.mapRowToProfile(row));
    }

    /**
     * Update agent reputation (internal/admin)
     */
    async updateReputation(agentId: string, newReputation: number): Promise<boolean> {
        const clampedRep = Math.max(0, Math.min(200, newReputation));
        const result = await pool.query('UPDATE agents SET reputation = $1 WHERE id = $2', [clampedRep, agentId]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Add earnings to agent's total (after settlement)
     */
    async addEarnings(agentId: string, amount: number): Promise<boolean> {
        const result = await pool.query('UPDATE agents SET total_earnings = COALESCE(total_earnings, 0) + $1 WHERE id = $2', [amount, agentId]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Increment job completion count
     */
    async incrementJobCount(agentId: string): Promise<boolean> {
        const result = await pool.query('UPDATE agents SET jobs_completed = COALESCE(jobs_completed, 0) + 1 WHERE id = $1', [agentId]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Update last active timestamp (for heartbeat)
     */
    async updateLastActive(agentId: string): Promise<boolean> {
        const result = await pool.query('UPDATE agents SET last_active = NOW() WHERE id = $1', [agentId]);
        return (result.rowCount ?? 0) > 0;
    }

    private mapRowToProfile(row: any): AgentProfile {
        return {
            id: row.id,
            apiKey: row.api_key,
            address: row.address,
            name: row.name,
            description: row.description,
            profile: row.profile,
            specialties: row.specialties || [],
            platform: row.platform,
            hourly_rate: parseFloat(row.hourly_rate),
            available: row.available,
            oversight_enabled: row.oversight_enabled,
            oversight_level: row.oversight_level,
            wallet_address: row.wallet_address,
            webhook_url: row.webhook_url,
            status: row.status,
            reputation: row.reputation,
            jobs_posted: row.jobs_posted,
            jobs_completed: row.jobs_completed,
            total_earnings: parseFloat(row.total_earnings || '0'),
            createdAt: new Date(row.created_at),
            lastActive: new Date(row.last_active),
            last_seen: row.last_active ? new Date(row.last_active) : undefined,
            neural_spec: row.neural_spec // Assuming stored as JSONB if added later
        };
    }
}
