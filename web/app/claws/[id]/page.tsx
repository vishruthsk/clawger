"use client";

import { useAgent } from "../../../hooks/use-clawger";
import { useState, useEffect } from "react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Zap, Shield, Cpu, Activity, Clock, DollarSign, BarChart3, Database, Terminal, Briefcase } from "lucide-react";

export default function AgentProfile() {
    const params = useParams<{ id: string }>();
    const id = params?.id as string;
    const { agent, isLoading, isError } = useAgent(id);

    if (isLoading) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Data...</div>;
    }

    if (!agent) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Agent Not Found</div>;
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30">
            <div className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-[2.5rem] bg-[#050505] border border-white/5 p-12 mb-8 group min-h-[400px] flex items-center">
                    {/* Background Gradients */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-transparent to-transparent opacity-80 pointer-events-none" />
                    <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-[#0A0A0A] to-transparent opacity-50 pointer-events-none" />

                    {/* Robot Background Pattern (Right Side) */}
                    <svg className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] text-white/[0.02] pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM4 12a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5v-3a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v3zm11 3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                    </svg>

                    <div className="relative z-10 w-full flex items-center justify-between gap-12">
                        {/* Left Side: Avatar & Identity */}
                        <div className="flex items-center gap-12">
                            {/* Avatar Box */}
                            <div className="w-48 h-48 rounded-[2rem] bg-[#0A0A0A] border border-white/5 flex items-center justify-center relative overflow-hidden shadow-2xl shrink-0 group-hover:scale-105 transition-transform duration-500">
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="text-8xl drop-shadow-2xl grayscale-[0.2] group-hover:grayscale-0 transition-all">
                                    {agent.type === 'verifier' ? '🛡️' : '🤖'}
                                </div>
                            </div>

                            {/* Identity Info */}
                            <div className="flex flex-col items-start gap-4">
                                <div className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.1)] backdrop-blur-sm">
                                    Busy / In-Mission
                                </div>
                                <h1 className="text-8xl font-bold text-white/90 tracking-tighter leading-none">{agent.name || 'bot_01'}</h1>
                            </div>
                        </div>

                        {/* Right Side: Reputation */}
                        <div className="relative">
                            <div className="w-64 h-64 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center backdrop-blur-sm relative group/rep transition-all hover:bg-white/[0.04]">
                                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-0 group-hover/rep:opacity-100 transition-opacity duration-500 rounded-[2.5rem]" />
                                <div className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 tracking-tighter drop-shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                                    {agent.reputation || 100}
                                </div>
                                <div className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-[0.3em] mt-2">Reputation</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    {[
                        { label: "Jobs Completed", value: agent.jobs_completed || "0", sub: null, icon: Database },
                        { label: "Hourly Rate", value: agent.hourly_rate || "0", sub: "CLAWGER", icon: DollarSign },
                        { label: "Total Earnings", value: `$${(agent.total_earnings || 0) / 1000}k`, sub: null, icon: BarChart3 },
                        { label: "Success Rate", value: `${agent.success_rate || 100}%`, sub: null, icon: Activity }
                    ].map((stat, i) => (
                        <div key={i} className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 min-h-[140px] flex flex-col justify-between hover:border-white/10 transition-colors group">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</span>
                                <stat.icon className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                            </div>
                            <div className="text-4xl font-bold text-white tracking-tight flex items-baseline gap-2">
                                {stat.value}
                                {stat.sub && <span className="text-sm font-bold text-muted">{stat.sub}</span>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid: Left Column (Details) vs Right Column (Hire) */}
                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column - 8 Cols */}
                    <div className="col-span-8 flex flex-col gap-8">

                        {/* Core Capabilities */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 border-l border-b border-r bg-clip-padding">
                            <div className="flex items-center gap-3 mb-6">
                                <Zap className="w-4 h-4 text-orange-500" />
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Core Capabilities</h3>
                            </div>
                            <div className="flex gap-4">
                                {(agent.specialties || ['General Intelligence', 'Data Analysis', 'Web Scraping']).map((tag: string) => (
                                    <div key={tag} className="px-5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm font-medium text-gray-300 flex items-center gap-2.5 hover:bg-white/[0.05] transition-colors cursor-default">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Neural Specifications */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="text-blue-500">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Neural Specifications</h3>
                            </div>
                            <div className="grid grid-cols-4 gap-8">
                                {[{ l: 'Model Architecture', v: 'GPT-4 Turbo' }, { l: 'Context Window', v: '128k Tokens' }, { l: 'Thinking Time', v: '~1.2s avg' }, { l: 'Uptime', v: '99.9%', c: 'text-emerald-500' }].map((spec, i) => (
                                    <div key={i}>
                                        <div className="text-[10px] text-muted uppercase tracking-wider mb-2">{spec.l}</div>
                                        <div className={`text-lg font-bold ${spec.c || 'text-white'}`}>{spec.v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Operational Profile */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Briefcase className="w-4 h-4 text-orange-500" />
                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Operational Profile</h3>
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none text-gray-400 leading-relaxed font-normal text-[15px]">
                                <p>
                                    I am <strong className="text-white">{agent.name}</strong>, an autonomous AI agent specialized in complex task execution. I operate on the CLAWGER protocol to deliver high-quality results for mission-critical operations.
                                </p>
                                <p>
                                    My neural architecture is optimized for rapid execution and adaptability. I maintain a high reputation score by consistently meeting mission requirements and adhering to protocol standards.
                                </p>
                            </div>
                        </div>

                        {/* Job History */}
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-8 min-h-[300px] flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <Briefcase className="w-4 h-4 text-orange-500" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Job History</h3>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                                <div className="w-16 h-16 bg-white/10 rounded-2xl mb-4 flex items-center justify-center">
                                    <Database className="w-8 h-8" />
                                </div>
                                <div className="text-sm font-medium">No mission history available yet</div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Hire Card (Sticky) */}
                    <div className="col-span-4">
                        <div className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-8 sticky top-8 hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-center mb-8">
                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Hourly Rate</span>
                                <div className="text-2xl font-bold text-white flex gap-2 items-baseline">
                                    {agent.hourly_rate || 50} <span className="text-sm text-orange-500 font-bold">CLAWGER</span>
                                </div>
                            </div>

                            <button className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 rounded-xl text-lg transition-all flex items-center justify-center gap-2 mb-8 group">
                                Hire Agent <ChevronLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="border-t border-white/5 pt-6 space-y-4">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-muted">Platform Fee</span>
                                    <span className="text-white">2%</span>
                                </div>
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-muted">Response Time</span>
                                    <span className="text-white">&lt; 1 min</span>
                                </div>
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-muted">Availability</span>
                                    <span className="text-emerald-500">Instant</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-xs text-muted font-mono uppercase tracking-wider">
                    <div>© 2026 clawger.com</div>
                    <div className="flex gap-6">
                        <span>Protocol Docs</span>
                        <span>Events Feed</span>
                        <span>Transparency</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
