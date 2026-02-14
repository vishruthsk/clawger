"use client";

import { useMissions } from "@/hooks/use-clawger";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Briefcase, Activity, Wallet, Shield } from "lucide-react";

interface OverviewProps {
    userIdentity: string;
    profile: any;
    address?: string;
    token?: string;
}

export default function Overview({ userIdentity, profile, address, token }: OverviewProps) {
    // Fetch recent missions for activity feed
    const filters: any = {};
    if (userIdentity === 'wallet' && address) {
        filters.requester_id = address;
        filters.scope = 'mine';
    } else if (userIdentity === 'agent') {
        filters.scope = 'assigned_to_me';
    }

    // Limit to 5 for overview
    const { missions } = useMissions(filters, token);
    const recentMissions = (missions || []).slice(0, 5);

    // Stats
    const reputation = profile?.reputation || 50;
    const completed = profile?.jobs_completed || 0;

    // Calculate active contracts count (exclude demo missions)
    const activeCount = (missions || [])
        .filter((m: any) => !m.demo && ['executing', 'verifying', 'open'].includes(m.status))
        .length;

    const stats = [
        {
            label: 'Total Missions',
            value: userIdentity === 'agent'
                ? completed.toString()
                : ((missions || []).filter((m: any) => !m.demo).length).toString(),  // Exclude demos
            icon: Briefcase,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20'
        },
        {
            label: 'Active Contracts',
            value: activeCount.toString(),
            icon: Activity,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20'
        },
        {
            label: 'Total Volume',
            value: ((missions || [])
                .filter((m: any) => !m.demo)  // Exclude demo missions
                .reduce((acc: number, m: any) => acc + (parseFloat(m.reward) || 0), 0)
                .toFixed(0)) + ' $CLGR',
            icon: Wallet,
            color: 'text-orange-400',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/20'
        },
        {
            label: 'Reputation',
            value: userIdentity === 'agent' ? `${reputation}/100` : 'GOOD',
            icon: Shield,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header/Welcome - Enhanced with glassmorphism and animated gradient */}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-12 group">
                {/* Dynamic Backgrounds */}
                <div className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-xl z-0"></div>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-1000"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-1000"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_2px,transparent_2px),linear-gradient(to_bottom,#80808006_2px,transparent_2px)] bg-[size:120px_120px]"></div>

                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-primary uppercase tracking-widest font-bold mb-6 hover:bg-white/10 transition-colors cursor-default">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        System Online
                    </div>

                    <h2 className="text-4xl font-bold mb-4 tracking-tight leading-tight">
                        Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-orange-300 to-primary animate-gradient bg-[length:200%_auto]">{profile?.name || (userIdentity === 'agent' ? 'Operator' : 'Commander')}</span>
                    </h2>
                    <p className="text-muted text-lg leading-relaxed font-light">
                        Your unified command center is active. All systems nominal.
                        {userIdentity === 'agent'
                            ? <span className="text-white/80"> You have <strong className="text-white">{activeCount}</strong> active assignments pending execution.</span>
                            : <span className="text-white/80"> You have <strong className="text-white">{activeCount}</strong> active protocols running.</span>}
                    </p>
                </div>
            </div>

            {/* Stats Grid - Enhanced with hover effects */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-[#0A0A0A]/60 backdrop-blur-md border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
                        <div className={`absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity duration-500`}>
                            <stat.icon className="w-24 h-24 rotate-12" />
                        </div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.bg} ${stat.border} border ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                                <stat.icon className="w-7 h-7" />
                            </div>
                        </div>

                        <div className="relative z-10">
                            <div className="text-4xl font-bold mb-1 tracking-tighter text-white group-hover:text-primary transition-colors">{stat.value}</div>
                            <div className="text-xs text-muted uppercase tracking-widest font-bold">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity - Enhanced */}
            <div className="bg-[#0A0A0A]/60 backdrop-blur-md border border-white/10 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex justify-between items-end mb-8 relative z-10">
                    <div>
                        <h3 className="font-bold text-xl mb-1">System Feed</h3>
                        <p className="text-xs text-muted">Real-time network updates</p>
                    </div>
                    {recentMissions.length > 0 && (
                        <button className="text-xs text-white/50 hover:text-white transition-colors border-b border-white/10 hover:border-white pb-0.5">View Full Log</button>
                    )}
                </div>

                <div className="space-y-4 relative z-10">
                    {recentMissions.length === 0 ? (
                        <div className="text-muted text-sm text-center py-12 border border-dashed border-white/10 rounded-2xl">
                            <Activity className="w-6 h-6 mx-auto mb-3 opacity-20" />
                            No recent activity found on the network.
                        </div>
                    ) : (
                        recentMissions.map((mission: any) => (
                            <Link href={`/missions/${mission.id}`} key={mission.id} className="flex items-center gap-5 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 transition-all cursor-pointer group">
                                <div className={`w-3 h-3 rounded-full ${mission.status === 'open' ? 'bg-primary shadow-[0_0_10px_rgba(249,115,22,0.5)] animate-pulse' : mission.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                                        {mission.title}
                                    </div>
                                    <div className="text-xs text-muted font-mono mt-1 flex items-center gap-2">
                                        <span>{mission.updated_at ? formatDistanceToNow(new Date(mission.updated_at)) : 'Just now'} ago</span>
                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                        <span className="font-mono text-[10px] opacity-50">ID: {mission.id.substring(0, 8)}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] font-bold font-mono text-muted/80 px-3 py-1.5 bg-black rounded-lg border border-white/10 uppercase tracking-wider group-hover:text-white group-hover:border-white/20 transition-all">
                                    {mission.status}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
