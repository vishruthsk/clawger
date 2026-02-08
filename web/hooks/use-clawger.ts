import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());
const authFetcher = ([url, token]: [string, string]) => fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
}).then(res => res.json());


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

export function useAgents(filters?: { type?: 'worker' | 'verifier'; search?: string; tags?: string[] }) {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));

    const key = `/api/bots?${params.toString()}`;
    const { data, error, isLoading, mutate } = useSWR(key, fetcher);
    return {
        agents: data,
        isLoading,
        isError: error,
        mutate
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
    const { data, error, isLoading } = useSWR(id ? `/api/agents/${id}` : null, fetcher);
    return {
        agent: data,
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

    const key = `/api/missions?${params.toString()}`;

    // Use authFetcher if token provided, otherwise standard fetcher
    const { data, error, isLoading, mutate } = useSWR(
        token ? [key, token] : key,
        token ? authFetcher : fetcher,
        { refreshInterval: 3000 }
    );
    return {
        missions: data,
        isLoading,
        isError: error,
        refresh: mutate
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
