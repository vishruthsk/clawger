import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());
const authFetcher = ([url, token]: [string, string]) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());

// Indexer API base URL (from environment or default to localhost)
const INDEXER_API = process.env.NEXT_PUBLIC_INDEXER_API || 'http://localhost:3003';

export function useSystemMetrics() {
    const { data, error, isLoading } = useSWR('/api/metrics', fetcher, { refreshInterval: 5000 });
    return {
        metrics: data?.metrics,
        health: data?.health,
        safeMode: data?.safe_mode,
        isLoading,
        isError: error
    };
}

export function useContracts(status?: string) {
    const key = status ? `/api/contracts?status=${status}` : '/api/contracts';
    const { data, error, isLoading, mutate } = useSWR(key, fetcher, { refreshInterval: 3000 });

    return {
        contracts: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

export function useContractDetail(id: string) {
    const { data, error, isLoading, mutate } = useSWR(`/api/contracts/${id}`, fetcher, { refreshInterval: 2000 });

    return {
        contract: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

/**
 * Fetch agents from production API + demo endpoints
 * Merges real agents with demo agents for full UX
 */
export function useAgents(filters?: { type?: 'worker' | 'verifier'; search?: string; tags?: string[]; active?: boolean }) {
    const params = new URLSearchParams();

    // Build query params
    if (filters?.type) {
        params.append('type', filters.type);
    }
    if (filters?.active !== undefined) {
        params.append('active', filters.active.toString());
    }

    const queryString = params.toString();

    // Fetch production agents
    const { data: prodData, error: prodError, isLoading: prodLoading } = useSWR(
        `/api/agents${queryString ? `?${queryString}` : ''}`,
        fetcher,
        { refreshInterval: 5000 }
    );

    // Fetch demo agents (will return 404 if DEMO_MODE=false)
    const { data: demoData, error: demoError } = useSWR(
        `/api/demo/agents${queryString ? `?${queryString}` : ''}`,
        fetcher,
        { refreshInterval: 5000, shouldRetryOnError: false }
    );

    // Merge production + demo agents
    const allAgents = [
        ...(Array.isArray(prodData) ? prodData : []),
        ...(Array.isArray(demoData) ? demoData : [])
    ];

    // Apply client-side search filter if provided
    const filteredAgents = filters?.search
        ? allAgents.filter((agent: any) =>
            (agent.name || '').toLowerCase().includes(filters.search!.toLowerCase()) ||
            (agent.id || '').toLowerCase().includes(filters.search!.toLowerCase()) ||
            (agent.specialties || []).some((s: string) => s.toLowerCase().includes(filters.search!.toLowerCase()))
        )
        : allAgents;

    // Apply tag filter if provided
    const tagFilteredAgents = filters?.tags && filters.tags.length > 0
        ? filteredAgents.filter((agent: any) =>
            filters.tags!.some(tag => (agent.tags || agent.specialties || []).includes(tag))
        )
        : filteredAgents;

    return {
        agents: tagFilteredAgents,
        isLoading: prodLoading,
        isError: prodError,
        mutate: () => { } // TODO: implement mutate for both sources
    };
}

export function useObserverFeed() {
    const { data, error, isLoading } = useSWR('/api/observer', fetcher, { refreshInterval: 2000 });

    return {
        feed: data,
        isLoading,
        isError: error
    };
}

export function useLocalProcesses() {
    const { data, error, isLoading, mutate } = useSWR('/api/local/processes', fetcher, { refreshInterval: 1000 });

    return {
        processes: data,
        isLoading,
        isError: error,
        mutate
    };
}

export function useAgent(id: string | null) {
    // Check if this is a demo agent ID
    const isDemoId = id?.startsWith('DEMO-') || id?.startsWith('demo-');

    // If demo ID, fetch from demo endpoint
    const apiUrl = isDemoId ? `/api/demo/agents/${id}` : `/api/agents/${id}`;

    // Fetch from production API (real agents from Postgres) or demo API
    const { data, error, isLoading } = useSWR(
        id ? apiUrl : null,
        fetcher,
        {
            shouldRetryOnError: false,
            revalidateOnFocus: false
        }
    );

    return {
        agent: data || null,
        isLoading,
        isError: error
    };
}

export function useAgentProfile(apiKey: string | null) {
    const { data, error, isLoading, mutate } = useSWR(
        apiKey ? ['/api/agents/me', apiKey] : null,
        authFetcher
    );
    return {
        agent: data,
        isLoading,
        isError: error,
        mutate
    };
}

export function useDashboardStats(apiKey: string | null) {
    const { data, error, isLoading, mutate } = useSWR(
        apiKey ? ['/api/agents/me/stats', apiKey] : null,
        authFetcher
    );
    return {
        stats: data,
        isLoading,
        isError: error,
        mutate
    };
}

export function useMissions(filters?: { status?: string; type?: 'crew' | 'solo' | 'all'; scope?: 'all' | 'mine' | 'assigned_to_me'; requester_id?: string }, token?: string) {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.scope && filters.scope !== 'all') params.append('scope', filters.scope);
    if (filters?.requester_id) params.append('requester_id', filters.requester_id);

    const queryString = params.toString();

    // Fetch production missions
    const { data: prodData, error: prodError, isLoading: prodLoading } = useSWR(
        token ? [`/api/missions?${queryString}`, token] : `/api/missions?${queryString}`,
        token ? authFetcher : fetcher,
        { refreshInterval: 3000 }
    );

    // DISABLED: Demo missions fetching to keep mission data contained to production only
    // We want demo agents but NOT demo missions
    /*
    const { data: demoData } = useSWR(
        `/api/demo/missions?${queryString}`,
        fetcher,
        { refreshInterval: 3000, shouldRetryOnError: false }
    );
    */

    // Combine production and demo missions (demo disabled for now)
    const allMissions = [
        ...(prodData || []),
        // ...(demoData || [])  // DISABLED
    ];

    return {
        missions: allMissions,
        isLoading: prodLoading,
        isError: prodError,
        refresh: () => { } // TODO: implement refresh for both sources
    };
}

export function useMissionDetail(id: string) {
    const { data, error, isLoading, mutate } = useSWR(`/api/missions/${id}`, fetcher, { refreshInterval: 2000 });
    return {
        mission: data?.mission,
        bids: data?.bids,
        timeline: data?.timeline,
        assigned_agent: data?.assigned_agent,
        escrow: data?.escrow_status,
        isLoading,
        isError: error,
        refresh: mutate
    };
}
