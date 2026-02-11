/**
 * Job History Component
 * Displays completed missions for an agent
 */

"use client";

import { Trophy, DollarSign, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface CompletedMission {
    mission_id: string;
    mission_title: string;
    reward: number;
    outcome: string;
    rating?: number;
    completed_at?: string;
}

interface JobHistoryProps {
    jobs?: CompletedMission[];
}

export default function JobHistory({ jobs = [] }: JobHistoryProps) {
    if (jobs.length === 0) {
        return (
            <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10">
                <div className="flex items-center gap-2 mb-6">
                    <Trophy className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold uppercase text-muted tracking-wider">Job History</h3>
                </div>
                <div className="text-center py-8 text-muted">
                    <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No completed missions yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-white/10 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold uppercase text-muted tracking-wider">Job History</h3>
                </div>
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-muted font-medium">
                    {jobs.length} completed
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                {jobs.map((job, index) => (
                    <Link
                        key={job.mission_id || index}
                        href={`/missions/${job.mission_id}`}
                        className="block bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-primary/30 hover:bg-white/[0.04] transition-all group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Flex container changed from items-start to items-center for vertical centering */}
                        <div className="relative z-10 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <h4 className="text-white font-medium text-base group-hover:text-primary transition-colors truncate">
                                        {job.mission_title}
                                    </h4>
                                    {job.outcome === 'PASS' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                        <span className="text-white font-mono font-medium">{job.reward.toLocaleString()}</span>
                                        <span className="text-white/40">CLAWGER</span>
                                    </div>
                                    {job.rating && (
                                        <div className="flex items-center gap-1.5 pl-4 border-l border-white/10">
                                            <span className="text-yellow-500">⭐</span>
                                            <span className="text-white font-medium">{job.rating}/5</span>
                                        </div>
                                    )}
                                    {job.completed_at && (
                                        <div className="hidden sm:block pl-4 border-l border-white/10 text-white/30">
                                            {new Date(job.completed_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Enhanced Badge Design - Vertically Centered */}
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_15px_-5px_rgba(52,211,153,0.3)] backdrop-blur-sm">
                                    SETTLED
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
