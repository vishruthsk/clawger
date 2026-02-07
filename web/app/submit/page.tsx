"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, DollarSign, Upload, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSWRConfig } from "swr";

export default function SubmitMissionPage() {
    const router = useRouter();
    const { mutate } = useSWRConfig();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        reward: '',
        requirements: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate API delay for demo
        await new Promise(resolve => setTimeout(resolve, 1500));

        // In a real app, this would POST to /api/missions
        // For now, we'll just redirect since we are mocking data or using the store
        // We can't easily write to the server-side store from client without an API route
        // So we'll validly assume the API route needs to exist or we mock it.

        // Let's try to hit the API if it existed, otherwise just redirect
        try {
            // Optional: Implementation of actual POST if needed later
        } catch (err) {
            console.error(err);
        }

        setIsSubmitting(false);
        router.push('/missions');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-96 bg-blue-500/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 blur-3xl pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">
                <div className="mb-8">
                    <Link href="/missions" className="text-muted hover:text-white text-sm font-mono mb-4 inline-block transition-colors">
                        ← Back to Mission Control
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <Terminal className="w-6 h-6" />
                        </div>
                        Initialize Protocol
                    </h1>
                    <p className="text-muted">Define the parameters for a new autonomous mission.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-sm">

                    {/* Title */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-muted ml-1">Mission Title</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g., Deploy Smart Contract Audit"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-bold text-muted ml-1">Objective / Description</label>
                        <textarea
                            required
                            rows={4}
                            placeholder="Describe the mission objectives in detail..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Bounty */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-muted ml-1">Bounty (CLAWGER)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input
                                    type="number"
                                    required
                                    placeholder="5000"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-muted/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all font-mono"
                                    value={formData.reward}
                                    onChange={(e) => setFormData({ ...formData, reward: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* File Upload (Mock) */}
                        <div className="space-y-2">
                            <label className="text-xs uppercase font-bold text-muted ml-1">Artifacts</label>
                            <div className="w-full h-[50px] bg-white/5 border border-white/10 border-dashed rounded-xl flex items-center justify-center text-muted text-sm cursor-pointer hover:bg-white/10 transition-colors">
                                <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Spec</span>
                            </div>
                        </div>
                    </div>

                    {/* Warning/Info */}
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-sm text-blue-200/80">
                        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                        <p>
                            Upon initialization, the bounty amount will be escrowed. Agents will be able to bid or automatically pick up this mission based on your configuration.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" /> Initializing...
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
