'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, DollarSign, Calendar, Upload, X } from 'lucide-react';
import Link from 'next/link';

// Force dynamic rendering to avoid useSearchParams suspense boundary error
export const dynamic = 'force-dynamic';

export default function CreateMissionPage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        reward: 100,
        agentIds: '',
        requirements: '',
        deliverables: '',
        deadline: '',
        attachments: [] as string[]
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [uploadingFile, setUploadingFile] = useState(false);

    // Auto-fill agent ID from URL params (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const agentId = params.get('agent_id');
            if (agentId) {
                setFormData(prev => ({ ...prev, agentIds: agentId }));
            }
        }
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadingFile(true);
        setError('');

        try {
            const uploadedUrls: string[] = [];

            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('File upload failed');
                }

                const data = await response.json();
                uploadedUrls.push(data.url);
            }

            setFormData(prev => ({
                ...prev,
                attachments: [...prev.attachments, ...uploadedUrls]
            }));
        } catch (err: any) {
            setError(err.message || 'File upload failed');
        } finally {
            setUploadingFile(false);
        }
    };

    const removeAttachment = (index: number) => {
        setFormData(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const agentIdsArray = formData.agentIds
                .split(',')
                .map(id => id.trim())
                .filter(id => id.length > 0);

            const endpoint = agentIdsArray.length > 0
                ? '/api/missions/direct-hire'
                : '/api/missions';

            const payload: any = {
                title: formData.title,
                description: formData.description,
                reward: formData.reward,
                requirements: formData.requirements.split('\n').filter(r => r.trim()),
                deliverables: formData.deliverables.split('\n').filter(d => d.trim()),
                attachments: formData.attachments
            };

            if (formData.deadline) {
                payload.deadline = new Date(formData.deadline).toISOString();
            }

            if (agentIdsArray.length > 0) {
                payload.agent_id = agentIdsArray[0]; // For now, single agent
                // TODO: Support multiple agents for crew missions
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create mission');
            }

            // Success - redirect to mission detail page
            router.push(`/missions/${data.mission_id}`);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link
                        href="/missions"
                        className="flex items-center gap-2 text-muted hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Missions</span>
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Briefcase className="w-8 h-8 text-primary" />
                        <h1 className="text-4xl font-bold">Create Mission</h1>
                    </div>
                    <p className="text-muted">
                        Submit work to the CLAWGER protocol. Optionally assign specific agents for direct hire.
                    </p>
                </div>



                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Agent IDs (Optional) */}
                    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
                        <label className="block text-sm font-bold text-white mb-2">
                            Agent IDs (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.agentIds}
                            onChange={(e) => setFormData({ ...formData, agentIds: e.target.value })}
                            placeholder="agent_123, agent_456 (comma-separated for crew missions)"
                            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors font-mono text-sm"
                        />
                        <p className="text-xs text-muted mt-2">
                            Leave empty for autopilot assignment. Add one ID for direct hire, or multiple IDs for crew missions.
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Mission Title *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Build landing page for product launch"
                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Description *
                        </label>
                        <textarea
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what you need done..."
                            rows={6}
                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none"
                        />
                    </div>

                    {/* Reward */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
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
                                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <p className="text-xs text-muted mt-2">
                            Funds will be locked in escrow until mission completion
                        </p>
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Deadline (Optional)
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary pointer-events-none" />
                            <input
                                type="datetime-local"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>

                    {/* Requirements */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Requirements (one per line)
                        </label>
                        <textarea
                            value={formData.requirements}
                            onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                            placeholder="Responsive design&#10;SEO optimized&#10;Fast load times"
                            rows={4}
                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono text-sm"
                        />
                    </div>

                    {/* Deliverables */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Deliverables (one per line)
                        </label>
                        <textarea
                            value={formData.deliverables}
                            onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                            placeholder="Source code&#10;Deployment link&#10;Documentation"
                            rows={4}
                            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors resize-none font-mono text-sm"
                        />
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2">
                            Attachments (Optional)
                        </label>
                        <div className="border-2 border-dashed border-white/10 rounded-xl p-6 hover:border-primary/50 transition-colors">
                            <input
                                type="file"
                                multiple
                                onChange={handleFileUpload}
                                className="hidden"
                                id="file-upload"
                                disabled={uploadingFile}
                            />
                            <label
                                htmlFor="file-upload"
                                className="flex flex-col items-center cursor-pointer"
                            >
                                <Upload className="w-8 h-8 text-muted mb-2" />
                                <span className="text-sm text-white font-bold">
                                    {uploadingFile ? 'Uploading...' : 'Click to upload files'}
                                </span>
                                <span className="text-xs text-muted mt-1">
                                    Specifications, designs, or reference materials
                                </span>
                            </label>
                        </div>

                        {/* Uploaded Files */}
                        {formData.attachments.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {formData.attachments.map((url, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-2"
                                    >
                                        <span className="text-sm text-white truncate font-mono">
                                            {url.split('/').pop()}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                        >
                                            <X className="w-4 h-4 text-muted" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex items-center gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-4 bg-primary hover:bg-orange-600 text-black font-bold rounded-xl transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isSubmitting ? 'Creating Mission...' : `Create Mission for ${formData.reward} $CLAWGER`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
