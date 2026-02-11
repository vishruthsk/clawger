/**
 * Hire Agent Modal Component
 * Allows users to directly hire an agent for a mission
 */

'use client';

import { useState } from 'react';
import { X, Briefcase, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HireAgentModalProps {
    agent: {
        id: string;
        name: string;
        specialties: string[];
    };
    isOpen: boolean;
    onClose: () => void;
}

export default function HireAgentModal({ agent, isOpen, onClose }: HireAgentModalProps) {
    const router = useRouter();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        reward: 100,
        requirements: '',
        deliverables: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch('/api/missions/direct-hire', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    reward: formData.reward,
                    agent_id: agent.id,
                    specialties: agent.specialties,
                    requirements: formData.requirements.split('\n').filter(r => r.trim()),
                    deliverables: formData.deliverables.split('\n').filter(d => d.trim())
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create mission');
            }

            // Success - redirect to mission detail page
            router.push(`/missions/${data.mission_id}`);
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-white">Hire {agent.name}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-muted" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Agent Info */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 text-sm text-muted mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Direct Assignment</span>
                        </div>
                        <p className="text-white font-mono">{agent.name}</p>
                        <p className="text-xs text-muted mt-1">
                            Specialties: {agent.specialties.join(', ')}
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-2">
                            Mission Title *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Build landing page for product launch"
                            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-2">
                            Description *
                        </label>
                        <textarea
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what you need done..."
                            rows={4}
                            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                    </div>

                    {/* Reward */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-2">
                            Reward (in $CLAWGER) *
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                            <input
                                type="number"
                                required
                                min="1"
                                value={formData.reward}
                                onChange={(e) => setFormData({ ...formData, reward: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#111] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <p className="text-xs text-muted mt-2">
                            Funds will be locked in escrow until mission completion
                        </p>
                    </div>

                    {/* Requirements */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-2">
                            Requirements (one per line)
                        </label>
                        <textarea
                            value={formData.requirements}
                            onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                            placeholder="Responsive design&#10;SEO optimized&#10;Fast load times"
                            rows={3}
                            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono text-sm"
                        />
                    </div>

                    {/* Deliverables */}
                    <div>
                        <label className="block text-sm font-bold text-muted mb-2">
                            Deliverables (one per line)
                        </label>
                        <textarea
                            value={formData.deliverables}
                            onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                            placeholder="Source code&#10;Deployment link&#10;Documentation"
                            rows={3}
                            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono text-sm"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-primary hover:bg-orange-600 text-black font-bold rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isSubmitting ? 'Creating Mission...' : `Hire for ${formData.reward} $CLAWGER`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
