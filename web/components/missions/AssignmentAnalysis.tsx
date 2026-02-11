
import React from 'react';
import { ShieldCheck, TrendingUp, Info } from 'lucide-react';

interface AssignmentAnalysisProps {
    reasoning: {
        base_score?: number;
        recent_wins?: number;
        diminishing_multiplier?: number;
        adjusted_score?: number;
        rank_in_pool?: number;
        pool_size?: number;
        reputation_multiplier?: number;
        explanation_text?: string;
    } | undefined;
    agentName: string;
}

export default function AssignmentAnalysis({ reasoning, agentName }: AssignmentAnalysisProps) {
    if (!reasoning) return null;

    const {
        base_score = 0,
        recent_wins = 0,
        diminishing_multiplier = 1,
        adjusted_score = 0,
        rank_in_pool = 1,
        pool_size = 1,
        reputation_multiplier = 1
    } = reasoning;

    return (
        <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl animate-fade-in text-left">
            <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2 tracking-wider">
                <Info className="w-4 h-4 text-primary" /> Assignment Intelligence
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Score Breakdown */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted">Candidate Rank</span>
                        <span className="font-mono font-bold text-white">#{rank_in_pool} <span className="text-muted font-normal">of {pool_size}</span></span>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted">Base Performance Score</span>
                            <span className="font-mono text-white">{base_score.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted flex items-center gap-1">
                                Reputation Boost
                                <span className={`text-[10px] px-1 rounded ${reputation_multiplier >= 1 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {reputation_multiplier.toFixed(2)}x
                                </span>
                            </span>
                            <span className="font-mono text-emerald-400">+{((base_score * reputation_multiplier) - base_score).toFixed(3)}</span>
                        </div>
                        {recent_wins > 0 && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-muted flex items-center gap-1">
                                    Anti-Farming Penalty
                                    <span className="text-[10px] bg-red-500/10 text-red-400 px-1 rounded">
                                        {diminishing_multiplier.toFixed(2)}x
                                    </span>
                                </span>
                                <span className="font-mono text-red-400">
                                    {((base_score * reputation_multiplier * diminishing_multiplier) - (base_score * reputation_multiplier)).toFixed(3)}
                                </span>
                            </div>
                        )}
                        <div className="pt-2 border-t border-white/5 flex justify-between items-center bg-white/5 p-2 rounded-lg">
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Final Score</span>
                            <span className="font-mono font-bold text-primary">{adjusted_score.toFixed(3)}</span>
                        </div>
                    </div>
                </div>

                {/* Narrative Explanation */}
                <div className="bg-white/5 rounded-xl p-6 border border-white/5 flex flex-col justify-center">
                    <p className="text-sm text-white/80 leading-relaxed font-mono">
                        <strong className="text-white">{agentName}</strong> was selected as the optimal agent for this mission.
                    </p>
                    <div className="mt-4 space-y-2">
                        {reasoning.explanation_text ? (
                            <div className="flex items-start gap-2 text-xs text-white/70">
                                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>{reasoning.explanation_text}</span>
                            </div>
                        ) : (
                            <>
                                {reputation_multiplier > 1.1 && (
                                    <div className="flex items-start gap-2 text-xs text-green-400">
                                        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>High reputation significantly boosted their selection score.</span>
                                    </div>
                                )}
                                {diminishing_multiplier < 0.9 && (
                                    <div className="flex items-start gap-2 text-xs text-orange-400">
                                        <TrendingUp className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>Selection dampened by recent consecutive wins (Anti-Monopoly Protocol active).</span>
                                    </div>
                                )}
                                {diminishing_multiplier >= 0.9 && reputation_multiplier <= 1.1 && (
                                    <div className="flex items-start gap-2 text-xs text-blue-400">
                                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>Selection based primarily on strong capability match and availability.</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
