"use client";

import { useMissions } from "@/hooks/use-clawger";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, Clock, ShieldCheck, Terminal, Zap, Shield, FileText, ArrowUpRight, Search, LayoutList, Grid } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface MissionManagerProps {
    userIdentity: "wallet" | "agent" | "guest";
    profile: any;
    address?: string;
    token?: string; // Passed from parent if needed (e.g. API key)
}

export default function MissionManager({ userIdentity, profile, address, token }: MissionManagerProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'executing' | 'verifying' | 'settled'>('all');

    // Determine scope based on identity
    // If Wallet: view missions I posted (requester_id = address)
    // If Agent: view missions assigned to me (scope = assigned_to_me)

    // For Wallet, we pass requester_id filter.
    // For Agent, we pass scope='assigned_to_me' and the token.

    const filters: any = { status: statusFilter };
    let authToken = token;

    if (userIdentity === 'wallet' && address) {
        filters.requester_id = address;
        filters.scope = 'mine';
        // Note: Wallet auth usually via cookie/headers implicitly if strictly using session, 
        // but here we might need to rely on the API trusting the 'requester_id' filter for public view, 
        // OR we need to pass a signed token. 
        // For this MVP, let's assume 'requester_id' filter works publicly or the hook handles it.
        // Actually, the API filters missions by requester_id.
    } else if (userIdentity === 'agent') {
        filters.scope = 'assigned_to_me';
    }

    const { missions, isLoading } = useMissions(filters, authToken);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'settled': case 'paid': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
            case 'executing': case 'submitted': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
            case 'failed': case 'rejected': return 'text-red-400 border-red-500/20 bg-red-500/10';
            case 'open': case 'posted': return 'text-primary border-primary/20 bg-primary/10';
            default: return 'text-muted border-white/10 bg-white/5';
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    const missionList = missions || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg">
                        {userIdentity === 'agent' ? 'Assigned Operations' : 'My Protocols'}
                    </h3>
                    <p className="text-xs text-muted">
                        {userIdentity === 'agent'
                            ? 'Operations dispatched to your unit.'
                            : 'Protocols initialized by your address.'}
                    </p>
                </div>

                <div className="flex bg-[#0A0A0A] border border-white/10 rounded-lg p-1">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === 'all' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setStatusFilter('open')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === 'open' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setStatusFilter('executing')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === 'executing' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setStatusFilter('settled')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === 'settled' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                    >
                        Done
                    </button>
                </div>
            </div>

            {missionList.length === 0 ? (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-8 h-8 text-muted" />
                    </div>
                    <h4 className="font-bold text-lg mb-2">No Active Protocols</h4>
                    <p className="text-muted text-sm max-w-md mx-auto mb-6">
                        {userIdentity === 'agent'
                            ? 'No missions currently assigned. Check the open market.'
                            : 'You haven\'t deployed any protocols yet.'}
                    </p>
                    {userIdentity !== 'agent' && (
                        <Link href="/submit" className="inline-flex items-center gap-2 bg-primary hover:bg-orange-600 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                            Initialize New Protocol
                        </Link>
                    )}
                </div>
            ) : (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-[#111] border-b border-white/10 text-xs uppercase tracking-wider text-muted font-mono">
                            <tr>
                                <th className="px-6 py-4 font-normal">Protocol</th>
                                <th className="px-6 py-4 font-normal">Status</th>
                                <th className="px-6 py-4 font-normal">Bounty</th>
                                <th className="px-6 py-4 font-normal">Operator</th>
                                <th className="px-6 py-4 font-normal text-right">Updated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {missionList.map((mission: any) => (
                                <tr key={mission.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <Link href={`/missions/${mission.id}`} className="font-medium text-white hover:text-primary transition-colors mb-0.5">
                                                {mission.title}
                                            </Link>
                                            <span className="text-[10px] text-muted font-mono">{mission.id.substring(0, 12)}...</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusColor(mission.status)}`}>
                                            {mission.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-white">
                                        {mission.reward} <span className="text-muted font-normal text-xs">CL</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {mission.assigned_agent ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span className="text-xs text-white font-mono">{mission.assigned_agent.agent_name || mission.assigned_agent.agent_id.substring(0, 8)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted italic">Unassigned</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right text-muted font-mono text-xs">
                                        {mission.updated_at ? formatDistanceToNow(new Date(mission.updated_at), { addSuffix: true }) : formatDistanceToNow(new Date(mission.created_at || new Date()), { addSuffix: true })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
