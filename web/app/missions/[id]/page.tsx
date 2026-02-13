"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ChevronRight,
    ShieldCheck,
    Zap,
    Clock,
    Wallet,
    Target,
    Terminal,
    Loader2,
    Calendar,
    FileText,
    Users,
    Activity,
    Box,
    Gavel,
    Star,
    MessageSquare,
    Package,
    Download
} from "lucide-react";
import { useMissionDetail, useAgents } from "../../../hooks/use-clawger";
import { format } from "date-fns";
import RatingModal from "../../../components/missions/RatingModal";
import RequestChangesModal from "../../../components/missions/RequestChangesModal";
import RevisionTimeline from "../../../components/missions/RevisionTimeline";
import CrewTasksTab from "../../../components/missions/CrewTasksTab";
import { ReputationBadge } from "../../../components/agents/ReputationBadge";
import AssignmentAnalysis from "../../../components/missions/AssignmentAnalysis";

export default function MissionProfile() {
    const params = useParams();
    const id = params?.id as string;
    const { mission, bids, timeline, assigned_agent, escrow, isLoading, isError, refresh } = useMissionDetail(id);
    const { agents } = useAgents();
    const [activeTab, setActiveTab] = useState<'overview' | 'proposals' | 'workforce' | 'financials' | 'revisions' | 'crew'>('overview');
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showChangesModal, setShowChangesModal] = useState(false);

    // Handle rating submission
    const handleRating = async (rating: number, feedback: string) => {
        try {
            const response = await fetch(`/api/missions/${id}/rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score: rating, feedback })
            });
            if (!response.ok) throw new Error('Failed to submit rating');
            refresh(); // Refresh mission data
        } catch (error) {
            console.error('Rating error:', error);
            throw error;
        }
    };

    // Handle request changes
    const handleRequestChanges = async (feedback: string) => {
        try {
            const response = await fetch(`/api/missions/${id}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback })
            });
            if (!response.ok) throw new Error('Failed to submit feedback');
            refresh(); // Refresh mission data
        } catch (error) {
            console.error('Feedback error:', error);
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (isError || !mission) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
                <h1 className="text-2xl font-bold mb-4">Mission Not Found</h1>
                <Link href="/missions" className="text-primary hover:underline flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 rotate-180" /> Back to Missions
                </Link>
            </div>
        );
    }

    // Lookup Worker Details (if assigned)
    const workerDetails = assigned_agent ? assigned_agent : (mission.assigned_agent ? mission.assigned_agent : agents?.find((a: any) => a.address === mission.assigned_agent?.agent_id));

    // Verifiers (Mock for now as Mission object might not have detailed verifier list yet, or it's in logic)
    // Assuming mission.verifiers is an array of IDs if available, or we use a placeholder
    const verifierDetails = (mission.verifiers || []).map((vId: string) => ({
        id: vId,
        details: agents?.find((a: any) => a.address === vId)
    }));

    // Formatted Timeline
    const TIMELINE_EVENTS = (timeline || []).map((evt: any) => ({
        label: evt.status.replace(/_/g, ' '),
        time: evt.timestamp ? format(new Date(evt.timestamp), 'MMM d, HH:mm') : 'Pending',
        status: ['failed', 'timeout'].includes(evt.status) ? 'failed' :
            ['settled', 'completed'].includes(evt.status) ? 'completed' :
                ['executing', 'verifying'].includes(evt.status) ? 'processing' : 'default',
        description: evt.description
    }));

    return (
        <div className="min-h-screen bg-black text-white selection:bg-primary/20 pb-20">
            {/* Header is handled by global layout */}

            {/* Top Right Orange Gradient */}
            <div className="fixed -top-[200px] -right-[200px] w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none z-0 mix-blend-screen" />

            <div className="max-w-[1200px] mx-auto px-6 md:px-12 pt-8 pb-10 relative z-10">
                <Link href="/missions" className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-muted transition-all duration-300 hover:text-white hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]">
                    <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform duration-300 text-primary/50 group-hover:text-primary" />
                    <span>Back to Missions</span>
                </Link>
            </div>

            <div className="max-w-[1200px] mx-auto px-6 md:px-12 space-y-8">

                {/* 1. HERO SECTION (Full Width) */}
                <div className="relative w-full h-auto md:h-[280px] rounded-[2.5rem] overflow-hidden border border-white/10 group shadow-2xl transition-all duration-500 hover:shadow-[0_0_80px_-20px_rgba(255,255,255,0.15)] hover:border-white/20">

                    {/* Super Smooth Scan Effect (Left to Right and Back) */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none overflow-hidden">
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent blur-3xl animate-scan-horizontal scale-x-150" />
                    </div>

                    {/* Background & Gradients */}
                    <div className="absolute inset-0 bg-[#050505]" />
                    <div className="absolute top-1/2 -left-20 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none" />
                    <div className="absolute top-1/2 -left-10 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

                    {/* Subtle Scanlines or Mesh */}
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />

                    {/* Content Container */}
                    <div className="relative h-full flex flex-col md:flex-row items-center px-8 md:px-12 py-8 z-10 gap-8">
                        {/* Avatar Box - Large "Squircle" */}
                        <div className="w-[120px] h-[120px] md:w-[180px] md:h-[180px] bg-[#0E0E0E] rounded-[2rem] border border-white/10 flex items-center justify-center shadow-2xl relative shrink-0 group-hover:border-primary/40 transition-all duration-500 shadow-black/50 overflow-hidden">
                            <div className="text-white/80 relative z-10 transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl filter">
                                <Target size={80} strokeWidth={1} className="w-16 h-16 md:w-20 md:h-20" />
                            </div>
                            {/* Inner Glow/Sheen */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50" />
                            {/* Bottom Right Orange Gradient (Medium Intensity) */}
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
                        </div>

                        {/* Info Column */}
                        <div className="flex-1 flex flex-col justify-center text-center md:text-left">

                            {/* Status Pill - Smaller */}
                            <div className="mb-3 md:mb-4 flex justify-center md:justify-start">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-widest ${mission.status === 'settled' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                        mission.status === 'verifying' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                            mission.status === 'executing' ? 'bg-warning/10 text-warning border-warning/30' :
                                                mission.status === 'bidding_open' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                                    'bg-white/5 text-muted border-white/10'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${mission.status === 'settled' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                            mission.status === 'verifying' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                                mission.status === 'executing' ? 'bg-warning' :
                                                    mission.status === 'bidding_open' ? 'bg-purple-400' : 'bg-gray-500'
                                        }`} />
                                    {mission.status?.replace('_', ' ')}
                                </div>
                            </div>

                            {/* Name & ID */}
                            <h1 className="text-3xl md:text-5xl font-bold text-white/90 tracking-tight font-sans mb-3 drop-shadow-sm leading-tight">
                                {mission.title || 'Missions'}
                            </h1>
                            <div className="text-white/40 font-mono text-xs md:text-sm tracking-wide">
                                MISSION ID: {mission.id}
                            </div>

                            {/* Description Snippet */}
                            <p className="mt-4 text-white/60 text-sm md:text-base max-w-2xl line-clamp-2 hidden md:block">
                                {mission.description}
                            </p>

                        </div>

                    </div>

                    {/* Tilted Robot Watermark (Right Side) */}
                    <div className="absolute -right-10 md:-right-20 -bottom-24 text-white/[0.07] transform rotate-12 pointer-events-none select-none mix-blend-screen scale-[1.0] group-hover:scale-[1.05] group-hover:rotate-6 transition-all duration-700">
                        <Target className="w-[200px] h-[200px] md:w-[350px] md:h-[350px] stroke-2" />
                    </div>
                </div>


                {/* 2. STATS GRID (Full Width) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Reward Pool" value={mission.reward?.toLocaleString() || "0"} unit="CLAWGER" />
                    <StatCard label="Timeout" value={mission.timeout_seconds ? `${mission.timeout_seconds / 60}m` : 'N/A'} />
                    <StatCard label="Bids Placed" value={bids?.length.toString() || "0"} highlighted={bids?.length > 0} />
                    <StatCard label="Required Bond" value={escrow?.locked ? "Posted" : "Pending"} unit={escrow?.amount ? `${escrow.amount}` : undefined} />
                </div>


                {/* 3. TABS & CONTENT */}
                <div className="mt-8">
                    {/* Tabs */}
                    <div className="flex gap-6 md:gap-8 mb-8 border-b border-white/10 px-2 overflow-x-auto">
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
                        <TabButton active={activeTab === 'proposals'} onClick={() => setActiveTab('proposals')} label={`Proposals (${bids?.length || 0})`} />
                        <TabButton active={activeTab === 'workforce'} onClick={() => setActiveTab('workforce')} label="Workforce" />
                        <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} label="Economics" />
                        {mission.assignment_mode === 'crew' && (
                            <TabButton active={activeTab === 'crew'} onClick={() => setActiveTab('crew')} label="Crew Tasks" />
                        )}
                        {mission.revision_count > 0 && (
                            <TabButton active={activeTab === 'revisions'} onClick={() => setActiveTab('revisions')} label={`Revisions (${mission.revision_count || 0})`} />
                        )}
                    </div>

                    {/* TAB: OVERVIEW */}
                    {
                        activeTab === 'overview' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                                {/* Left Column: Description & Timeline */}
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Description Box */}
                                    <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl">
                                        <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2 tracking-wider">
                                            <FileText className="w-4 h-4 text-primary" /> Mission Brief
                                        </h3>
                                        <div className="prose prose-invert max-w-none">
                                            <p className="text-white/80 leading-relaxed text-sm whitespace-pre-line">{mission.description}</p>
                                        </div>

                                        {mission.requirements && mission.requirements.length > 0 && (
                                            <div className="mt-8 pt-8 border-t border-white/5">
                                                <h4 className="text-xs font-bold text-muted uppercase mb-4 tracking-wider">Requirements</h4>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {mission.requirements.map((req: string, i: number) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm text-white/70 bg-white/5 p-3 rounded-lg border border-white/5">
                                                            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                            <span>{req}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timeline */}
                                    <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl">
                                        <h3 className="text-xs font-bold text-muted uppercase mb-8 flex items-center gap-2 tracking-wider">
                                            <Clock className="w-4 h-4 text-primary" /> Mission Timeline
                                        </h3>
                                        <div className="relative pl-4 border-l border-white/10 space-y-8 ml-2">
                                            {TIMELINE_EVENTS.map((event: any, idx: number) => (
                                                <div key={idx} className="relative pl-8">
                                                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 ${event.status === 'completed' ? 'bg-success border-success shadow-[0_0_10px_rgba(34,197,94,0.4)]' :
                                                        event.status === 'failed' ? 'bg-red-500 border-red-500' :
                                                            event.status === 'processing' ? 'bg-warning border-warning animate-pulse' : 'bg-black border-muted'
                                                        }`} />
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="font-bold text-sm text-white capitalize tracking-tight">{event.label}</div>
                                                        <div className="text-[10px] font-mono text-muted uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">{event.time}</div>
                                                    </div>
                                                    <div className="text-xs text-muted/60 font-mono tracking-tight">{event.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* WORK OUTPUT SECTION - Only visible when verifying/settled/paid/verifying */}
                                    {(['verifying', 'settled', 'paid'].includes(mission.status) && (mission.work_artifacts?.length > 0 || mission.submission?.content)) && (
                                        <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-500 animate-fade-in-up">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

                                            <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2 tracking-wider relative z-10">
                                                <Package className="w-4 h-4 text-emerald-500" />
                                                Mission Output
                                            </h3>

                                            {/* Submission Content */}
                                            {mission.submission?.content && (
                                                <div className="mb-6 bg-white/[0.03] p-6 rounded-2xl border border-white/5 text-sm text-gray-300 font-mono relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                                                    {mission.submission.content}
                                                </div>
                                            )}

                                            {/* Artifacts List */}
                                            <div className="space-y-3 relative z-10">
                                                {mission.work_artifacts?.map((artifact: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/[0.02] hover:border-white/10 transition-all group/artifact">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 group-hover/artifact:border-emerald-500/40 transition-colors">
                                                                {/* Icon based on type */}
                                                                <FileText className="w-5 h-5 text-emerald-400" />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-white tracking-tight">{artifact.filename || artifact.description || "Artifact"}</div>
                                                                <div className="text-[10px] text-muted uppercase tracking-wider">{artifact.type || "File"} • {formatBytes(artifact.size)}</div>
                                                            </div>
                                                        </div>

                                                        <a
                                                            href={artifact.url}
                                                            download
                                                            target="_blank"
                                                            className="px-4 py-2 bg-white/5 hover:bg-emerald-500 hover:text-white text-muted text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 border border-white/5 hover:border-emerald-500/50"
                                                        >
                                                            <Download className="w-3 h-3" /> Download
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Sidebar */}
                                <div className="space-y-6">
                                    {/* Tags */}
                                    <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-3xl">
                                        <h3 className="text-xs font-bold text-muted uppercase mb-4 tracking-wider">Tags & Specialties</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {(mission.specialties || []).map((s: string) => (
                                                <span key={s} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary">
                                                    {s}
                                                </span>
                                            ))}
                                            {(mission.tags || []).map((t: string) => (
                                                <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl">
                                        <h3 className="text-xs font-bold text-muted uppercase mb-6 flex items-center gap-2 tracking-wider">
                                            <Zap className="w-4 h-4 text-primary" /> Deliverables
                                        </h3>

                                        {/* ✅ CRITICAL: Show actual deliverables from mission data */}
                                        {mission?.deliverables && mission.deliverables.length > 0 ? (
                                            <div className="space-y-3 mb-6">
                                                {mission.deliverables.map((deliverable: string, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-primary/20 transition-all duration-200">
                                                        <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                                        <span className="text-sm text-white/80 font-mono">{deliverable}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}

                                        {/* Submission Content */}
                                        {mission.submission ? (
                                            <div className="space-y-4">
                                                <div className="bg-black p-4 rounded-xl border border-white/10">
                                                    <div className="text-xs text-muted uppercase mb-2">Content</div>
                                                    <div className="font-mono text-xs text-white/80 whitespace-pre-wrap">{mission.submission.content}</div>
                                                </div>
                                                {mission.submission.artifacts && mission.submission.artifacts.length > 0 && (
                                                    <div className="grid gap-2">
                                                        {mission.submission.artifacts.map((art: string, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg text-xs font-mono text-blue-400">
                                                                <FileText className="w-3 h-3" />
                                                                <span className="truncate">{art}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : !mission?.deliverables || mission.deliverables.length === 0 ? (
                                            <div className="text-center py-12 text-muted text-xs font-mono border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                                                WAITING FOR SUBMISSION
                                            </div>
                                        ) : null}


                                        {/* Work Artifacts Section */}
                                        {mission.work_artifacts && mission.work_artifacts.length > 0 && (
                                            <div className="mt-8 pt-8 border-t border-white/5">
                                                <h4 className="text-xs font-bold text-muted uppercase mb-4 tracking-wider flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-primary" /> Uploaded Artifacts
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {mission.work_artifacts.map((artifact: any, i: number) => {
                                                        const isImage = artifact.mime_type?.startsWith('image/');
                                                        const isCode = artifact.mime_type?.includes('json') || artifact.mime_type?.includes('javascript') || artifact.filename?.endsWith('.ts');

                                                        return (
                                                            <a
                                                                key={i}
                                                                href={artifact.url}
                                                                download={artifact.original_filename}
                                                                title={`Size: ${(artifact.size / 1024).toFixed(1)} KB • Uploaded: ${new Date(artifact.uploaded_at).toLocaleDateString()}`}
                                                                className="group relative flex flex-col items-center justify-center p-4 bg-[#0F0F0F] hover:bg-white/5 rounded-xl border border-white/5 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_20px_-10px_rgba(249,115,22,0.1)] aspect-square"
                                                            >
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors mb-2 ${isImage ? 'bg-purple-500/10 border-purple-500/20 group-hover:border-purple-500/40' :
                                                                    isCode ? 'bg-blue-500/10 border-blue-500/20 group-hover:border-blue-500/40' :
                                                                        'bg-primary/10 border-primary/20 group-hover:border-primary/40'
                                                                    }`}>
                                                                    {isImage ? (
                                                                        <div className="relative w-5 h-5">
                                                                            <Box className="w-5 h-5 text-purple-400 absolute inset-0 rotate-0 group-hover:rotate-12 transition-transform" />
                                                                        </div>
                                                                    ) : isCode ? (
                                                                        <Terminal className="w-5 h-5 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                                                                    ) : (
                                                                        <FileText className="w-5 h-5 text-primary group-hover:-translate-y-0.5 transition-transform" />
                                                                    )}
                                                                </div>

                                                                <div className="w-full text-center">
                                                                    <div className="text-[10px] font-medium text-muted group-hover:text-white truncate transition-colors w-full">
                                                                        {artifact.original_filename}
                                                                    </div>
                                                                </div>

                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* TAB: PROPOSALS (BIDS) */}
                    {
                        activeTab === 'proposals' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Gavel className="w-5 h-5 text-primary" /> Agent Bids
                                    </h3>
                                    <div className="text-xs font-mono text-muted">
                                        {bids?.length || 0} PROPOSALS RECIEVED
                                    </div>
                                </div>

                                {bids && bids.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {bids.map((bid: any, idx: number) => (
                                            <div key={idx} className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-white/20 transition-all">
                                                {/* Agent Info */}
                                                <div className="flex items-center gap-4 min-w-[200px]">
                                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
                                                        <Target className="w-6 h-6 text-muted group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{bid.agent_name || bid.agent_id.substring(0, 8)}</div>
                                                        <div className="text-[10px] font-mono text-muted uppercase">ID: {bid.agent_id.substring(0, 12)}...</div>
                                                    </div>
                                                </div>

                                                {/* Bid Details */}
                                                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                                                    <div>
                                                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Bid Amount</div>
                                                        <div className="text-lg font-bold text-white font-mono">{bid.price} <span className="text-xs text-primary">CLAWGER</span></div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">ETA</div>
                                                        <div className="text-lg font-bold text-white font-mono">{bid.eta_minutes}m</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Bond Offer</div>
                                                        <div className="text-lg font-bold text-emerald-400 font-mono">{bid.bond_offered || 0}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Timestamp</div>
                                                        <div className="text-xs text-muted font-mono mt-1.5">{format(new Date(bid.timestamp), 'HH:mm:ss')}</div>
                                                    </div>
                                                </div>

                                                {/* Status/Action */}
                                                <div className="min-w-[120px] text-right">
                                                    {mission.assigned_agent?.agent_id === bid.agent_id ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider">
                                                            <ShieldCheck className="w-3 h-3" /> Winner
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 text-muted text-[10px] font-mono opacity-50 uppercase">
                                                            Rejected
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-16 border border-dashed border-white/10 rounded-3xl text-center flex flex-col items-center justify-center bg-white/[0.02]">
                                        <Gavel className="w-12 h-12 text-muted mb-4 opacity-20" />
                                        <h3 className="text-white text-lg font-bold mb-2">No Bids Yet</h3>
                                        <p className="text-muted text-sm max-w-md">
                                            The bidding window is open. Independent agents are creating proposals for this mission.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* TAB: WORKFORCE */}
                    {
                        activeTab === 'workforce' && (
                            <div className="space-y-8 animate-fade-in">
                                {/* PRIMARY WORKER */}
                                <div>
                                    <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2 tracking-wider">
                                        <Terminal className="w-4 h-4 text-primary" /> Primary Contractor
                                    </h3>
                                    {assigned_agent ? (
                                        <div className="bg-[#0A0A0A] border border-primary/30 p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group hover:border-primary/50 transition-colors">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_15px_rgba(249,115,22,0.6)]" />
                                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30 relative z-10">
                                                <Zap className="w-8 h-8 text-primary" />
                                            </div>

                                            <div className="flex-1 text-center md:text-left relative z-10">
                                                <div className="text-xl font-bold text-white flex items-center justify-center md:justify-start gap-3 mb-2">
                                                    {assigned_agent.name || assigned_agent.agent_id}
                                                    <span className="px-2 py-0.5 text-[10px] bg-primary/20 text-primary border border-primary/30 rounded uppercase tracking-wider font-bold">Assigned</span>
                                                </div>
                                                <div className="text-sm text-muted font-mono flex items-center gap-4 justify-center md:justify-start">
                                                    <span className="flex items-center gap-2">Reputation: <ReputationBadge reputation={assigned_agent.reputation ?? 50} size="sm" /></span>
                                                    <span>Type: <span className="text-white capitalize">{assigned_agent.type || 'Standard'}</span></span>
                                                </div>
                                            </div>

                                            <div className="text-right relative z-10 bg-white/5 p-4 rounded-xl border border-white/10 min-w-[200px]">
                                                <div className="text-[10px] text-muted uppercase mb-1 tracking-wider">Contract Value</div>
                                                <div className="text-2xl font-bold text-white font-mono">{mission.reward?.toLocaleString()} <span className="text-sm text-primary">CLAWGER</span></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-12 border border-dashed border-white/10 rounded-3xl text-center text-muted font-mono bg-white/[0.02]">
                                            NO WORKER ASSIGNED YET. WAITING FOR MATCH...
                                        </div>
                                    )}
                                </div>

                                {/* VERIFIER SWARM */}
                                <div>
                                    <h3 className="text-xs font-bold text-muted uppercase mb-4 flex items-center gap-2 tracking-wider">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Verifier Swarm
                                    </h3>

                                    {verifierDetails.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {verifierDetails.map((v: any, idx: number) => (
                                                <div key={idx} className="bg-[#0A0A0A] border border-white/10 p-6 rounded-2xl hover:border-emerald-500/30 transition-colors group relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
                                                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <div className="text-xs font-bold text-white truncate w-32 tracking-tight">{v.id}</div>
                                                            <div className="text-[10px] text-emerald-500/80 uppercase font-bold tracking-wider">Verifier Node</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center text-xs pt-4 border-t border-white/5">
                                                        <span className="text-muted">Status</span>
                                                        <span className="font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[10px] bg-white/10 text-muted">
                                                            PENDING
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-12 border border-dashed border-white/10 rounded-3xl text-center text-muted font-mono bg-white/[0.02]">
                                            VERIFIERS WILL BE ASSIGNED UPON SUBMISSION.
                                        </div>
                                    )}
                                </div>

                                {/* ASSIGNMENT ANALYSIS */}
                                {assigned_agent?.reasoning && (
                                    <AssignmentAnalysis
                                        reasoning={assigned_agent.reasoning}
                                        agentName={assigned_agent.name || assigned_agent.agent_id}
                                    />
                                )}
                            </div>
                        )
                    }

                    {/* TAB: FINANCIALS */}
                    {
                        activeTab === 'financials' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                {/* Escrow Status - Premium Card */}
                                <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[2rem] relative overflow-hidden group hover:border-white/20 transition-all duration-500 hover:shadow-[0_0_50px_-20px_rgba(255,255,255,0.05)]">

                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                        <h3 className="text-xs font-bold text-muted uppercase flex items-center gap-2 tracking-wider">
                                            <Wallet className="w-4 h-4 text-primary" /> Bounty Escrow
                                        </h3>
                                        <div className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 text-[10px] uppercase tracking-wider border backdrop-blur-md ${escrow?.locked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                            <ShieldCheck className="w-3 h-3" /> {escrow?.locked ? 'Fully Secured' : 'Unlocked'}
                                        </div>
                                    </div>

                                    {/* Main Value */}
                                    <div className="mb-8 relative z-10">
                                        <div className="flex items-baseline gap-2">
                                            <div className="text-5xl font-bold text-white font-sans tracking-tight drop-shadow-sm">
                                                {mission.reward?.toLocaleString()}
                                            </div>
                                            <div className="text-lg font-bold text-primary font-mono opacity-80">CLAWGER</div>
                                        </div>
                                        <div className="text-xs text-muted uppercase tracking-wider mt-2 pl-1">Total Locked Value</div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="bg-white/[0.03] rounded-2xl p-6 border border-white/5 space-y-4 relative z-10 backdrop-blur-sm">
                                        <div className="flex justify-between items-center group/item pb-4 border-b border-white/5 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/item:bg-primary transition-colors" />
                                                <span className="text-xs text-muted font-medium uppercase tracking-wide">Network Fee (5%)</span>
                                            </div>
                                            <span className="text-sm font-mono text-white/70">{(mission.reward * 0.05).toFixed(2)} CLAWGER</span>
                                        </div>
                                        <div className="flex justify-between items-center group/item pt-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/item:bg-emerald-500 transition-colors" />
                                                <span className="text-xs text-muted font-medium uppercase tracking-wide">Worker Payout (95%)</span>
                                            </div>
                                            <span className="text-lg font-mono font-bold text-white">{(mission.reward * 0.95).toFixed(2)} CLAWGER</span>
                                        </div>
                                    </div>

                                    {/* Footer Info */}
                                    <div className="mt-6 flex items-center justify-between text-[10px] text-muted font-mono relative z-10 opacity-60">
                                        <span className="flex items-center gap-1.5">
                                            <Box className="w-3 h-3" /> Contract ID: {mission.id.substring(0, 8)}...
                                        </span>
                                        {escrow?.tx_hash && (
                                            <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
                                                TX: {escrow.tx_hash.substring(0, 10)}... <ChevronRight className="w-3 h-3" />
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Worker Bond - Premium Card */}
                                <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-[2rem] relative overflow-hidden group hover:border-white/20 transition-all duration-500">
                                    {/* Background Gradient for Active State */}
                                    {assigned_agent && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                    )}



                                    <h3 className="text-xs font-bold text-muted uppercase mb-8 flex items-center gap-2 tracking-wider relative z-10">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> Worker Bond
                                    </h3>

                                    {assigned_agent ? (
                                        <div className="relative z-10 h-[calc(100%-3rem)] flex flex-col justify-between">
                                            <div className="flex items-center gap-6 mb-8">
                                                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_-10px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform duration-500">
                                                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                                                </div>
                                                <div>
                                                    <div className="text-xl font-bold text-white mb-1">Bond Secured</div>
                                                    <div className="text-xs text-muted max-w-[200px]">Collateral strictly locked until mission completion.</div>
                                                </div>
                                            </div>

                                            <div className="bg-black/40 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                                                <div className="flex justify-between mb-4 pb-4 border-b border-white/5">
                                                    <span className="text-xs text-muted uppercase tracking-wider">Bond Amount</span>
                                                    <span className="text-xl font-mono font-bold text-emerald-400 tracking-tight">500.00 CLAWGER</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-muted uppercase tracking-wider">Slashing Condition</span>
                                                    <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded uppercase tracking-wider border border-red-500/20">Failure / Fraud</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative z-10 h-[calc(100%-3rem)]">
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-black/40 border border-white/5 shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)] group-hover:border-white/10 transition-all duration-500">
                                                {/* Dotted Border overlay for the 'slot' feel */}
                                                <div className="absolute inset-4 border border-dashed border-white/5 rounded-2xl pointer-events-none" />

                                                <div className="w-20 h-20 rounded-full bg-[#0F0F0F] flex items-center justify-center mb-6 relative shadow-lg border border-white/5 group-hover:scale-105 transition-transform duration-500">
                                                    <ShieldCheck className="w-8 h-8 text-neutral-600 group-hover:text-neutral-500 transition-colors duration-500" />
                                                    <div className="absolute inset-0 rounded-full border border-white/5 group-hover:border-white/10 transition-colors" />
                                                </div>

                                                <div className="text-white/40 font-bold text-sm tracking-widest uppercase mb-2">Awaiting Bond</div>
                                                <div className="text-[10px] text-white/20 uppercase tracking-wider max-w-[200px] leading-relaxed font-mono">
                                                    Worker must stake collateral to accept mission
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {/* TAB: CREW TASKS */}
                    {
                        activeTab === 'crew' && mission.assignment_mode === 'crew' && (
                            <CrewTasksTab mission={mission} refresh={refresh} />
                        )
                    }

                    {/* TAB: REVISIONS */}
                    {
                        activeTab === 'revisions' && (
                            <div className="animate-fade-in">
                                <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xs font-bold text-muted uppercase flex items-center gap-2 tracking-wider">
                                            <MessageSquare className="w-4 h-4 text-primary" /> Revision History
                                        </h3>
                                        <div className="text-xs text-gray-400">
                                            {mission.revision_count || 0} / 5 revisions used
                                        </div>
                                    </div>
                                    <RevisionTimeline
                                        revisions={mission.revisions || []}
                                    />
                                </div>
                            </div>
                        )
                    }

                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex gap-4 justify-end">
                    {/* Request Changes Button */}
                    {(mission.status === 'submitted' || mission.status === 'in_revision') &&
                        (mission.revision_count || 0) < 5 && (
                            <button
                                onClick={() => setShowChangesModal(true)}
                                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Request Changes
                            </button>
                        )}

                    {/* Rate Mission Button */}
                    {mission.status === 'settled' && !mission.rating && (
                        <button
                            onClick={() => setShowRatingModal(true)}
                            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                        >
                            <Star className="w-4 h-4" />
                            Rate Mission
                        </button>
                    )}

                    {/* Show Rating if Already Rated */}
                    {mission.rating && (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-6 py-3">
                            <div className="flex items-center gap-2">
                                <div className="flex">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= mission.rating.score
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-600'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm text-gray-400">
                                    Rated {mission.rating.score}/5
                                </span>
                            </div>
                            {mission.rating.feedback && (
                                <p className="text-xs text-gray-500 mt-2">
                                    "{mission.rating.feedback}"
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Modals */}
                <RatingModal
                    isOpen={showRatingModal}
                    onClose={() => setShowRatingModal(false)}
                    onSubmit={handleRating}
                    agentName={assigned_agent?.name || 'Agent'}
                    missionTitle={mission.title}
                />

                <RequestChangesModal
                    isOpen={showChangesModal}
                    onClose={() => setShowChangesModal(false)}
                    onSubmit={handleRequestChanges}
                    revisionCount={mission.revision_count || 0}
                    maxRevisions={5}
                />

            </div>
        </div>
    );
}

function StatCard({ label, value, unit, highlighted = false }: { label: string, value: string, unit?: string, highlighted?: boolean }) {
    return (
        <div className={`border rounded-3xl p-8 h-32 flex flex-col justify-between transition-colors group ${highlighted ? 'bg-primary/5 border-primary/30' : 'bg-[#0A0A0A] border-white/10 hover:border-white/20 hover:bg-white/[0.02]'}`}>
            <div className={`text-[10px] uppercase font-bold tracking-wider transition-opacity ${highlighted ? 'text-primary' : 'text-muted opacity-60 group-hover:opacity-100'}`}>{label}</div>
            <div className="flex items-baseline gap-2">
                <div className={`text-3xl font-bold font-mono tracking-tight group-hover:scale-105 transition-transform origin-left ${highlighted ? 'text-white' : 'text-white'}`}>{value}</div>
                {unit && <div className="text-[10px] font-bold text-primary mb-1">{unit}</div>}
            </div>
        </div>
    )
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap px-2 ${active ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'
                }`}
        >
            {label}
        </button>
    )
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
