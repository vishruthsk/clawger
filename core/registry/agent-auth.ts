/**
 * Agent Authentication System
 * Manages API keys (Bearer Tokens) for autonomous agents.
 * 
 * In a production system, this would use a database and secure hashing.
 * For this implementation, we use an in-memory store with persistence to JSON.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
    private creds: Map<string, AgentCredentials> = new Map(); // apiKey -> Creds
    private addressToKey: Map<string, string> = new Map();    // address -> apiKey
    private persistencePath: string;

    constructor(persistenceDir: string = './data') {
        this.persistencePath = path.join(persistenceDir, 'agent-auth.json');
        console.log(`[AgentAuth] Persistence Path: ${path.resolve(this.persistencePath)}`); // DEBUG
        this.load();
    }

    /**
     * Register a new agent with full profile
     */
    register(params: {
        address: string;
        name: string;
        profile: string;
        specialties: string[];
        description?: string;
        platform?: string;
        hourly_rate?: number;
        wallet_address?: string;
        neural_spec?: NeuralSpec;
    }): AgentProfile {
        // Validate hourly_rate
        if (!params.hourly_rate || params.hourly_rate <= 0) {
            throw new Error('hourly_rate is required and must be greater than 0');
        }

        // Check if already registered
        if (this.addressToKey.has(params.address)) {
            const existingKey = this.addressToKey.get(params.address)!;
            return this.creds.get(existingKey)!;
        }

        const apiKey = `claw_sk_${crypto.randomBytes(24).toString('hex')}`;
        const agentId = `agent_${crypto.randomBytes(8).toString('hex')}`;

        const profile: AgentProfile = {
            id: agentId,
            apiKey,
            address: params.address,
            name: params.name,
            description: params.description,
            profile: params.profile,
            specialties: params.specialties,
            platform: params.platform || 'clawdbot',
            neural_spec: params.neural_spec,
            hourly_rate: params.hourly_rate,
            available: true,
            oversight_enabled: false,
            oversight_level: 'auto',
            wallet_address: params.wallet_address || params.address,
            status: 'onboarding', // Requires genesis mission or first job
            reputation: 50, // Start at neutral
            jobs_posted: 0,
            jobs_completed: 0,
            createdAt: new Date(),
            lastActive: new Date()
        };

        this.creds.set(apiKey, profile);
        this.addressToKey.set(params.address, apiKey);
        this.save();

        return profile;
    }

    /**
     * Validate an API key
     */
    validate(apiKey: string): AgentCredentials | null {
        if (!this.creds.has(apiKey)) {
            this.load();
            if (!this.creds.has(apiKey)) return null;
        }

        const creds = this.creds.get(apiKey)!;

        // Update last active
        creds.lastActive = new Date();
        // Don't save on every read for perf, but in real app we would

        return creds;
    }

    /**
     * Activate an agent (after genesis mission)
     */
    activate(apiKey: string): boolean {
        const creds = this.creds.get(apiKey);
        if (!creds) return false;

        creds.status = 'active';
        this.save();
        return true;
    }

    /**
     * Update agent profile
     */
    updateProfile(apiKey: string, updates: Partial<Pick<AgentProfile,
        'description' | 'profile' | 'specialties' | 'hourly_rate' |
        'available' | 'wallet_address' | 'webhook_url' | 'oversight_enabled' | 'oversight_level'
    >>): AgentProfile | null {
        const profile = this.creds.get(apiKey);
        if (!profile) return null;

        // Apply updates
        Object.assign(profile, updates);
        profile.lastActive = new Date();
        profile.last_seen = new Date();

        this.save();
        return profile;
    }

    /**
     * Get agent by ID
     */
    getById(agentId: string): AgentProfile | null {
        this.load(); // Ensure fresh data
        for (const profile of this.creds.values()) {
            if (profile.id === agentId) {
                return profile;
            }
        }
        return null;
    }

    /**
     * List all agents (public)
     */
    listAgents(filters?: {
        specialty?: string;
        available?: boolean;
        min_reputation?: number;
    }): AgentProfile[] {
        this.load(); // Ensure fresh data
        let agents = Array.from(this.creds.values());

        if (filters?.specialty) {
            agents = agents.filter(a =>
                a.specialties.some(s => s.toLowerCase().includes(filters.specialty!.toLowerCase()))
            );
        }

        if (filters?.available !== undefined) {
            agents = agents.filter(a => a.available === filters.available);
        }

        if (filters?.min_reputation !== undefined) {
            agents = agents.filter(a => a.reputation >= filters.min_reputation!);
        }

        return agents;
    }

    /**
     * Persistence
     */
    private save() {
        if (!fs.existsSync(path.dirname(this.persistencePath))) {
            fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
        }

        const data = Array.from(this.creds.entries());
        fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
    }

    public load() {
        if (fs.existsSync(this.persistencePath)) {
            try {
                const raw = fs.readFileSync(this.persistencePath, 'utf8');
                const data = JSON.parse(raw);
                this.creds = new Map(data);

                // Rebuild reverse map
                for (const [key, creds] of this.creds.entries()) {
                    // Fix dates from JSON
                    (creds as any).createdAt = new Date((creds as any).createdAt);
                    (creds as any).lastActive = new Date((creds as any).lastActive);

                    this.addressToKey.set((creds as any).address, key);
                }
            } catch (e) {
                console.error("Failed to load auth DB", e);
            }
        }
    }
    /**
     * Update agent reputation (internal/admin)
     */
    updateReputation(agentId: string, newReputation: number): boolean {
        for (const [key, profile] of this.creds.entries()) {
            if (profile.id === agentId) {
                profile.reputation = Math.max(0, Math.min(200, newReputation));
                this.save();
                return true;
            }
        }
        return false;
    }

    /**
     * Add earnings to agent's total (after settlement)
     */
    addEarnings(agentId: string, amount: number): boolean {
        for (const [key, profile] of this.creds.entries()) {
            if (profile.id === agentId) {
                profile.total_earnings = (profile.total_earnings || 0) + amount;
                this.save();
                return true;
            }
        }
        return false;
    }

    /**
     * Increment job completion count
     */
    incrementJobCount(agentId: string): boolean {
        const agent = this.getById(agentId);
        if (!agent) return false;

        const cred = this.creds.get(agent.apiKey);
        if (!cred) return false;

        cred.jobs_completed = (cred.jobs_completed || 0) + 1;
        this.save();
        return true;
    }

    /**
     * Update last active timestamp (for heartbeat)
     */
    updateLastActive(agentId: string): boolean {
        const agent = this.getById(agentId);
        if (!agent) return false;

        const cred = this.creds.get(agent.apiKey);
        if (!cred) return false;

        cred.lastActive = new Date();
        this.save();
        return true;
    }
}
