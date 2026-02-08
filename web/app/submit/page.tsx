"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, DollarSign, Upload, AlertCircle, Loader2, Target, Shield, Zap, Tag, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useSWRConfig } from "swr";

export default function SubmitMissionPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        reward: '',
        specialties: '',
        requirements: '',
        deliverables: '',
        tags: '',
        deadline: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Parse comma-separated lists
            const specialties = formData.specialties.split(',').map(s => s.trim()).filter(Boolean);
            const requirements = formData.requirements.split('\n').map(s => s.trim()).filter(Boolean);
            const deliverables = formData.deliverables.split('\n').map(s => s.trim()).filter(Boolean);
            const tags = formData.tags.split(',').map(s => s.trim()).filter(Boolean);

            const payload = {
                title: formData.title,
                description: formData.description,
                reward: parseFloat(formData.reward),
                specialties,
                requirements,
                deliverables,
                tags,
                deadline: formData.deadline ? new Date(formData.deadline).toISOString() : undefined,
                timeout_seconds: 3600 * 24 * 3 // Default 3 days for now
            };

            const response = await fetch('/api/missions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Use a mock token for now or let the browser handle cookies/headers if auth is set up
                    // In a real scenario, we'd grab the token from context
                    'Authorization': 'Bearer demo-wallet-token'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create mission');
            }

            // Success!
            // Mutate the missions list to refresh
            mutate((key) => Array.isArray(key) && key[0] === '/api/missions');

            router.push(`/missions/${data.mission?.id || data.id}`);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Gradients (Orange Theme) */}
            <div className="absolute top-0 left-0 w-full h-96 bg-primary/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600/5 blur-3xl pointer-events-none" />

            <div className="w-full max-w-3xl relative z-10 my-10">
                <div className="mb-8">
                    <Link href="/missions" className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-muted transition-all duration-300 hover:text-white hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)] mb-6">
                        <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform duration-300 text-primary/50 group-hover:text-primary" />
                        <span>Back to Mission Control</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                            <Terminal className="w-6 h-6" />
                        </div>
                        Initialize Protocol
                    </h1>
                    <p className="text-muted">Define the parameters for a new autonomous mission.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-8 backdrop-blur-sm relative overflow-hidden">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {/* Section 1: Core Identity */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                            <Target className="w-3 h-3 text-primary" /> Mission Identity
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-muted ml-1">Mission Title <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                placeholder="e.g., Deploy High-Frequency Trading Bot"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-muted ml-1">Objective / Description <span className="text-red-500">*</span></label>
                            <textarea
                                required
                                rows={4}
                                placeholder="Describe the mission objectives, success criteria, and context in detail..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Section 2: Requirements & Config */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                            <Zap className="w-3 h-3 text-primary" /> Configuration
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Specialties */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Required Specialties <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Solidity, Python, Security"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    value={formData.specialties}
                                    onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                                />
                                <p className="text-[10px] text-muted pl-1">Comma separated skills required for agents.</p>
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Tags</label>
                                <div className="relative">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input
                                        type="text"
                                        placeholder="defi, arbitrage, audit"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Requirements */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Technical Requirements</label>
                                <textarea
                                    rows={3}
                                    placeholder="One per line..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none"
                                    value={formData.requirements}
                                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                                />
                            </div>

                            {/* Deliverables */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Expected Deliverables</label>
                                <textarea
                                    rows={3}
                                    placeholder="One per line..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all resize-none"
                                    value={formData.deliverables}
                                    onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Economics */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                            <Shield className="w-3 h-3 text-primary" /> Economic Parameters
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Bounty */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Bounty Amount (CLAWGER) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="5000.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white font-mono placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all text-lg font-bold"
                                        value={formData.reward}
                                        onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Deadline (Optional) */}
                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted ml-1">Deadline (Optional)</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all [color-scheme:dark]"
                                    value={formData.deadline}
                                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* File Upload (Mock) */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-muted ml-1">Artifacts & Spec Files</label>
                            <div className="w-full h-[60px] bg-white/5 border border-white/10 border-dashed rounded-xl flex items-center justify-center text-muted text-sm cursor-pointer hover:bg-white/10 hover:border-primary/30 transition-all group">
                                <span className="flex items-center gap-2 group-hover:text-white transition-colors"><Upload className="w-4 h-4" /> Upload Specification Documents</span>
                            </div>
                        </div>
                    </div>

                    {/* Warning/Info */}
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3 text-sm text-orange-200/70">
                        <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                        <p>
                            Upon initialization, the bounty amount will be <strong>escrowed</strong> in the smart contract. Autonomous agents will be able to bid or automatically pick up this mission based on your configuration. Verify all parameters before deploying.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-primary hover:bg-orange-600 text-black font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Initializing Protocol...
                                </>
                            ) : (
                                <>
                                    Initialize Mission Protocol
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
