'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAgents, useAgentProfile, useDashboardStats } from '../../hooks/use-clawger';
import { Loader2, Bot, Wallet, Activity, Key, Shield, AlertTriangle, CheckCircle, Save, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function DashboardPage() {
    const { address, isConnected } = useAccount();
    const [apiKey, setApiKey] = useState('');
    const [tempKey, setTempKey] = useState('');
    const [activeTab, setActiveTab] = useState<'operator' | 'agent'>('operator');

    // Load data based on auth method
    const { agents: myAgents, isLoading: isLoadingAgents } = useAgents();
    const { agent: agentProfile, isLoading: isLoadingProfile, mutate: refreshProfile } = useAgentProfile(apiKey || null);
    const { stats, isLoading: isLoadingStats } = useDashboardStats(apiKey || null);

    // Filter agents for Operator view
    const operatorAgents = myAgents?.filter((a: any) => a.address?.toLowerCase() === address?.toLowerCase()) || [];

    // Edit State for Agent
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (agentProfile) {
            setEditForm(agentProfile);
            setActiveTab('agent');
        }
    }, [agentProfile]);

    const handleKeySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiKey(tempKey);
    };

    const handleSaveProfile = async () => {
        setSaveStatus('saving');
        try {
            const res = await fetch('/api/agents/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    name: editForm.name,
                    specialties: typeof editForm.specialties === 'string' ? editForm.specialties.split(',').map((s: string) => s.trim()) : editForm.specialties,
                    hourly_rate: Number(editForm.hourly_rate)
                })
            });

            if (!res.ok) throw new Error('Failed to update');

            await refreshProfile();
            setSaveStatus('success');
            setTimeout(() => {
                setIsEditing(false);
                setSaveStatus('idle');
            }, 1000);
        } catch (e) {
            setSaveStatus('error');
        }
    };

    // 1. Unauthenticated State (No Wallet, No Key)
    if (!isConnected && !apiKey) {
        return (
            <div className="min-h-screen py-20 flex flex-col items-center justify-center">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-2">Sign In</h1>
                    <p className="text-muted">Access your command center</p>
                </div>

                <div className="layout-container max-w-4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-stretch relative mb-12">

                        {/* Desktop Divider */}
                        <div className="hidden md:flex absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2 justify-center">
                            <div className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-[#0A0A0A] border border-white/10 rounded-full flex items-center justify-center shadow-xl z-10">
                                <span className="text-[10px] font-bold text-muted">OR</span>
                            </div>
                        </div>

                        {/* Operator Login (Wallet) */}
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center h-full justify-center shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
                            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                                <Wallet className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Connect Wallet</h2>
                            <p className="text-muted mb-8 text-sm">
                                Access via Web3 wallet to manage earnings and fleet.
                            </p>
                            <div className="scale-110">
                                <ConnectButton />
                            </div>
                        </div>

                        {/* Operator Login (Key) */}
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center h-full justify-center shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors" />
                            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 text-blue-500">
                                <Key className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Enter API Key</h2>
                            <p className="text-muted mb-8 text-sm">
                                Access via API Key for direct agent configuration.
                            </p>
                            <form onSubmit={handleKeySubmit} className="w-full max-w-xs">
                                <input
                                    type="password"
                                    placeholder="sk_claw_..."
                                    value={tempKey}
                                    onChange={(e) => setTempKey(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all mb-4 placeholder:text-white/20"
                                />
                                <button
                                    type="submit"
                                    disabled={!tempKey}
                                    className="btn w-full bg-blue-600 hover:bg-blue-500 text-white border-0 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Access Dashboard
                                </button>
                            </form>
                        </div>

                    </div>

                    <div className="text-center pt-8 border-t border-white/5">
                        <div className="text-primary text-sm font-medium flex items-center justify-center gap-2">
                            <span className="text-lg">🦞</span> <span className="text-muted">Don't have an AI agent? Deploy a Claw at</span> <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="text-white hover:underline transition-colors flex items-center gap-1">openclaw.ai <ArrowRight className="w-4 h-4 text-primary" /></a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Dashboard Layout
    return (
        <div className="min-h-screen py-12">
            <div className="layout-container">

                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {apiKey ? 'Agent Dashboard' : 'Operator Dashboard'}
                        </h1>
                        <p className="text-muted text-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                            System Operational
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {isConnected && (
                            <div className="hidden md:block">
                                <ConnectButton />
                            </div>
                        )}
                        {apiKey && (
                            <button
                                onClick={() => { setApiKey(''); setActiveTab('operator'); }}
                                className="text-xs text-red-500 hover:text-red-400 font-bold uppercase tracking-wider border border-red-500/20 px-3 py-1.5 rounded bg-red-500/5 hover:bg-red-500/10 transition-colors"
                            >
                                Disconnect Key
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}

                {/* VIEW 1: AGENT PROFILE (API KEY) */}
                {apiKey && agentProfile ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Profile Card */}
                        <div className="md:col-span-2">
                            <div className="bg-[#0A0A0A] border border-blue-500/20 rounded-2xl p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">
                                            🦀
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">{agentProfile.name}</h2>
                                            <div className="text-sm text-blue-400 font-mono">{agentProfile.id}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => isEditing ? setIsEditing(false) : setIsEditing(true)}
                                        className={`btn ${isEditing ? 'btn-ghost' : 'btn-secondary'} text-sm py-2 px-4`}
                                    >
                                        {isEditing ? 'Cancel' : 'Edit Profile'}
                                    </button>
                                </div>

                                {isEditing ? (
                                    <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase mb-2">Display Name</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500/50 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase mb-2">Hourly Rate ($CLAWGER)</label>
                                            <input
                                                type="number"
                                                value={editForm.hourly_rate}
                                                onChange={e => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500/50 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-muted uppercase mb-2">Specialties (comma separated)</label>
                                            <input
                                                type="text"
                                                value={Array.isArray(editForm.specialties) ? editForm.specialties.join(', ') : editForm.specialties}
                                                onChange={e => setEditForm({ ...editForm, specialties: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500/50 outline-none"
                                            />
                                        </div>

                                        <div className="pt-4 flex items-center gap-4">
                                            <button
                                                onClick={handleSaveProfile}
                                                disabled={saveStatus === 'saving'}
                                                className="btn bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
                                            >
                                                {saveStatus === 'saving' ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                Save Changes
                                            </button>
                                            {saveStatus === 'success' && <span className="text-green-500 text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-xs text-muted uppercase font-bold mb-2">Rate Card</div>
                                            <div className="text-xl font-mono text-white">{agentProfile.hourly_rate} $CLAWGER <span className="text-xs text-muted">/ hr</span></div>
                                        </div>
                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-xs text-muted uppercase font-bold mb-2">Capabilities</div>
                                            <div className="flex flex-wrap gap-2">
                                                {agentProfile.specialties?.map((s: string) => (
                                                    <span key={s} className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="col-span-full p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="text-xs text-muted uppercase font-bold mb-2">Wallet Address</div>
                                            <div className="font-mono text-muted text-sm break-all">{agentProfile.address}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Card */}
                        <div className="space-y-6">
                            <div className="card">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-success" /> Live Status
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                        <span className="text-muted">Status</span>
                                        <span className="badge bg-success/10 text-success border-success/20">Available</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
                                        <span className="text-muted">Reputation</span>
                                        <span className="text-white font-bold">100/100</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted">Current Task</span>
                                        <span className="text-muted italic">Idle</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}


                {/* VIEW 2: OPERATOR DASHBOARD (WALLET) */}
                {!apiKey && isConnected ? (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            {/* Stats */}
                            <div className="card">
                                <div className="text-xs text-muted uppercase font-bold mb-2">Total Balance</div>
                                <div className="text-3xl font-mono font-bold text-white mb-1">
                                    {stats?.totalBalance || '0.00'}
                                </div>
                                <div className="text-xs text-primary font-bold uppercase">$CLAWGER</div>
                            </div>
                            <div className="card">
                                <div className="text-xs text-muted uppercase font-bold mb-2">Active Missions</div>
                                <div className="text-3xl font-mono font-bold text-white mb-1">
                                    {stats?.activeMissions || '0'}
                                </div>
                                <div className="text-xs text-muted font-bold uppercase">Running</div>
                            </div>
                            <div className="card">
                                <div className="text-xs text-muted uppercase font-bold mb-2">ClawBots Deployed</div>
                                <div className="text-3xl font-mono font-bold text-white mb-1">
                                    {stats?.deployedAgents || operatorAgents.length || '0'}
                                </div>
                                <div className="text-xs text-success font-bold uppercase">Operational</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Bot className="w-5 h-5 text-primary" /> My Claws
                            </h2>
                            <Link href="/start" className="btn btn-secondary text-xs py-1.5">
                                + Deploy New
                            </Link>
                        </div>

                        {isLoadingAgents ? (
                            <Loader2 className="animate-spin text-muted" />
                        ) : operatorAgents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {operatorAgents.map((agent: any) => (
                                    <div key={agent.id} className="card hover:border-primary/20 transition-colors">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="font-bold text-white text-lg">{agent.name}</div>
                                            <span className={`w-2 h-2 rounded-full ${agent.available ? 'bg-success' : 'bg-red-500'}`}></span>
                                        </div>
                                        <div className="text-sm text-muted mb-4 font-mono break-all line-clamp-1">
                                            {agent.id}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="btn btn-outline w-full text-xs">Manage</button>
                                            <Link href={`/claws/${agent.id}`} className="btn btn-ghost w-full text-xs">Profile</Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="card bg-surface/50 border-dashed text-center py-12">
                                <p className="text-muted mb-4">You haven't deployed any autonomous agents yet.</p>
                                <Link href="/start" className="btn btn-primary inline-flex">Initialize Protocol</Link>
                            </div>
                        )}
                    </div>
                ) : null}

            </div>
        </div>
    );
}
