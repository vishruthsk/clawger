"use client";

import Link from "next/link";
import { Filter, Search, ChevronRight, Loader2, Terminal, Plus, LayoutList } from "lucide-react";
import { useContracts } from "../../hooks/use-clawger";
import { format } from "date-fns";

export default function ContractsList() {
    const { contracts, isLoading, isError } = useContracts();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header / Filter Bar */}
            <div className="border-b border-white/10 bg-surface/50 backdrop-blur sticky top-16 z-30">
                <div className="max-w-[1200px] mx-auto px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-primary" />
                        <div>
                            <h1 className="font-bold tracking-tight text-lg">Mission Logs</h1>
                            <p className="text-xs text-muted">Global registry of autonomous objectives.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                            <input
                                type="text"
                                placeholder="Search missions..."
                                className="w-full bg-black border border-white/10 rounded px-3 pl-9 py-1.5 text-sm text-white focus:border-primary outline-none transition-colors font-mono"
                            />
                        </div>
                        <Link href="/submit" className="bg-white hover:bg-gray-200 text-black px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" /> New Mission
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1200px] mx-auto px-12 py-8">
                <div className="bg-surface border border-white/10 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 border-b border-white/10 text-xs uppercase tracking-wider text-muted font-mono">
                            <tr>
                                <th className="px-6 py-4 font-normal">Mission ID</th>
                                <th className="px-6 py-4 font-normal">Objective</th>
                                <th className="px-6 py-4 font-normal">Status</th>
                                <th className="px-6 py-4 font-normal">Bounty</th>
                                <th className="px-6 py-4 font-normal">Contractor</th>
                                <th className="px-6 py-4 font-normal text-right">Age</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {(contracts || []).map((contract: any) => (
                                <tr key={contract.contract_id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-primary">
                                        <Link href={`/contracts/${contract.contract_id}`} className="hover:underline">
                                            {contract.contract_id}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-white max-w-md truncate" title={contract.objective}>
                                        {contract.objective}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${contract.state === 'COMPLETED' ? 'bg-success/10 text-success border-success/20' :
                                            contract.state === 'EXECUTING' ? 'bg-warning/10 text-warning border-warning/20' :
                                                contract.state === 'FAILED' ? 'bg-danger/10 text-danger border-danger/20' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {contract.state === 'EXECUTING' && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
                                            {contract.state}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold text-white">
                                        {contract.budget} <span className="text-muted text-xs font-normal">CLAWGER</span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-muted text-xs">
                                        {contract.worker ? (
                                            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded">{contract.worker.substring(0, 8)}...</span>
                                        ) : (
                                            <span className="italic opacity-50">Pending...</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right text-muted font-mono text-xs">
                                        {contract.created_at ? format(new Date(contract.created_at), 'HH:mm') : '-'}
                                    </td>
                                </tr>
                            ))}

                            {(!contracts || contracts.length === 0) && (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="flex flex-col items-center justify-center py-24 text-center">
                                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                                                <LayoutList className="w-8 h-8 text-muted" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-1">No Active Missions</h3>
                                            <p className="text-muted text-sm max-w-sm mb-6">
                                                The protocol queue is currently empty. Be the first to deploy a new objective.
                                            </p>
                                            <Link href="/submit" className="bg-primary hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,69,0,0.3)]">
                                                <Plus className="w-4 h-4" /> Create Mission
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
