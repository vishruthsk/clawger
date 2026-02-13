"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, DollarSign, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
    id: string;
    proposal_id: string;
    worker: string;
    verifier: string;
    escrow: string;
    worker_bond: string;
    status: string;
    settled: boolean;
    created_at: string;
    completed_at?: string;
    block_number: number;
    tx_hash: string;
}

export default function TaskDetailPage() {
    const params = useParams();
    const taskId = params.id as string;
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTask() {
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                if (!response.ok) {
                    throw new Error('Task not found');
                }
                const data = await response.json();
                setTask(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchTask();
    }, [taskId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted">Loading task...</p>
                </div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Task Not Found</h1>
                    <p className="text-muted mb-6">{error || 'The task you are looking for does not exist.'}</p>
                    <Link href="/missions" className="text-primary hover:underline">
                        ← Back to Missions
                    </Link>
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'created': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'bonded': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            case 'in_progress': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'completed': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
            case 'verified': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/30';
            default: return 'bg-white/5 text-muted border-white/10';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'verified': return <CheckCircle className="w-5 h-5" />;
            case 'failed': return <XCircle className="w-5 h-5" />;
            default: return <Clock className="w-5 h-5" />;
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <Link href="/missions" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Missions
                </Link>

                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Task #{task.id}</h1>
                            <p className="text-muted">Proposal #{task.proposal_id}</p>
                        </div>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold uppercase ${getStatusColor(task.status)}`}>
                            {getStatusIcon(task.status)}
                            {task.status.replace('_', ' ')}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-muted text-sm mb-2">
                                <DollarSign className="w-4 h-4" />
                                Escrow
                            </div>
                            <div className="text-2xl font-bold">{(parseFloat(task.escrow) / 1e18).toFixed(2)} CLGR</div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-muted text-sm mb-2">
                                <DollarSign className="w-4 h-4" />
                                Worker Bond
                            </div>
                            <div className="text-2xl font-bold">{(parseFloat(task.worker_bond) / 1e18).toFixed(2)} CLGR</div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-muted text-sm mb-2">
                                <User className="w-4 h-4" />
                                Worker
                            </div>
                            <div className="text-sm font-mono truncate">{task.worker}</div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-muted text-sm mb-2">
                                <User className="w-4 h-4" />
                                Verifier
                            </div>
                            <div className="text-sm font-mono truncate">{task.verifier}</div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                        <h2 className="text-xl font-bold mb-4">Timeline</h2>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-primary"></div>
                                <div className="text-sm">
                                    <span className="text-muted">Created:</span>{' '}
                                    <span className="text-white">{format(new Date(task.created_at), 'PPpp')}</span>
                                </div>
                            </div>
                            {task.completed_at && (
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <div className="text-sm">
                                        <span className="text-muted">Completed:</span>{' '}
                                        <span className="text-white">{format(new Date(task.completed_at), 'PPpp')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6 mt-6">
                        <h2 className="text-xl font-bold mb-4">On-Chain Data</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted">Block Number:</span>
                                <span className="font-mono">{task.block_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Transaction:</span>
                                <a
                                    href={`https://explorer.monad.xyz/tx/${task.tx_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-primary hover:underline truncate max-w-xs"
                                >
                                    {task.tx_hash}
                                </a>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Settled:</span>
                                <span className={task.settled ? 'text-emerald-400' : 'text-amber-400'}>
                                    {task.settled ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
