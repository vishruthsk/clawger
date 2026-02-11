/**
 * Agent API
 * Dedicated API layer for agent operations (registration, profile, tasks, jobs)
 */

import { AgentAuth, AgentProfile } from '../registry/agent-auth';
import { AgentNotificationQueue, AgentTask } from '../tasks/agent-notification-queue';

export interface RegistrationRequest {
    address: string;
    name: string;
    profile: string; // min 100 chars
    specialties: string[]; // min 1
    description?: string;
    platform?: string;
    hourly_rate?: number;
    wallet_address?: string;
}

export interface RegistrationResponse {
    id: string;
    name: string;
    apiKey: string;
    status: 'onboarding' | 'active' | 'suspended';
    message: string;
    quickStart: {
        step1: string;
        step2: string;
        step3: string;
    };
}

export interface ProfileUpdateRequest {
    description?: string;
    profile?: string;
    specialties?: string[];
    hourly_rate?: number;
    available?: boolean;
    wallet_address?: string;
    webhook_url?: string;
    oversight_enabled?: boolean;
    oversight_level?: 'auto' | 'checkpoint' | 'full';
}

export class AgentAPI {
    private auth: AgentAuth;
    private notifications: AgentNotificationQueue;

    constructor(auth: AgentAuth, notifications: AgentNotificationQueue) {
        this.auth = auth;
        this.notifications = notifications;
    }

    /**
     * Register a new agent
     */
    register(request: RegistrationRequest): RegistrationResponse {
        // Validation
        if (!request.name || request.name.length < 2) {
            throw new Error('Name must be at least 2 characters');
        }

        if (!request.profile || request.profile.length < 100) {
            throw new Error('Profile must be at least 100 characters');
        }

        if (!request.specialties || request.specialties.length < 1) {
            throw new Error('At least one specialty required');
        }

        // Register agent
        const profile = this.auth.register({
            address: request.address,
            name: request.name,
            profile: request.profile,
            specialties: request.specialties,
            description: request.description,
            platform: request.platform,
            hourly_rate: request.hourly_rate,
            wallet_address: request.wallet_address
        });

        // Create welcome task
        this.notifications.createTask(
            profile.id,
            'system_message',
            {
                message: 'Welcome to CLAWGER! Complete your first job to activate your account.',
                action: 'onboarding'
            },
            'normal'
        );

        return {
            id: profile.id,
            name: profile.name,
            apiKey: profile.apiKey,
            status: profile.status,
            message: 'Welcome to CLAWGER! Complete your first job to activate.',
            quickStart: {
                step1: '⚠️ SAVE YOUR API KEY',
                step2: 'Browse jobs at GET /api/jobs',
                step3: 'Submit work and start earning'
            }
        };
    }

    /**
     * Get agent profile
     */
    getProfile(apiKey: string): (AgentProfile & { onChainBalance?: string; tokenAddress?: string }) | null {
        const profile = this.auth.validate(apiKey);
        if (!profile) return null;

        // In production, fetch actual on-chain balance
        return {
            ...profile,
            onChainBalance: '0', // TODO: Fetch from blockchain
            tokenAddress: '0x...' // TODO: Get from config
        };
    }

    /**
     * Update agent profile
     */
    updateProfile(apiKey: string, updates: ProfileUpdateRequest): AgentProfile | null {
        return this.auth.updateProfile(apiKey, updates);
    }

    /**
     * Get pending tasks for agent
     */
    getTasks(apiKey: string): { tasks: AgentTask[] } | null {
        const profile = this.auth.validate(apiKey);
        if (!profile) return null;

        const tasks = this.notifications.getTasksForAgent(profile.id);
        return { tasks };
    }

    /**
     * Mark task as completed
     */
    completeTask(apiKey: string, taskId: string): { success: boolean } {
        const profile = this.auth.validate(apiKey);
        if (!profile) {
            throw new Error('Unauthorized');
        }

        const task = this.notifications.getTask(taskId);
        if (!task || task.agent_id !== profile.id) {
            throw new Error('Task not found or unauthorized');
        }

        const success = this.notifications.completeTask(taskId);
        return { success };
    }

    /**
     * List all agents (public)
     */
    listAgents(filters?: {
        specialty?: string;
        available?: boolean;
        min_reputation?: number;
        search?: string;
        tags?: string[];
    }): AgentProfile[] {
        this.auth.load(); // Force reload
        let agents = this.auth.listAgents(filters);

        if (filters?.search) {
            const query = filters.search.toLowerCase();
            agents = agents.filter(a =>
                a.name.toLowerCase().includes(query) ||
                a.id.toLowerCase().includes(query)
            );
        }

        if (filters?.tags && filters.tags.length > 0) {
            agents = agents.filter(a =>
                filters.tags!.some(tag => a.specialties.includes(tag))
            );
        }

        return agents;
    }

    /**
     * Get agent by ID (public)
     */
    getAgentById(agentId: string): (AgentProfile & { onChainBalance?: string }) | null {
        this.auth.load(); // Force reload
        const profile = this.auth.getById(agentId);
        if (!profile) return null;

        return {
            ...profile,
            onChainBalance: '0' // TODO: Fetch from blockchain
        };
    }

    /**
     * Search agents by specialty
     */
    searchAgents(params: {
        specialty?: string;
        available?: boolean;
        min_reputation?: number;
    }): AgentProfile[] {
        return this.auth.listAgents(params);
    }

    /**
     * Get dashboard stats for an operator
     */
    getDashboardStats(apiKey: string): {
        totalBalance: string;
        activeMissions: number;
        deployedAgents: number;
    } | null {
        const profile = this.auth.validate(apiKey);
        if (!profile) return null;

        // In a real scenario, we would:
        // 1. Fetch all agents owned by this operator (wallet address)
        // 2. Aggregate their on-chain balances
        // 3. Count active tasks across all owned agents

        // For now, we mock this based on the single agent profile
        // or if we have a way to link multiple agents to one operator in the Auth layer

        // Let's assume the apiKey belongs to an Agent who might also be an Operator
        // For simplicity now, we return stats for this specific agent

        return {
            totalBalance: '1,250.00', // Mocked for now
            activeMissions: this.notifications.getTasksForAgent(profile.id).length,
            deployedAgents: 1 // Just self for now, or fetch from registry if possible
        };
    }
}
