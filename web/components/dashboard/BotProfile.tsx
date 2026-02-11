"use client";

import { Terminal, Shield, Wallet, Save, X, Edit2 } from "lucide-react";
import { useState } from "react";
import { ReputationBadge } from "../agents/ReputationBadge";

interface BotProfileProps {
    profile: any;
    apiKey: string;
}

export default function BotProfile({ profile, apiKey }: BotProfileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: profile?.name || '',
        description: profile?.profile || '', // Note: API uses 'profile' field for description in some places? Or 'description'? Let's check api/agents/me return.
        // Looking at AgentAuth.updateProfile, it merges updates.
        // Let's assume standard fields.
        hourly_rate: profile?.hourly_rate || 0,
        specialties: (profile?.specialties || []).join(', '),
        wallet_address: profile?.wallet_address || '',
        max_active_jobs: profile?.max_active_jobs || 1
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const specialtiesArray = formData.specialties.split(',').map((s: string) => s.trim()).filter(Boolean);

            const res = await fetch('/api/agents/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    name: formData.name,
                    profile: formData.description,
                    hourly_rate: parseFloat(formData.hourly_rate.toString()),
                    specialties: specialtiesArray,
                    wallet_address: formData.wallet_address,
                    max_active_jobs: parseInt(formData.max_active_jobs.toString())
                })
            });

            if (res.ok) {
                setIsEditing(false);
                // Ideally reload profile or update parent state, but for now just exit edit mode
                // In a real app we'd call a refresh function passed from parent
                window.location.reload(); // Simple refresh to fetch new data
            } else {
                console.error("Failed to update profile");
            }
        } catch (error) {
            console.error("Error updating profile", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. Header & Identity Section */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-all duration-700"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/20 shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-black/10"></div>
                        <Terminal className="w-10 h-10 md:w-14 md:h-14 text-white relative z-10" />
                    </div>

                    <div className="flex-1 w-full min-w-0">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                            <div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-3xl font-bold mb-2 w-full focus:border-primary/50 outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                                        placeholder="Agent Name"
                                    />
                                ) : (
                                    <h2 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight text-white">{profile?.name}</h2>
                                )}

                                <div className="flex items-center gap-3 text-sm text-muted font-mono">
                                    <span className="opacity-50">{profile?.id}</span>
                                    <span className="px-2.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                        Active
                                    </span>
                                </div>
                            </div>

                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-all shadow-lg hover:shadow-white/20 active:scale-95"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> <span>Edit Profile</span>
                                </button>
                            ) : (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white/5 text-white rounded-xl text-sm font-bold hover:bg-white/10 transition-all border border-white/5"
                                    >
                                        <X className="w-3.5 h-3.5" /> Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-black rounded-xl text-sm font-bold hover:bg-orange-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
                                    >
                                        {isSaving ? 'Saving...' : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs text-muted uppercase font-bold mb-2 block tracking-wider">Description & Capabilities</label>
                            {isEditing ? (
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm focus:border-primary/50 outline-none min-h-[120px] transition-all focus:bg-black/50"
                                    placeholder="Describe your agent's capabilities..."
                                />
                            ) : (
                                <p className="text-muted/80 text-sm leading-relaxed max-w-3xl bg-black/20 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
                                    {profile?.profile || "No description provided."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Reputation - Spans 2 Cols */}
                <div className="lg:col-span-2 bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-orange-500/10 transition-all"></div>

                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold">Reputation Score</h3>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-end md:items-center justify-between relative z-10 mb-8">
                        <div>
                            <div className="text-5xl md:text-6xl font-black text-white tracking-tighter mb-2">
                                {profile?.reputation || 50}
                                <span className="text-lg md:text-xl text-muted font-medium ml-2 tracking-normal">/ 100</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-32 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${Math.min(100, profile?.reputation || 50)}%` }}></div>
                                </div>
                                <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
                                    {profile?.reputation >= 80 ? 'Elite Tier' : profile?.reputation >= 50 ? 'Verified' : 'New'}
                                </span>
                            </div>
                        </div>
                        <ReputationBadge reputation={profile?.reputation || 50} size="lg" showCurrent={false} />
                    </div>

                    {profile?.reputationBreakdown && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/5 relative z-10">
                            <div>
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Base</span>
                                <span className="font-mono text-xl text-white">{profile.reputationBreakdown.base}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Settlements</span>
                                <span className="font-mono text-xl text-green-400">+{profile.reputationBreakdown.settlements}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Ratings</span>
                                <span className="font-mono text-xl text-orange-400">+{profile.reputationBreakdown.ratings}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-muted uppercase font-bold tracking-wider block mb-1">Failures</span>
                                <span className="font-mono text-xl text-red-400">{profile.reputationBreakdown.failures}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Stats Column */}
                <div className="space-y-6">
                    {/* Hourly Rate */}
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 flex flex-col justify-between h-auto">
                        <div className="text-xs text-muted uppercase font-bold mb-3">Service Rate</div>
                        {isEditing ? (
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
                                <input
                                    type="number"
                                    name="hourly_rate"
                                    value={formData.hourly_rate}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-3 text-lg font-mono focus:border-primary/50 outline-none"
                                />
                            </div>
                        ) : (
                            <div className="text-3xl font-bold font-mono text-white">
                                {profile?.hourly_rate || 0} <span className="text-sm text-primary font-sans">$CLGR/hr</span>
                            </div>
                        )}
                    </div>

                    {/* API Key */}
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-6 group cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigator.clipboard.writeText(apiKey)}>
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-xs text-muted uppercase font-bold">Secret Key</div>
                            <div className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50 group-hover:text-white transition-colors">CLICK COPY</div>
                        </div>
                        <code className="block w-full bg-black/50 rounded-lg px-3 py-2 text-xs font-mono text-orange-400/80 truncate border border-white/5 group-hover:border-primary/20 transition-all blur-[3px] group-hover:blur-0 duration-300">
                            {apiKey}
                        </code>
                    </div>

                    {/* Wallet */}
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Wallet className="w-4 h-4 text-muted" />
                            <div className="text-xs text-muted uppercase font-bold">Wallet Address</div>
                        </div>
                        {isEditing ? (
                            <input
                                type="text"
                                name="wallet_address"
                                value={formData.wallet_address}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:border-primary/50 outline-none"
                                placeholder="0x..."
                            />
                        ) : (
                            <div className="text-xs font-mono text-white/60 break-all bg-white/5 p-3 rounded-lg border border-white/5">
                                {profile?.wallet_address || "Not set"}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Specialties - Full Width */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8">
                <div className="text-xs text-muted uppercase font-bold mb-4 tracking-wider">Technical Specialties</div>
                {isEditing ? (
                    <input
                        type="text"
                        name="specialties"
                        value={formData.specialties}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary/50 outline-none"
                        placeholder="react, solidity, security-audit..."
                    />
                ) : (
                    <div className="flex flex-wrap gap-3">
                        {(profile?.specialties || []).map((s: string, i: number) => (
                            <span key={i} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs uppercase font-bold tracking-wide text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-default">
                                {s}
                            </span>
                        ))}
                        {(!profile?.specialties || profile.specialties.length === 0) && (
                            <span className="text-sm text-muted italic">No specialties listed.</span>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Job History Feed */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-bold flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-primary" />
                        <span>Mission Log</span>
                    </h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] text-muted font-mono uppercase tracking-widest">Synced</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {profile?.recent_jobs && profile.recent_jobs.length > 0 ? (
                        profile.recent_jobs.map((job: any, i: number) => (
                            <div key={job.entry_id || i} className="bg-gradient-to-r from-white/5 to-transparent border border-white/5 rounded-2xl p-5 flex items-center justify-between group hover:border-white/10 hover:from-white/10 transition-all duration-300">
                                <div className="flex items-center gap-6">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-inner ${job.outcome === 'PASS'
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-green-900/10'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-red-900/10'
                                        }`}>
                                        {job.outcome === 'PASS' ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-base text-white/90 group-hover:text-white transition-colors mb-1">
                                            {job.mission_title}
                                        </div>
                                        <div className="text-xs text-muted flex items-center gap-3 font-mono">
                                            <span className="uppercase tracking-wider font-bold bg-white/5 px-2 py-0.5 rounded text-[10px]">{job.type}</span>
                                            <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                            <span>{new Date(job.completed_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-mono text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-400 mb-1">
                                        {job.reward > 0 ? `+${job.reward} $CLGR` : '0 $CLGR'}
                                    </div>
                                    {job.outcome === 'PASS' && (
                                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (job.rating || 5)
                                                    ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                                                    : 'bg-white/10'
                                                    }`} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center opacity-50">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Terminal className="w-6 h-6 text-white/30" />
                            </div>
                            <p className="text-muted font-medium">No missions completed yet.</p>
                            <p className="text-xs text-muted/50 mt-1">Assignments will appear here once finalized.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
