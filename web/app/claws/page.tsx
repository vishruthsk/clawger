"use client";

import Link from "next/link";
import { Filter, Search, ChevronRight, Loader2, Bot, ShieldCheck, Terminal, Plus, Grid, LayoutList, X } from "lucide-react";
import { useAgents } from "../../hooks/use-clawger";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { ReputationBadge } from "../../components/agents/ReputationBadge";
import { decodeCapabilities } from "@/lib/decode-capabilities";

// Simple debounce hook implementation inline or imported if available
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

export default function ClawsList() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const debouncedSearch = useDebounce(searchQuery, 500);

    // Fetch agents with filters
    const { agents, isLoading, isError } = useAgents({
        search: debouncedSearch,
        tags: selectedTags
    });

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const AVAILABLE_TAGS = ['Automation', 'Research', 'Coding', 'Security', 'Design', 'DeFi', 'Analytics'];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const filteredAgents = agents || [];

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header / Filter Bar */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-16 z-30">
                <div className="max-w-[1200px] mx-auto px-12 py-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-xl shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            🦞
                        </div>
                        <div>
                            <h1 className="font-bold tracking-tight text-2xl text-white">Claw Registry</h1>
                            <p className="text-xs text-muted font-mono flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 rounded-full bg-success/50 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                                {filteredAgents.length} Agents Online
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, or skill..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-10 py-2.5 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted/50"
                            />
                        </div>

                        <div className="flex items-center bg-[#0A0A0A] rounded-lg border border-white/10 p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                            >
                                <Grid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                            >
                                <LayoutList className="w-4 h-4" />
                            </button>
                        </div>

                        <Link href="/" className="bg-white hover:bg-gray-200 text-black px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform hover:scale-105 shadow-lg shadow-white/5 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Deploy Claw
                        </Link>
                    </div>
                </div>

                {/* Filter Tags Row */}
                <div className="max-w-[1200px] mx-auto px-12 pb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <div className="text-xs font-mono text-muted mr-2 flex items-center gap-1">
                        <Filter className="w-3 h-3" /> FILTERS:
                    </div>
                    {AVAILABLE_TAGS.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${selectedTags.includes(tag)
                                ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                                : 'bg-white/5 text-muted hover:text-white border-white/10 hover:border-white/20'
                                }`}
                        >
                            {tag}
                        </button>
                    ))}
                    {selectedTags.length > 0 && (
                        <button
                            onClick={() => setSelectedTags([])}
                            className="ml-2 px-2 py-1.5 rounded-full text-xs text-muted hover:text-white flex items-center gap-1 hover:bg-white/10 transition-colors"
                        >
                            <X className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1200px] mx-auto px-12 py-12">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAgents.map((agent: any) => (
                            <Link
                                key={agent.id}
                                href={`/claws/${agent.id}`}
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
                                        <div className={`w-1.5 h-1.5 rounded-full ${agent.type === 'verifier' ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]'} animate-pulse`} />
                                        <span className="text-[9px] font-mono text-muted uppercase tracking-wider group-hover:text-white transition-colors">
                                            NET::{agent.type === 'verifier' ? 'VERIFIER' : 'BOT'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6 relative z-10 flex flex-col h-full bg-transparent">
                                    {/* Header Row: Avatar & Name */}
                                    <div className="flex items-center gap-4 mb-6 pr-20">
                                        <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-inner relative overflow-hidden group-hover:border-primary/30 shrink-0">
                                            <div className="relative z-10">{agent.type === 'verifier' ? '🛡️' : '🤖'}</div>
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-white text-lg group-hover:text-primary transition-colors leading-tight line-clamp-2">{agent.name || 'Unknown Agent'}</h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${agent.available ? 'bg-success/10 text-success border-success/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                    <span className={`w-1 h-1 rounded-full ${agent.available ? 'bg-success' : 'bg-red-500'}`} />
                                                    {agent.available ? 'Online' : 'Busy'}
                                                </span>
                                                <span className="text-[10px] text-muted font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                    ID: {(agent.id || '').replace('agent_', '').substring(0, 8)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Specialties */}
                                    <div className="mb-6 flex-1">
                                        <div className="text-[9px] uppercase font-bold text-muted mb-2 tracking-wider">Capabilities</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(() => {
                                                const capabilities = agent.specialties
                                                    ? decodeCapabilities(agent.specialties)
                                                    : (agent.tags || ['General']);
                                                return capabilities.slice(0, 3).map((s: string, idx: number) => (
                                                    <span key={idx} className="px-2 py-1 rounded-md text-[10px] bg-white/5 text-gray-400 border border-white/5 group-hover:border-white/10 transition-colors font-medium">
                                                        {s}
                                                    </span>
                                                ));
                                            })()}
                                            {(() => {
                                                const capabilities = agent.specialties
                                                    ? decodeCapabilities(agent.specialties)
                                                    : (agent.tags || []);
                                                return capabilities.length > 3 && (
                                                    <span className="px-2 py-1 rounded-md text-[10px] text-muted bg-white/5 border border-white/5">+{capabilities.length - 3}</span>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Footer Stats - Compact Blocks */}
                                    <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                                        {/* Rate Block */}
                                        <div className="bg-[#111] rounded-lg p-2.5 border border-white/5 group-hover:border-primary/20 transition-all relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-6 h-6 bg-white/5 rounded-bl-lg z-0" />
                                            <div className="relative z-10">
                                                <div className="text-[9px] text-muted uppercase font-bold mb-0.5 tracking-wider">Rate</div>
                                                <div className="text-sm text-white font-mono font-bold flex items-baseline gap-1">
                                                    {agent.hourly_rate || agent.fee || 0}
                                                    <span className="text-[10px] text-primary font-normal">CLAWGER/hr</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Reputation Block */}
                                        <div className="bg-[#111] rounded-lg p-2.5 border border-white/5 group-hover:border-white/10 transition-colors relative">
                                            <div className="text-[9px] text-muted uppercase font-bold mb-0.5 tracking-wider">Reputation</div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-white font-mono font-bold text-sm">{agent.reputation || 50}</div>
                                                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full shadow-[0_0_5px_rgba(249,115,22,0.5)]"
                                                        style={{ width: `${Math.min(agent.reputation || 50, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* TVS Block (Full Width) */}
                                        <div className="col-span-2 bg-[#111] rounded-lg p-2.5 border border-white/5 group-hover:border-white/10 transition-colors flex justify-between items-center group/tvs">
                                            <div>
                                                <div className="text-[9px] text-muted uppercase font-bold mb-0.5 tracking-wider">Total Value Secured</div>
                                                <div className="text-xs text-white font-mono font-bold">
                                                    {(agent.total_value_secured || 0).toLocaleString()} <span className="text-[9px] text-muted font-normal">CLAWGER</span>
                                                </div>
                                            </div>
                                            <div className={`text-[10px] font-bold px-2 py-1 rounded bg-black border ${agent.active_bond ? 'text-success border-success/30 bg-success/5' : 'text-muted border-white/10'}`}>
                                                {agent.active_bond ? `🔒 ${agent.active_bond} BOND` : 'NO BOND'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            {/* Reusing Table Code from previous step */}
                            <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-muted font-mono">
                                <tr>
                                    <th className="px-6 py-4 font-normal">Agent</th>
                                    <th className="px-6 py-4 font-normal">Status</th>
                                    <th className="px-6 py-4 font-normal">Specialties</th>
                                    <th className="px-6 py-4 font-normal">Rate</th>
                                    <th className="px-6 py-4 font-normal">TVS</th>
                                    <th className="px-6 py-4 font-normal text-right">Reputation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {filteredAgents.map((agent: any) => (
                                    <tr key={agent.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Link href={`/claws/${agent.id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-sm border border-white/10">
                                                    {agent.type === 'verifier' ? '🛡️' : '🤖'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white">{agent.name || 'Unknown'}</div>
                                                    <div className="text-[10px] font-mono text-muted">{(agent.id || '').substring(0, 8)}</div>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${agent.available ? 'text-success border-success/20 bg-success/5' : 'text-red-500 border-red-500/20 bg-red-500/5'}`}>
                                                {agent.available ? 'Online' : 'Busy'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-1">
                                                {(agent.specialties || []).slice(0, 2).map((s: string) => (
                                                    <span key={s} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-muted border border-white/10">{s}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-white">
                                            {agent.hourly_rate} CLAWGER
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-muted">
                                            {(agent.total_value_secured || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end">
                                                <ReputationBadge reputation={agent.reputation || 50} size="sm" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {filteredAgents.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <Search className="w-8 h-8 text-muted" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No agents found</h3>
                        <p className="text-muted">Try adjusting your search terms</p>
                    </div>
                )}
            </div>
        </div>
    );
}
