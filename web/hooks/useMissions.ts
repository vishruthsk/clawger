/**
 * useMissions Hook
 * 
 * Fetches and merges production + demo missions.
 * Production missions come from /api/missions (real Postgres/Indexer data).
 * Demo missions come from /api/demo/missions (in-memory only).
 */

import { useState, useEffect } from 'react';
import { DEMO_MODE_ENABLED } from '@/demo/demo-constants';

export interface Mission {
    id: string;
    title: string;
    description: string;
    reward: number;
    status: string;
    assignment_mode?: 'autopilot' | 'bidding';
    requester_id?: string;
    posted_at?: string;
    specialties?: string[];
    requirements?: string[];
    deliverables?: string[];
    tags?: string[];
    escrow?: {
        locked: boolean;
        amount: number;
    };
    demo?: boolean; // CRITICAL: Demo flag
}

interface UseMissionsOptions {
    status?: string;
    specialty?: string;
    min_reward?: number;
    max_reward?: number;
}

interface UseMissionsResult {
    missions: Mission[];
    productionMissions: Mission[];
    demoMissions: Mission[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useMissions(options: UseMissionsOptions = {}): UseMissionsResult {
    const [productionMissions, setProductionMissions] = useState<Mission[]>([]);
    const [demoMissions, setDemoMissions] = useState<Mission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMissions = async () => {
        setLoading(true);
        setError(null);

        try {
            // Build query params
            const params = new URLSearchParams();
            if (options.status) params.append('status', options.status);
            if (options.specialty) params.append('specialty', options.specialty);
            if (options.min_reward) params.append('min_reward', options.min_reward.toString());
            if (options.max_reward) params.append('max_reward', options.max_reward.toString());

            const queryString = params.toString();

            // Always fetch production missions
            const prodResponse = await fetch(`/api/missions${queryString ? `?${queryString}` : ''}`);
            if (!prodResponse.ok) {
                throw new Error(`Failed to fetch production missions: ${prodResponse.statusText}`);
            }
            const prodData = await prodResponse.json();
            setProductionMissions(prodData);

            // Always fetch demo missions for UI page filling
            // Demo missions are isolated and never interact with real protocol
            try {
                const demoResponse = await fetch(`/api/demo/missions${queryString ? `?${queryString}` : ''}`);
                if (demoResponse.ok) {
                    const demoData = await demoResponse.json();
                    setDemoMissions(demoData);
                    console.log(`[useMissions] Loaded ${prodData.length} production + ${demoData.length} demo missions`);
                } else if (demoResponse.status !== 404) {
                    console.warn('Demo missions endpoint returned non-404 error:', demoResponse.status);
                }
            } catch (demoError) {
                console.warn('Failed to fetch demo missions:', demoError);
                // Don't fail the whole request if demo fetch fails
            }
        } catch (err: any) {
            setError(err instanceof Error ? err.message : 'Failed to fetch missions');
            console.error('Error fetching missions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMissions();
    }, [options.status, options.specialty, options.min_reward, options.max_reward]);

    // Merge production and demo missions
    const allMissions = [...productionMissions, ...demoMissions];

    return {
        missions: allMissions,
        productionMissions,
        demoMissions,
        loading,
        error,
        refetch: fetchMissions,
    };
}
