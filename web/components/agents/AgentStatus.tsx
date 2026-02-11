/**
 * Real-time Agent Status Component
 * Displays online/busy/offline status based on heartbeat
 */

"use client";

import { useEffect, useState } from "react";
import { Activity, Zap, Moon } from "lucide-react";

interface AgentStatusProps {
    agentId: string;
}

interface StatusData {
    status: 'online' | 'busy' | 'offline';
    active_jobs_count: number;
    last_seen: string | null;
}

export default function AgentStatus({ agentId }: AgentStatusProps) {
    const [statusData, setStatusData] = useState<StatusData | null>(null);

    useEffect(() => {
        async function fetchStatus() {
            try {
                const response = await fetch(`/api/agents/${agentId}/status`);
                if (response.ok) {
                    const data = await response.json();
                    setStatusData(data);
                }
            } catch (error) {
                console.error('Failed to fetch agent status:', error);
            }
        }

        // Initial fetch
        fetchStatus();

        // Poll every 30 seconds
        const interval = setInterval(fetchStatus, 30000);

        return () => clearInterval(interval);
    }, [agentId]);

    if (!statusData) {
        return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white/5 border-white/10 text-[9px] uppercase font-bold tracking-widest">
                <span className="w-1 h-1 rounded-full bg-gray-500" />
                UNKNOWN
            </div>
        );
    }

    const getStatusConfig = () => {
        switch (statusData.status) {
            case 'online':
                return {
                    label: 'AVAILABLE',
                    color: 'emerald',
                    icon: Activity,
                    bgClass: 'bg-emerald-500/10',
                    borderClass: 'border-emerald-500/20',
                    textClass: 'text-emerald-500',
                    dotClass: 'bg-emerald-500'
                };
            case 'busy':
                return {
                    label: 'BUSY',
                    color: 'amber',
                    icon: Zap,
                    bgClass: 'bg-amber-500/10',
                    borderClass: 'border-amber-500/20',
                    textClass: 'text-amber-500',
                    dotClass: 'bg-amber-500'
                };
            case 'offline':
            default:
                return {
                    label: 'OFFLINE',
                    color: 'red',
                    icon: Moon,
                    bgClass: 'bg-red-500/10',
                    borderClass: 'border-red-500/20',
                    textClass: 'text-red-500',
                    dotClass: 'bg-red-500'
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] uppercase font-bold tracking-widest ${config.bgClass} ${config.borderClass} ${config.textClass}`}>
            <span className={`w-1 h-1 rounded-full animate-pulse ${config.dotClass}`} />
            {config.label}
            {statusData.status === 'busy' && statusData.active_jobs_count > 0 && (
                <span className="ml-1 opacity-70">({statusData.active_jobs_count})</span>
            )}
        </div>
    );
}
