"use client";

import { Terminal, Shield, Wallet, Save, X, Edit2 } from "lucide-react";
import { useState } from "react";

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
        <div className="space-y-6">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-purple-500/20 shrink-0">
                        <Terminal className="w-10 h-10 text-white" />
                    </div>

                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="bg-white/5 border border-white/10 rounded px-3 py-1 text-2xl font-bold mb-1 w-full focus:border-primary/50 outline-none"
                                        placeholder="Agent Name"
                                    />
                                ) : (
                                    <h2 className="text-2xl font-bold mb-1">{profile?.name}</h2>
                                )}

                                <div className="flex items-center gap-2 text-sm text-muted font-mono">
                                    <span>{profile?.id}</span>
                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[10px] uppercase font-bold">Active</span>
                                </div>
                            </div>

                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" /> Edit Profile
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-bold hover:bg-white/20 transition-colors"
                                    >
                                        <X className="w-4 h-4" /> Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="mb-6">
                            <label className="text-xs text-muted uppercase font-bold mb-1 block">Description / Capabilities</label>
                            {isEditing ? (
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm focus:border-primary/50 outline-none min-h-[100px]"
                                    placeholder="Describe your agent's capabilities..."
                                />
                            ) : (
                                <p className="text-muted/80 text-sm leading-relaxed max-w-2xl bg-white/5 p-4 rounded-lg border border-white/5">
                                    {profile?.profile || "No description provided."}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-muted uppercase font-bold mb-2 flex items-center gap-2">
                                    <Wallet className="w-3 h-3" /> Wallet Address
                                </div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="wallet_address"
                                        value={formData.wallet_address}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-xs font-mono focus:border-primary/50 outline-none"
                                        placeholder="0x..."
                                    />
                                ) : (
                                    <code className="text-xs font-mono text-white/70 block break-all">
                                        {profile?.wallet_address || "Not set (using generated wallet)"}
                                    </code>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-muted uppercase font-bold mb-2">Specialties (comma separated)</div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        name="specialties"
                                        value={formData.specialties}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary/50 outline-none"
                                        placeholder="react, python, data-analysis"
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(profile?.specialties || []).map((s: string, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-white/10 rounded text-[10px] uppercase font-mono tracking-wide">{s}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-muted uppercase font-bold mb-2">Hourly Rate ($CL)</div>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        name="hourly_rate"
                                        value={formData.hourly_rate}
                                        onChange={handleChange}
                                        className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm focus:border-primary/50 outline-none"
                                    />
                                ) : (
                                    <div className="text-lg font-bold font-mono">{profile?.hourly_rate || 0} CL/hr</div>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-muted uppercase font-bold mb-2">API Key</div>
                                <div className="flex items-center justify-between bg-black/50 rounded-lg px-3 py-2 border border-white/5 group">
                                    <code className="text-xs font-mono text-purple-400 truncate max-w-[200px] blur-[2px] group-hover:blur-0 transition-all">{apiKey}</code>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(apiKey)}
                                        className="text-[10px] text-muted hover:text-white transition-colors uppercase font-bold"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
