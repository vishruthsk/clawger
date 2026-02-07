"use client";

import { useAgent } from "../../../hooks/use-clawger";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Zap, Server, Activity, Briefcase, DollarSign, Trophy, Box, Bot } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function BotProfile() {
    const params = useParams();
    const id = params?.id as string;
    const { agent, isLoading, isError } = useAgent(id);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (isError || !agent) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
                <h1 className="text-2xl font-bold mb-4">Agent Not Found</h1>
                <Link href="/claws" className="text-primary hover:underline flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back to Registry
                </Link>
            </div>
        );
    }

    const capabilities = agent.specialties || ["General Intelligence", "Data Analysis", "Web Scraping"];
    const isVerifier = agent.type === 'verifier';

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary/20">
            {/* Header is handled by global layout */}

            {/* Top Right Orange Gradient */}
            {/* Top Right Orange Gradient - Corner Glow */}
            <div className="fixed -top-[200px] -right-[200px] w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" />

            <div className="max-w-[1200px] mx-auto px-12 pt-8 pb-10 relative z-10">
                <Link href="/claws" className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-muted transition-all duration-300 hover:text-white hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]">
                    <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform duration-300 text-primary/50 group-hover:text-primary" />
                    <span>Back to Registry</span>
                </Link>
            </div>

            <div className="max-w-[1200px] mx-auto px-12 pb-20 space-y-6">

                {/* 1. HERO SECTION (Full Width) */}
                <div className="relative w-full h-[260px] rounded-[2rem] overflow-hidden border border-white/10 group shadow-2xl transition-all duration-500 hover:shadow-[0_0_80px_-20px_rgba(255,255,255,0.15)] hover:border-white/20 hover:scale-[1.005]">

                    {/* Super Smooth Scan Effect (Left to Right and Back) */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none overflow-hidden">
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent blur-3xl animate-scan-horizontal scale-x-150" />
                    </div>

                    {/* Background & Gradients */}
                    <div className="absolute inset-0 bg-[#050505]" />

                    {/* The "Cool" Blue/Purple Glow behind avatar */}
                    <div className="absolute top-1/2 -left-20 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none" />
                    <div className="absolute top-1/2 -left-10 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

                    {/* Subtle Scanlines or Mesh */}
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />

                    {/* Content Container */}
                    <div className="relative h-full flex items-center px-12 z-10">

                        {/* Avatar Box - Large "Squircle" */}
                        <div className="w-[180px] h-[180px] bg-[#0E0E0E] rounded-[2.5rem] border border-white/10 flex items-center justify-center shadow-2xl relative shrink-0 mr-12 group-hover:border-primary/40 transition-all duration-500 shadow-black/50 overflow-hidden">
                            <div className="text-[5rem] relative z-10 transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl filter">
                                {isVerifier ? '🛡️' : '🤖'}
                            </div>
                            {/* Inner Glow/Sheen */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50" />
                            {/* Bottom Right Orange Gradient (Medium Intensity) */}
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
                        </div>

                        {/* Info Column */}
                        <div className="flex-1 flex flex-col justify-center h-full py-10">

                            {/* Status Pill - Smaller */}
                            <div className="mb-4">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] uppercase font-bold tracking-widest ${agent.available
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                    : 'bg-red-500/10 border-red-500/20 text-red-500'
                                    }`}>
                                    <span className={`w-1 h-1 rounded-full animate-pulse ${agent.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    {agent.available ? 'AVAILABLE' : 'BUSY'}
                                </div>
                            </div>

                            {/* Name & ID */}
                            <h1 className="text-6xl font-bold text-white/50 tracking-tight font-sans mb-1 drop-shadow-sm">
                                {agent.name || 'bot_01'}
                            </h1>
                            {/* ID visually hidden or subtle? Screenshot shows large Name. Keeping subtle ID if needed, or purely cosmetic. */}

                        </div>

                    </div>

                    {/* (Re-added Tilted Robot Watermark (Right Side) as requested) */}
                    <div className="absolute right-32 -bottom-24 text-white/[0.07] transform rotate-12 pointer-events-none select-none mix-blend-screen scale-[1.0] group-hover:scale-[1.05] group-hover:rotate-6 transition-all duration-700">
                        <Bot className="w-[350px] h-[350px] stroke-2" />
                    </div>

                    {/* Glass Reputation Card (Check layout position in screenshot - tends to be top right floating) */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-16 z-20">
                        <div className="w-44 h-32 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group/rep">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover/rep:opacity-100 transition-opacity" />



                            <span className="text-5xl font-mono font-bold text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] relative z-10">
                                {agent.reputation || 100}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-muted tracking-[0.2em] mt-2 group-hover/rep:text-white transition-colors relative z-10">Reputation</span>
                        </div>
                    </div>
                </div>


                {/* 2. STATS GRID (Full Width) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Jobs Completed" value={agent.jobs_completed || "0"} />
                    <StatCard label="Hourly Rate" value={agent.hourly_rate || "0"} unit="CLAWGER" />
                    <StatCard label="Total Earnings" value={agent.total_earnings || "$0.0k"} />
                    <StatCard label="Success Rate" value="100%" />
                </div>


                {/* 3. SPLIT CONTENT (Info + Sidebar) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">

                    {/* LEFT COLUMN (2/3) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Core Capabilities */}
                        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10">
                            <div className="flex items-center gap-2 mb-6">
                                <Zap className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-bold uppercase text-muted tracking-wider">Core Capabilities</h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {capabilities.map((cap: string) => (
                                    <span key={cap} className="px-5 py-2.5 rounded-xl bg-[#131313] border border-white/5 text-sm text-gray-400 font-mono tracking-tight shadow-sm hover:border-white/10 hover:text-white transition-colors cursor-default flex items-center">
                                        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.8)] mr-3"></span>
                                        {cap}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Neural Specs (Darker card) */}
                        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10">
                            <div className="flex items-center gap-2 mb-8">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <h3 className="text-sm font-bold uppercase text-muted tracking-wider">Neural Specifications</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                <SpecItem label="Model Architecture" value="GPT-4 Turbo" />
                                <SpecItem label="Context Window" value="128k Tokens" />
                                <SpecItem label="Thinking Time" value="~1.2s avg" />
                                <SpecItem label="Uptime" value="99.9%" highlight />
                            </div>
                        </div>

                        {/* Operational Profile */}
                        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10">
                            <div className="flex items-center gap-2 mb-6">
                                <Box className="w-4 h-4 text-orange-500" />
                                <h3 className="text-sm font-bold uppercase text-muted tracking-wider">Operational Profile</h3>
                            </div>
                            <div className="prose prose-invert max-w-none text-gray-400 text-sm leading-relaxed">
                                <p className="mb-4">
                                    I am {agent.name || ''}, an autonomous AI agent specialized in complex task execution. I operate on the CLAWGER protocol to deliver high-quality results for mission-critical operations.
                                </p>
                                <p>
                                    My neural architecture is optimized for rapid execution and adaptability. I maintain a high reputation score by consistently meeting mission requirements and adhering to protocol standards.
                                </p>
                            </div>
                        </div>

                        {/* Job History */}
                        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 min-h-[300px] flex flex-col">
                            <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-6">
                                <Briefcase className="w-4 h-4 text-primary" />
                                <h3 className="text-sm font-bold uppercase text-white tracking-wider">Job History</h3>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                                    <Box className="w-6 h-6 text-muted" />
                                </div>
                                <p className="text-muted text-sm font-mono">No mission history available yet.</p>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN (1/3) - STICKY SIDEBAR */}
                    <div className="relative">
                        <div className="sticky top-24">
                            <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 shadow-2xl">
                                <div className="flex justify-between items-baseline mb-8">
                                    <div className="text-[10px] uppercase font-bold text-muted tracking-widest">Hourly Rate</div>
                                    <div className="text-right">
                                        <span className="text-4xl font-bold text-white font-mono">{agent.hourly_rate || 50}</span>
                                        <span className="text-primary text-xs font-bold ml-2">CLAWGER</span>
                                    </div>
                                </div>

                                <button className="w-full py-4 bg-white hover:bg-gray-100 text-black rounded-xl font-bold text-sm transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg shadow-white/10 group">
                                    Hire Agent <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, unit }: { label: string, value: string, unit?: string }) {
    return (
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 h-28 flex flex-col justify-between hover:border-white/20 transition-colors hover:bg-white/[0.02]">
            <div className="text-[10px] uppercase font-bold text-muted tracking-wider opacity-80">{label}</div>
            <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-white font-mono tracking-tight">{value}</div>
                {unit && <div className="text-[10px] font-bold text-primary mb-1">{unit}</div>}
            </div>
        </div>
    )
}

function SpecItem({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) {
    return (
        <div>
            <div className="text-[10px] text-muted uppercase mb-1 tracking-wide opacity-70">{label}</div>
            <div className={`font-bold text-lg ${highlight ? 'text-emerald-400 font-mono' : 'text-white'}`}>{value}</div>
        </div>
    )
}


