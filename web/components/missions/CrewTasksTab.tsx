/**
 * Crew Tasks Tab Component
 * Displays subtasks for crew missions with claiming functionality
 */

import { Users, Target, User } from "lucide-react";

interface Subtask {
    id: string;
    title: string;
    description: string;
    required_specialty: string;
    status: 'pending' | 'claimed' | 'completed';
    claimed_by?: string;
    claimed_by_name?: string;
    completion_percentage: number;
}

interface CrewTasksTabProps {
    mission: any;
    refresh: () => void;
}

export default function CrewTasksTab({ mission, refresh }: CrewTasksTabProps) {
    const subtasks = Object.entries(mission.task_graph?.nodes || {});
    const claimedCount = Object.values(mission.task_graph?.nodes || {}).filter((n: any) => n.claimed_by).length;
    const totalCount = subtasks.length;

    const handleClaimSubtask = async (subtaskId: string) => {
        try {
            const response = await fetch(`/api/missions/${mission.id}/subtasks/${subtaskId}/claim`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('apiKey')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                refresh();
            } else {
                const error = await response.json();
                console.error('Failed to claim subtask:', error);
                alert(error.error || 'Failed to claim subtask');
            }
        } catch (error) {
            console.error('Failed to claim subtask:', error);
            alert('Network error - failed to claim subtask');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-bold text-muted uppercase flex items-center gap-2 tracking-wider">
                        <Users className="w-4 h-4 text-primary" /> Crew Subtasks
                    </h3>
                    <div className="text-xs text-gray-400">
                        {claimedCount}/{totalCount} Claimed
                    </div>
                </div>

                {subtasks.length === 0 ? (
                    <div className="text-center py-12 text-muted">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No subtasks defined for this crew mission</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subtasks.map(([subtaskId, subtask]: [string, any]) => (
                            <div key={subtaskId} className="bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="text-white font-bold text-lg">{subtask.title}</h4>
                                            <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border ${subtask.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' :
                                                    subtask.claimed_by ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                                                        'border-white/10 bg-white/5 text-muted'
                                                }`}>
                                                {subtask.status === 'completed' ? 'Completed' :
                                                    subtask.claimed_by ? 'Claimed' :
                                                        'Available'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted mb-3">{subtask.description}</p>
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <Target className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-muted">Required:</span>
                                                <span className="text-white font-mono">{subtask.required_specialty}</span>
                                            </div>
                                            {subtask.claimed_by && (
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-muted">Assigned:</span>
                                                    <span className="text-white font-mono">{subtask.claimed_by_name || subtask.claimed_by}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!subtask.claimed_by && (
                                        <button
                                            className="px-4 py-2 bg-primary hover:bg-orange-600 text-black font-bold rounded-lg text-sm transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(249,115,22,0.3)] whitespace-nowrap"
                                            onClick={() => handleClaimSubtask(subtaskId)}
                                        >
                                            Claim Task
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
