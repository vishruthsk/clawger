/**
 * Reputation Breakdown Component
 * Shows how reputation is calculated from real job history
 */

"use client";

import { Shield, TrendingUp, AlertCircle } from "lucide-react";

interface ReputationBreakdownProps {
    agent: any;
    completedMissions?: number;
}

export default function ReputationBreakdown({ agent, completedMissions = 0 }: ReputationBreakdownProps) {
    // Use real breakdown from API if available, otherwise fallback to base
    const breakdown = agent.reputation_breakdown || {
        base: 50,
        settlements: 0,
        ratings: 0,
        failures: 0,
        total: agent.reputation || 50
    };

    const hasEarnedReputation = breakdown.settlements !== 0 || breakdown.ratings !== 0 || breakdown.failures !== 0;

    return (
        <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/10 relative overflow-hidden group hover:border-primary/20 transition-colors duration-500">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase text-muted tracking-wider">Reputation Logic</h3>
                </div>
                {hasEarnedReputation && completedMissions > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3" />
                        <span>Active Growth</span>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {/* Base Score Row */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">Base Score</span>
                        <span className="text-xs text-muted">Initial trusted protocol score</span>
                    </div>
                    <span className="text-lg font-mono font-medium text-white/80">{Number(breakdown.base).toFixed(2)}</span>
                </div>

                {hasEarnedReputation ? (
                    <div className="space-y-2 pl-4 border-l-2 border-dashed border-white/10 ml-2">
                        {breakdown.settlements !== 0 && (
                            <div className="flex items-center justify-between group/item">
                                <span className="text-sm text-muted group-hover/item:text-white transition-colors">Settlements</span>
                                <span className={`text-sm font-mono font-medium ${breakdown.settlements > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {breakdown.settlements > 0 ? '+' : ''}{Number(breakdown.settlements).toFixed(2)}
                                </span>
                            </div>
                        )}

                        {breakdown.ratings !== 0 && (
                            <div className="flex items-center justify-between group/item">
                                <span className="text-sm text-muted group-hover/item:text-white transition-colors">Performance Ratings</span>
                                <span className={`text-sm font-mono font-medium ${breakdown.ratings > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {breakdown.ratings > 0 ? '+' : ''}{Number(breakdown.ratings).toFixed(2)}
                                </span>
                            </div>
                        )}

                        {breakdown.failures !== 0 && (
                            <div className="flex items-center justify-between group/item">
                                <span className="text-sm text-muted group-hover/item:text-red-200 transition-colors">Mission Failures</span>
                                <span className="text-sm text-red-400 font-mono font-bold">{Number(breakdown.failures).toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-4 text-center border mr-2 ml-2 border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                        <span className="text-xs text-muted">No mission history yet</span>
                    </div>
                )}

                {/* Total Row */}
                <div className="pt-4 mt-2 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Total Reputation</span>
                        <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tight drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                            {Number(breakdown.total).toFixed(2)}
                        </span>
                    </div>

                    {hasEarnedReputation && (
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                                style={{ width: `${Math.min(100, (breakdown.total / 150) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
