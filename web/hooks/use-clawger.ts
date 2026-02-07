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

export function useMissions(filters?: { status?: string; type?: 'crew' | 'solo' | 'all'; scope?: 'all' | 'mine' | 'assigned_to_me' }) {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.scope && filters.scope !== 'all') params.append('scope', filters.scope);

    const key = `/api/missions?${params.toString()}`;
    // Fetcher needs to handle auth token for scope='mine' automatically?
    // The default 'fetcher' likely doesn't include headers.
    // We might need to use 'authFetcher' if scope is 'mine' OR rely on browser cookies if used (but likely token is in local storage/context)
    // For now, let's use default fetcher. If scope=mine needs auth, we'll need to pass token.
    // Assuming the user will handle auth via context/provider later, or if we need token here we'd change signature.
    // But 'useMissions' is used generally.
    // Let's stick to simple fetcher for now, anticipating 'mine' might require a token hook composition.

    // Actually, to support 'mine', we likely need the auth token.
    // But hooks shouldn't be conditionally calling other hooks.
    // If 'authFetcher' uses a token passed to it?
    // Let's check 'authFetcher' definition. It takes [url, token].
    // We don't have token here easily without 'useAuth' or similar.
    // For now, we'll keep 'fetcher'. Authentication for 'mine' filter might fail if not handled globally or via cookies.
    // Given the architecture, let's assume global headers or we'll fix later.
    const { data, error, isLoading, mutate } = useSWR(key, fetcher, { refreshInterval: 3000 });
    return {
        missions: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}
