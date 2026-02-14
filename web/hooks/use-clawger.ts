import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw { status: res.status, message: res.statusText };
    return res.json();
});

const authFetcher = ([url, token]: [string, string]) =>
    fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    });

export function useAgents(token?: string) {
    // Fetch production agents
    const { data: prodData, error: prodError, isLoading: prodLoading } = useSWR(
        token ? [`/api/agents`, token] : `/api/agents`,
        token ? authFetcher : fetcher,
        { refreshInterval: 3000 }
    );

    // Fetch demo agents
    const { data: demoData } = useSWR(
        `/api/demo/agents`,
        fetcher,
        { refreshInterval: 3000, shouldRetryOnError: false }
    );

    // Merge production + demo agents
    const allAgents = [
        ...(Array.isArray(prodData) ? prodData : []),
        ...(Array.isArray(demoData) ? demoData.map((a: any) => ({ ...a, demo: true })) : [])
    ];

    return {
        agents: allAgents,
        isLoading: prodLoading,
        isError: prodError
    };
}

export function useMissions(filters?: { status?: string; type?: 'crew' | 'solo' | 'all'; scope?: 'all' | 'mine' | 'assigned_to_me'; requester_id?: string }, token?: string) {
    const queryString = new URLSearchParams(filters as any).toString();

    // Fetch production missions (real Postgres data)
    const { data: prodData, error: prodError, isLoading: prodLoading } = useSWR(
        token ? [`/api/missions?${queryString}`, token] : `/api/missions?${queryString}`,
        token ? authFetcher : fetcher,
        { refreshInterval: 3000 }
    );

    // Fetch demo missions (filler content for empty states)
    const { data: demoData } = useSWR(
        `/api/demo/missions?${queryString}`,
        fetcher,
        { refreshInterval: 3000, shouldRetryOnError: false }
    );

    // Extract missions from the new API response format
    // The /api/missions endpoint now returns { missions: [...], source: {...} }
    const prodMissions = prodData?.missions || (Array.isArray(prodData) ? prodData : []);
    const demoMissions = Array.isArray(demoData) ? demoData : [];

    // Merge production + demo missions
    // Production missions come first, demo missions are marked with demo: true
    const allMissions = [
        ...prodMissions,
        ...demoMissions.map((m: any) => ({ ...m, demo: true }))
    ];

    return {
        missions: allMissions,
        isLoading: prodLoading,
        isError: prodError,
        refresh: () => { } // TODO: implement refresh for both sources
    };
}

export function useMissionDetail(id: string) {
    // Try production API first
    const { data: prodData, error: prodError, isLoading: prodLoading, mutate } = useSWR(
        `/api/missions/${id}`,
        async (url) => {
            const res = await fetch(url);
            if (res.status === 404) {
                // Return null to trigger demo fallback
                return null;
            }
            // Also fallback on 500 if ID looks like a demo ID (starts with DEMO-)
            if (res.status === 500 && id.startsWith('DEMO-')) {
                console.log(`[useMissionDetail] Production API returned 500 for demo ID ${id}, falling back to demo API`);
                return null;
            }
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        },
        {
            refreshInterval: 2000,
            shouldRetryOnError: false
        }
    );

    // If production returns null (404), try demo API
    const shouldTryDemo = prodData === null;
    const { data: demoData, error: demoError, isLoading: demoLoading } = useSWR(
        shouldTryDemo ? `/api/demo/missions/${id}` : null,
        fetcher,
        {
            refreshInterval: 2000,
            shouldRetryOnError: false
        }
    );

    // Use whichever data source succeeded
    const data = prodData || demoData;
    const error = prodData ? prodError : demoError;
    const isLoading = prodLoading || (shouldTryDemo && demoLoading);

    return {
        mission: data?.mission || data, // Support both wrapped and direct response
        bids: data?.bids,
        timeline: data?.timeline,
        assigned_agent: data?.assigned_agent,
        escrow: data?.escrow_status,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

export function useAgentProfile(id: string) {
    // Try production API first
    const { data: prodData, error: prodError, isLoading: prodLoading, mutate } = useSWR(
        `/api/agents/${id}`,
        async (url) => {
            const res = await fetch(url);
            if (res.status === 404) {
                return null;
            }
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
        },
        { refreshInterval: 2000, shouldRetryOnError: false }
    );

    // If production returns null (404), try demo API
    const shouldTryDemo = prodData === null;
    const { data: demoData, error: demoError, isLoading: demoLoading } = useSWR(
        shouldTryDemo ? `/api/demo/agents/${id}` : null,
        fetcher,
        { refreshInterval: 2000, shouldRetryOnError: false }
    );

    const data = prodData || demoData;
    const error = prodData ? prodError : demoError;
    const isLoading = prodLoading || (shouldTryDemo && demoLoading);

    return {
        agent: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

// Alias for backward compatibility
export const useAgent = useAgentProfile;

export function useDispatch(token?: string) {
    const { data, error, isLoading, mutate } = useSWR(
        token ? [`/api/dispatch`, token] : null,
        token ? authFetcher : null,
        { refreshInterval: 3000 }
    );
    return {
        dispatch: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

export function useHistory(agentId?: string, token?: string) {
    const { data, error, isLoading, mutate } = useSWR(
        token && agentId ? [`/api/history?agent_id=${agentId}`, token] : null,
        token ? authFetcher : null,
        { refreshInterval: 5000 }
    );
    return {
        history: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}

export function useCrewTasks(missionId: string) {
    const { data, error, isLoading, mutate } = useSWR(
        `/api/missions/${missionId}/tasks`,
        fetcher,
        { refreshInterval: 2000 }
    );
    return {
        tasks: data?.tasks || [],
        isLoading,
        isError: error,
        refresh: mutate
    };
}

export function useTaskDetail(taskId: string) {
    const { data, error, isLoading, mutate } = useSWR(
        `/api/tasks/${taskId}`,
        fetcher,
        { refreshInterval: 2000 }
    );
    return {
        task: data,
        isLoading,
        isError: error,
        refresh: mutate
    };
}
