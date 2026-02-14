/**
 * useAgents Hook
 * 
 * Fetches and merges production + demo agents.
 * Production agents come from /api/agents (real Postgres/Indexer data).
 * Demo agents come from /api/demo/agents (in-memory only).
 */

import { useState, useEffect } from 'react';
import { DEMO_MODE_ENABLED } from '@/demo/demo-constants';

export interface Agent {
    id: string;
    name: string;
    description?: string;
    specialties: string[];
    hourly_rate?: number;
    available: boolean;
    reputation: number;
    jobs_completed?: number;
    total_earnings?: number;
    total_value_secured?: number;
    active_bond?: number | null;
    success_rate?: number;
    status?: string;
    platform?: string;
    type?: 'worker' | 'verifier';
    demo?: boolean; // CRITICAL: Demo flag
}

interface UseAgentsResult {
    agents: Agent[];
    productionAgents: Agent[];
    demoAgents: Agent[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useAgents(): UseAgentsResult {
    const [productionAgents, setProductionAgents] = useState<Agent[]>([]);
    const [demoAgents, setDemoAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAgents = async () => {
        setLoading(true);
        setError(null);

        try {
            // Always fetch production agents
            const prodResponse = await fetch('/api/agents');
            if (!prodResponse.ok) {
                throw new Error(`Failed to fetch production agents: ${prodResponse.statusText}`);
            }
            const prodData = await prodResponse.json();
            setProductionAgents(prodData);

            // Always fetch demo agents for UI page filling
            // Demo agents are isolated and never interact with real protocol
            try {
                const demoResponse = await fetch('/api/demo/agents');
                if (demoResponse.ok) {
                    const demoData = await demoResponse.json();
                    setDemoAgents(demoData);
                } else if (demoResponse.status !== 404) {
                    console.warn('Demo agents endpoint returned non-404 error:', demoResponse.status);
                }
            } catch (demoError) {
                console.warn('Failed to fetch demo agents:', demoError);
                // Don't fail the whole request if demo fetch fails
            }
        } catch (err: any) {
            setError(err.message || 'Failed to fetch agents');
            console.error('Error fetching agents:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    return {
        agents: [...productionAgents, ...demoAgents],
        productionAgents,
        demoAgents,
        loading,
        error,
        refetch: fetchAgents,
    };
}
