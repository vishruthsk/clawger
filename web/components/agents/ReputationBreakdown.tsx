/**
 * Reputation Breakdown Component
 * Shows how reputation is calculated from real job history
 */

"use client";

import { Shield, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface ReputationBreakdownProps {
    agent: any;
    completedMissions?: number;
}

interface ReputationUpdate {
    old_score: number;
    new_score: number;
    reason: string;
    updated_at: string;
    block_number: number;
    tx_hash: string;
}

export default function ReputationBreakdown({ agent, completedMissions = 0 }: ReputationBreakdownProps) {
    const [history, setHistory] = useState<ReputationUpdate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/agents/${agent.address}/reputation-history`);
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data);
                }
            } catch (error) {
                console.error('Failed to fetch reputation history:', error);
            } finally {
                setLoading(false);
            }
        }

        if (agent.address) {
            fetchHistory();
        }
    }, [agent.address]);

    // Use real breakdown from API if available, otherwise fallback to base
    const breakdown = agent.reputation_breakdown || {
        base: 50,
        settlements: 0,
        ratings: 0,
        failures: 0,
        total: agent.reputation || 50
    };

    const hasHistory = history.length > 0;

    return (
        <div className="p-6 rounded-3xl bg-[#0A0A0A] border border-white/10 relative overflow-hidden group hover:border-primary/20 transition-colors duration-500">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-50" />

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-bold uppercase text-muted tracking-wider">Reputation Logic</h3>
                </div>
                {hasHistory && (
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3" />
                        <span>{history.length} Updates</span>
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

                {/* Reputation History - Aggregated */}
                {loading ? (
                    <div className="py-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                        <span className="text-xs text-muted">Loading history...</span>
                    </div>
                ) : hasHistory ? (
                    <div className="space-y-2">
                        {(() => {
                            // Aggregate changes by reason
                            const aggregated = history.reduce((acc, update) => {
                                const change = update.new_score - update.old_score;
                                if (!acc[update.reason]) {
                                    acc[update.reason] = {
                                        total: 0,
                                        count: 0,
                                        lastUpdate: update.updated_at,
                                    };
                                }
                                acc[update.reason].total += change;
                                acc[update.reason].count += 1;
                                acc[update.reason].lastUpdate = update.updated_at;
                                return acc;
                            }, {} as Record<string, { total: number; count: number; lastUpdate: string }>);

                            return Object.entries(aggregated).map(([reason, data]) => {
                                const isPositive = data.total > 0;

                                return (
                                    <div
                                        key={reason}
                                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors group/item"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isPositive ? (
                                                <TrendingUp className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3 text-red-400" />
                                            )}
                                            <span className="text-sm text-white font-medium">{reason}</span>
                                            {data.count > 1 && (
                                                <span className="text-xs text-muted/60 font-mono">×{data.count}</span>
                                            )}
                                        </div>
                                        <span className={`text-sm font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isPositive ? '+' : ''}{data.total.toFixed(0)}
                                        </span>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                ) : (
                    <div className="py-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
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

                    {hasHistory && (
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                                style={{ width: `${Math.min(100, (breakdown.total / 150) * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(52, 211, 153, 0.3);
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(52, 211, 153, 0.5);
                }
            `}</style>
        </div>
    );
}
