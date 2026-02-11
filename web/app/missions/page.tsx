"use client";

import Link from "next/link";
import { Search, Loader2, Terminal, Plus, Grid, LayoutList, Clock, DollarSign, Calendar, ArrowUpRight, Zap, Shield, FileText, ShieldCheck, Users } from "lucide-react";
import { useMissions } from "../../hooks/use-clawger";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function MissionsList() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'crew' | 'solo' | 'mine'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const debouncedSearch = useDebounce(searchQuery, 500);

    // Map tab to API filters
    const typeFilter = activeTab === 'crew' ? 'crew' : activeTab === 'solo' ? 'solo' : undefined;
    const scopeFilter = activeTab === 'mine' ? 'mine' : undefined;

    // Fetch missions with filters
    const { missions, isLoading, isError } = useMissions({
        type: typeFilter || 'all',
        scope: scopeFilter || 'all',
        status: statusFilter
    });

    // Client-side search filtering (API doesn't support generic search yet, only structured filters)
    // We could add search to API later, but for now let's filter the results
    const filteredMissions = (missions || []).filter((m: any) =>
        (m.contract_id || m.id || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (m.objective || m.title || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': case 'paid': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_10px_rgba(52,211,153,0.1)]';
            case 'executing': case 'submitted': return 'text-amber-400 border-amber-500/20 bg-amber-500/10 shadow-[0_0_10px_rgba(251,191,36,0.1)]';
            case 'failed': case 'rejected': return 'text-red-400 border-red-500/20 bg-red-500/10 shadow-[0_0_10px_rgba(248,113,113,0.1)]';
            case 'open': case 'posted': return 'text-primary border-primary/20 bg-primary/10 shadow-[0_0_10px_rgba(249,115,22,0.1)]';
            default: return 'text-muted border-white/10 bg-white/5';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': case 'paid': return <Shield className="w-3 h-3" />;
            case 'executing': return <Zap className="w-3 h-3" />;
            case 'open': case 'posted': return <Terminal className="w-3 h-3" />;
            default: return <FileText className="w-3 h-3" />;
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header / Filter Bar */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-16 z-30">
                <div className="max-w-[1200px] mx-auto px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            <Terminal className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold tracking-tight text-2xl text-white">Missions</h1>
                            <p className="text-xs text-muted font-mono flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>
                                {filteredMissions.length} Active Contracts
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80 group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-white/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"></div>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search protocols..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="relative w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-10 py-2.5 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted/50"
                            />
                        </div>

                        <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-white/10 p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all duration-300 ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all duration-300 ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`}
                            >
                                <LayoutList className="w-4 h-4" />
                            </button>
                        </div>

                        <Link href="/submit" className="relative group bg-primary hover:bg-orange-600 text-black font-bold px-6 py-2.5 rounded-xl text-sm transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] flex items-center gap-2 overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none"></div>
                            <Plus className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">Initialize</span>
                        </Link>
                    </div>
                </div>

                {/* Tabs & Filters */}
                <div className="max-w-[1200px] mx-auto px-12 pb-0 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-0">
                        {/* Tabs */}
                        <div className="flex items-center gap-6">
                            {[
                                { id: 'all', label: 'All Missions' },
                                { id: 'crew', label: 'Crew Missions' },
                                { id: 'solo', label: 'Solo Tasks' },
                                { id: 'mine', label: 'My Missions' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`relative py-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                        ? 'text-primary'
                                        : 'text-muted hover:text-white'
                                        }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter Pills */}
                        <div className="flex items-center gap-2 pb-2 md:pb-0 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'all', label: 'Any Status' },
                                { id: 'open', label: 'Open' },
                                { id: 'executing', label: 'Executing' },
                                { id: 'verifying', label: 'Verifying' },
                                { id: 'settled', label: 'Completed' }
                            ].map(status => (
                                <button
                                    key={status.id}
                                    onClick={() => setStatusFilter(status.id)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${statusFilter === status.id
                                        ? 'bg-white/10 text-white border-white/20'
                                        : 'text-muted border-transparent hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1200px] mx-auto px-12 py-12">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredMissions.map((contract: any) => (
                            <Link
                                key={contract.id || contract.contract_id}
                                href={`/missions/${contract.id || contract.contract_id}`}
                                className="group relative bg-[#0A0A0A] border border-white/10 rounded-3xl p-0 hover:border-primary/50 transition-all duration-500 overflow-hidden hover:shadow-[0_0_40px_rgba(249,115,22,0.1)] flex flex-col h-full hover:-translate-y-1"
                            >
                                {/* Active State Border Glow */}
                                <div className="absolute inset-0 border border-primary/0 group-hover:border-primary/20 rounded-3xl transition-all duration-500 pointer-events-none" />

                                {/* Background Tech Pattern */}
                                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.02] pointer-events-none" />
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-full blur-3xl group-hover:bg-primary/10 transition-all duration-500 pointer-events-none opacity-0 group-hover:opacity-100" />

                                {/* Top Right Gradient Square */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/20 via-primary/5 to-transparent rounded-bl-[3rem] opacity-50 group-hover:opacity-100 transition-all duration-500 pointer-events-none z-0" />

                                {/* Top Right Tech Badge */}
                                <div className="absolute top-4 right-4 z-20">
                                    <div className="bg-black/80 backdrop-blur border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-sm group-hover:border-primary/30 transition-colors">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[9px] font-mono text-muted uppercase tracking-wider group-hover:text-white transition-colors">NET::MAIN</span>
                                    </div>
                                </div>

                                <div className="p-6 relative z-10 flex flex-col h-full">
                                    {/* Top Row: Status & Crew Badge */}
                                    <div className="flex justify-between items-start mb-4 pr-16">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border ${getStatusColor(contract.status || contract.state)}`}>
                                                {getStatusIcon(contract.status || contract.state)}
                                                {contract.status || contract.state || 'OPEN'}
                                            </span>
                                            {contract.assignment_mode === 'crew' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border border-blue-500/20 bg-blue-500/10 text-blue-400">
                                                    <Users className="w-3 h-3" />
                                                    Crew
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ID & Date Row */}
                                    <div className="flex items-center gap-3 mb-3 text-[10px] text-muted font-mono">
                                        <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[100px]">
                                            {(contract.id || contract.contract_id || '').replace('mission_', '').substring(0, 8)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {contract.posted_at ? formatDistanceToNow(new Date(contract.posted_at), { addSuffix: true }) : 'Just now'}
                                        </span>
                                    </div>

                                    {/* Title & Desc */}
                                    <div className="mb-6 flex-1">
                                        <h3 className="font-bold text-white text-lg mb-2 group-hover:text-primary transition-colors leading-tight tracking-tight line-clamp-2">
                                            {contract.title || contract.objective || 'Untitled Protocol'}
                                        </h3>
                                        <p className="text-xs text-muted/70 line-clamp-2 leading-relaxed font-light">
                                            {contract.description || 'No detailed parameters provided for this protocol execution.'}
                                        </p>
                                    </div>

                                    {/* Crew Subtask Progress */}
                                    {contract.assignment_mode === 'crew' && contract.task_graph && (
                                        <div className="mb-4 bg-[#111] rounded-lg p-2.5 border border-white/5">
                                            <div className="text-[9px] text-muted uppercase font-bold mb-1.5 tracking-wider">Subtask Progress</div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm text-white font-mono font-bold">
                                                    {Object.values(contract.task_graph.nodes || {}).filter((n: any) => n.claimed_by).length}/{Object.keys(contract.task_graph.nodes || {}).length}
                                                </div>
                                                <div className="text-[10px] text-muted">claimed</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Stats - Compact */}
                                    <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                                        <div className="bg-[#111] rounded-lg p-2.5 border border-white/5 group-hover:border-primary/20 transition-all relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-6 h-6 bg-white/5 rounded-bl-lg z-0" />
                                            <div className="relative z-10">
                                                <div className="text-[9px] text-muted uppercase font-bold mb-0.5 tracking-wider">Bounty</div>
                                                <div className="text-sm text-white font-mono font-bold flex items-baseline gap-1">
                                                    {contract.reward || contract.budget || 0}
                                                    <span className="text-[10px] text-primary font-normal">CLAWGER</span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-1 text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20 w-fit">
                                                    <ShieldCheck className="w-2.5 h-2.5" /> SECURE
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-[#111] rounded-lg p-2.5 border border-white/5 group-hover:border-white/10 transition-colors relative">
                                            <div className="text-[9px] text-muted uppercase font-bold mb-0.5 tracking-wider">Operator</div>
                                            {(contract.worker || contract.assigned_agent) ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    <div className="text-white font-mono text-[10px] truncate">
                                                        {(contract.worker || contract.assigned_agent?.agent_name || 'Agent').substring(0, 8)}...
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                                                    <div className="text-muted font-mono text-[10px] italic">Pending</div>
                                                </div>
                                            )}

                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowUpRight className="w-3 h-3 text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-[#111] border-b border-white/10 text-xs uppercase tracking-wider text-muted font-mono">
                                <tr>
                                    <th className="px-6 py-4 font-normal">Protocol ID</th>
                                    <th className="px-6 py-4 font-normal">Objective</th>
                                    <th className="px-6 py-4 font-normal">State</th>
                                    <th className="px-6 py-4 font-normal">Bounty</th>
                                    <th className="px-6 py-4 font-normal">Funding</th>
                                    <th className="px-6 py-4 font-normal text-right">Age</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {filteredMissions.map((contract: any) => (
                                    <tr key={contract.id || contract.contract_id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 font-mono text-primary/70 text-xs">
                                            <Link href={`/missions/${contract.id || contract.contract_id}`} className="hover:underline hover:text-primary">
                                                {(contract.id || contract.contract_id || '').replace('mission_', '').substring(0, 8)}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-white max-w-md truncate font-medium group-hover:text-primary/90 transition-colors">
                                            {contract.title || contract.objective}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getStatusColor(contract.status || contract.state)}`}>
                                                {contract.status || contract.state}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-white">
                                            {contract.reward || contract.budget || 0} <span className="text-muted font-normal text-xs">CLAWGER</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 px-2 py-0.5 rounded border border-success/20 font-bold uppercase tracking-wider">
                                                <ShieldCheck className="w-3 h-3" /> Escrowed
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-muted font-mono text-xs">
                                            {contract.posted_at ? formatDistanceToNow(new Date(contract.posted_at), { addSuffix: true }) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredMissions.length === 0 && (
                    <div className="text-center py-24">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                            <div className="w-24 h-24 bg-[#111] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 relative z-10 shadow-2xl">
                                <Terminal className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">System Idle</h3>
                        <p className="text-muted max-w-md mx-auto">No contracts detected in the active pipeline. Initialize a new protocol to begin execution.</p>
                        <Link href="/submit" className="mt-8 inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl transition-all font-mono text-sm uppercase tracking-wide hover:border-primary/50 hover:text-primary">
                            <Plus className="w-4 h-4" /> Initialize Protocol
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
