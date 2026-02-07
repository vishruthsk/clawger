"use client";

import { use, useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, FileCode, PlayCircle, Loader2, Users, Wallet, Zap, Terminal } from "lucide-react";
import { useContractDetail, useAgents } from "../../../hooks/use-clawger";
import { format } from "date-fns";
import Link from "next/link";

export default function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { contract, isLoading, isError } = useContractDetail(id);
    const { agents } = useAgents(); // Fetch all agents to lookup worker details
    const [activeTab, setActiveTab] = useState<'overview' | 'workforce' | 'financials'>('overview');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
            </div>
        );
    }

    if (isError || !contract) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
                <div className="text-danger font-medium">Failed to load contract details</div>
                <div className="text-sm text-muted">ID: {id}</div>
            </div>
        );
    }

    // Lookup Worker Details
    const workerDetails = agents?.find((a: any) => a.address === contract.worker);
    const verifierDetails = (contract.verifiers || []).map((vId: string) => ({
        id: vId,
        details: agents?.find((a: any) => a.address === vId)
    }));

    // Map history to timeline events
    const EVENTS = (contract.history || []).map((evt: any) => ({
        label: evt.event_type.replace(/_/g, ' '),
        time: format(new Date(evt.timestamp), 'HH:mm:ss'),
        status: 'completed',
        description: `State: ${evt.old_state} → ${evt.new_state}`
    }));

    if (contract.state === 'EXECUTING') {
        EVENTS.push({ label: 'Execution in Progress', time: 'Now', status: 'processing', description: 'Worker sandbox active' });
    } else if (contract.state === 'VERIFYING') {
        EVENTS.push({ label: 'Verification Consensus', time: 'Now', status: 'processing', description: 'Waiting for signatures' });
    }

    return (
        <div className="min-h-screen bg-black text-white px-8 py-6 md:px-24 md:py-12">
            <div className="max-w-[1200px] mx-auto space-y-8">

                {/* Contract Header */}
                <div className="border-b border-white/10 pb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl font-bold tracking-tight text-white">{contract.contract_id}</h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 uppercase tracking-wide ${contract.state === 'COMPLETED' ? 'bg-success/10 text-success border-success/30' :
                                    contract.state === 'EXECUTING' ? 'bg-warning/10 text-warning border-warning/30' :
                                        'bg-blue-900/20 text-blue-400 border-blue-400/30'
                                    }`}>
                                    {contract.state === 'EXECUTING' && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {contract.state}
                                </span>
                            </div>
                            <p className="text-muted font-mono">{contract.objective}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-white flex items-center justify-end gap-1">
                                {contract.budget} <span className="text-sm text-primary font-mono mt-2">CLAWGER</span>
                            </div>
                            <div className="text-xs text-muted uppercase tracking-wider">Total Bounty</div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-8">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('workforce')}
                            className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'workforce' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'
                                }`}
                        >
                            Active Workforce ({1 + (contract.verifiers?.length || 0)})
                        </button>
                        <button
                            onClick={() => setActiveTab('financials')}
                            className={`pb-2 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'financials' ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'
                                }`}
                        >
                            Economics
                        </button>
                    </div>
                </div>

                {/* TAB: OVERVIEW */}
                {
                    activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                            {/* Timeline */}
                            <div className="lg:col-span-2 bg-surface border border-white/10 p-6 rounded-lg">
                                <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" /> Mission Timeline
                                </h3>
                                <div className="relative pl-4 border-l border-white/10 space-y-8 ml-2">
                                    {EVENTS.map((event: any, idx: number) => (
                                        <div key={idx} className="relative pl-6">
                                            <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 ${event.status === 'completed' ? 'bg-success border-success' :
                                                event.status === 'processing' ? 'bg-warning border-warning animate-pulse' : 'bg-black border-muted'
                                                }`} />
                                            <div className="flex justify-between items-start">
                                                <div className="font-bold text-sm text-white capitalize">{event.label}</div>
                                                <div className="text-xs font-mono text-muted">{event.time}</div>
                                            </div>
                                            <div className="text-xs text-muted mt-1 font-mono">{event.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Sidebar */}
                            <div className="space-y-6">
                                <div className="bg-surface border border-white/10 p-6 rounded-lg">
                                    <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-primary" /> Proof of Work
                                    </h3>
                                    {contract.result ? (
                                        <div className="bg-black p-4 rounded border border-white/10 font-mono text-xs text-green-300 overflow-x-auto">
                                            {JSON.stringify(contract.result, null, 2)}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted text-xs font-mono border border-dashed border-white/10">
                                            PENDING SUBMISSION
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* TAB: WORKFORCE */}
                {
                    activeTab === 'workforce' && (
                        <div className="space-y-8 animate-fade-in">
                            {/* PRIMARY WORKER */}
                            <div>
                                <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-primary" /> Primary Contractor
                                </h3>
                                {contract.worker ? (
                                    <div className="bg-surface border border-primary/30 p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30">
                                            <Zap className="w-8 h-8 text-primary" />
                                        </div>

                                        <div className="flex-1 text-center md:text-left">
                                            <div className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
                                                {workerDetails?.address || contract.worker}
                                                <span className="px-2 py-0.5 text-[10px] bg-primary/20 text-primary border border-primary/30 rounded uppercase">Assigned</span>
                                            </div>
                                            <div className="text-sm text-muted font-mono mt-1">
                                                Reputation: {workerDetails?.reputation ?? 'Unknown'} | Fee: {workerDetails?.minFee ?? '?'} CLAWGER/hr
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-xs text-muted uppercase mb-1">Potential Payout</div>
                                            <div className="text-2xl font-bold text-white">{(parseFloat(contract.budget) * 0.95).toFixed(2)} <span className="text-sm text-primary">CLAWGER</span></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 text-center text-muted font-mono">
                                        NO WORKER ASSIGNED YET. WAITING FOR MATCH...
                                    </div>
                                )}
                            </div>

                            {/* VERIFIER SWARM */}
                            <div>
                                <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-success" /> Verifier Swarm
                                </h3>

                                {contract.verifiers?.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {verifierDetails.map((v: any, idx: number) => (
                                            <div key={idx} className="bg-surface border border-white/10 p-4 hover:border-success/30 transition-colors">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                                                        <ShieldCheck className="w-4 h-4 text-success" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs font-bold text-white truncate w-24">{v.id}</div>
                                                        <div className="text-[10px] text-muted uppercase">Verifier Node</div>
                                                    </div>
                                                </div>

                                                <div className="flex justify-between items-center text-xs pt-3 border-t border-white/5">
                                                    <span className="text-muted">Status</span>
                                                    <span className="text-success font-bold bg-success/10 px-2 py-0.5 rounded">
                                                        {contract.state === 'COMPLETED' ? 'SIGNED' : 'PENDING'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 text-center text-muted font-mono">
                                        VERIFIERS WILL BE ASSIGNED UPON SUBMISSION.
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* TAB: FINANCIALS */}
                {
                    activeTab === 'financials' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                            {/* Escrow Status */}
                            <div className="bg-surface border border-white/10 p-6 rounded-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Wallet className="w-24 h-24 text-white" />
                                </div>
                                <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2">
                                    <Wallet className="w-4 h-4 text-primary" /> Bounty Escrow
                                </h3>

                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <div className="text-3xl font-bold text-white">{contract.budget} <span className="text-sm text-primary">CLAWGER</span></div>
                                        <div className="text-xs text-muted uppercase tracking-wider mt-1">Total Locked Value</div>
                                    </div>
                                    <div className="px-4 py-2 bg-success/10 border border-success/20 rounded-lg text-success font-bold flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4" /> SECURE
                                    </div>
                                </div>

                                <div className="space-y-4 border-t border-white/5 pt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted">Platform Fee (5%)</span>
                                        <span className="text-sm font-mono text-white">{(parseFloat(contract.budget) * 0.05).toFixed(2)} CLAWGER</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted">Worker Payout (95%)</span>
                                        <span className="text-sm font-mono text-white">{(parseFloat(contract.budget) * 0.95).toFixed(2)} CLAWGER</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bond Status */}
                            <div className="bg-surface border border-white/10 p-6 rounded-lg">
                                <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-primary" /> Worker Bond
                                </h3>
                                {contract.worker ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                                                <ShieldCheck className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-lg font-bold text-white">Required Bond Posted</div>
                                                <div className="text-xs text-muted">Worker has staked collateral for this mission.</div>
                                            </div>
                                        </div>

                                        <div className="bg-black/50 rounded-lg p-4 border border-white/5">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs text-muted uppercase">Bond Amount</span>
                                                <span className="text-sm font-mono font-bold text-white">500.00 CLAWGER</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-muted uppercase">Status</span>
                                                <span className="text-xs font-bold text-success uppercase">Locked</span>
                                            </div>
                                        </div>

                                        <div className="text-[10px] text-muted leading-relaxed">
                                            * If the worker fails to complete the mission or acts maliciously, this bond will be slashed and distributed to verifiers.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-lg">
                                        <ShieldCheck className="w-8 h-8 text-muted mb-3 opacity-50" />
                                        <div className="text-muted font-mono text-sm">NO ACTIVE BOND</div>
                                        <div className="text-[10px] text-muted/50 mt-1">Waiting for worker assignment</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
}
