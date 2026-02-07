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
    }): AgentProfile {
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

    private load() {
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
}
