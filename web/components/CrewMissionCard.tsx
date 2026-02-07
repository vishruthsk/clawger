'use client';

import React from 'react';
import { Mission } from '@core/missions/mission-store';

interface CrewMissionCardProps {
    mission: Mission;
}

export function CrewMissionCard({ mission }: CrewMissionCardProps) {
    if (!mission.crew_required) {
        return null;
    }

    const progress = mission.task_graph ? calculateProgress(mission.task_graph) : null;
    const crewMembers = mission.crew_assignments || [];
    const artifacts = mission.mission_artifacts || [];
    const openBlockers = mission.blockers?.filter(b => !b.resolved) || [];

    return (
        <div className="crew-mission-card">
            {/* Header */}
            <div className="crew-header">
                <div className="crew-badge">
                    <span className="crew-icon">👥</span>
                    <span>Crew Mission</span>
                </div>
                <div className="crew-size">
                    {crewMembers.length}/{mission.crew_config?.max_agents} Members
                </div>
            </div>

            {/* Crew Members */}
            <div className="crew-members">
                <h4>Crew</h4>
                <div className="member-list">
                    {crewMembers.map((member) => (
                        <div key={member.agent_id} className={`member-item status-${member.status}`}>
                            <div className="member-avatar">
                                {member.agent_name.charAt(0)}
                            </div>
                            <div className="member-info">
                                <div className="member-name">{member.agent_name}</div>
                                <div className="member-role">{member.role}</div>
                            </div>
                            <div className={`member-status status-${member.status}`}>
                                {member.status === 'active' && <span className="status-dot active"></span>}
                                {member.status === 'idle' && <span className="status-dot idle"></span>}
                                {member.status === 'dropped' && <span className="status-dot dropped"></span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress */}
            {progress && (
                <div className="task-progress">
                    <h4>Task Progress</h4>
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progress.percentage}%` }}
                        />
                    </div>
                    <div className="progress-stats">
                        <span>
                            {progress.completed}/{progress.total} Tasks Complete
                        </span>
                        <span className="progress-percentage">
                            {progress.percentage.toFixed(0)}%
                        </span>
                    </div>
                    <div className="task-breakdown">
                        {progress.in_progress > 0 && (
                            <span className="task-stat in-progress">
                                {progress.in_progress} In Progress
                            </span>
                        )}
                        {progress.blocked > 0 && (
                            <span className="task-stat blocked">
                                {progress.blocked} Blocked
                            </span>
                        )}
                        {progress.available > 0 && (
                            <span className="task-stat available">
                                {progress.available} Available
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Artifacts */}
            {artifacts.length > 0 && (
                <div className="artifacts-section">
                    <h4>Artifacts ({artifacts.length})</h4>
                    <div className="artifact-list">
                        {artifacts.slice(0, 3).map((artifact) => (
                            <div key={artifact.id} className="artifact-item">
                                <span className="artifact-icon">📄</span>
                                <span className="artifact-type">{artifact.type}</span>
                                {artifacts.length > 3 && (
                                    <span className="artifact-more">+{artifacts.length - 3} more</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Blockers */}
            {openBlockers.length > 0 && (
                <div className="blockers-section">
                    <div className="blocker-alert">
                        <span className="blocker-icon">⚠️</span>
                        <span>{openBlockers.length} Active Blocker{openBlockers.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
            )}

            <style jsx>{`
                .crew-mission-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    padding: 20px;
                    color: white;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .crew-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .crew-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.2);
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                }

                .crew-icon {
                    font-size: 16px;
                }

                .crew-size {
                    font-size: 14px;
                    opacity: 0.9;
                }

                .crew-members {
                    margin-bottom: 20px;
                }

                .crew-members h4 {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    opacity: 0.9;
                }

                .member-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .member-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.15);
                    padding: 10px;
                    border-radius: 8px;
                }

                .member-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                }

                .member-info {
                    flex: 1;
                }

                .member-name {
                    font-weight: 500;
                    font-size: 14px;
                }

                .member-role {
                    font-size: 12px;
                    opacity: 0.8;
                    text-transform: capitalize;
                }

                .member-status {
                    display: flex;
                    align-items: center;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .status-dot.active {
                    background: #48bb78;
                    box-shadow: 0 0 8px #48bb78;
                }

                .status-dot.idle {
                    background: #ecc94b;
                }

                .status-dot.dropped {
                    background: #f56565;
                }

                .task-progress {
                    margin-bottom: 20px;
                }

                .task-progress h4 {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    opacity: 0.9;
                }

                .progress-bar-container {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }

                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #48bb78, #38a169);
                    transition: width 0.3s ease;
                }

                .progress-stats {
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    margin-bottom: 8px;
                }

                .progress-percentage {
                    font-weight: 600;
                }

                .task-breakdown {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .task-stat {
                    font-size: 12px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    background: rgba(255, 255, 255, 0.15);
                }

                .task-stat.in-progress {
                    background: rgba(237, 242, 247, 0.2);
                }

                .task-stat.blocked {
                    background: rgba(255, 87, 87, 0.2);
                }

                .task-stat.available {
                    background: rgba(72, 187, 120, 0.2);
                }

                .artifacts-section {
                    margin-bottom: 16px;
                }

                .artifacts-section h4 {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    opacity: 0.9;
                }

                .artifact-list {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .artifact-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255, 255, 255, 0.15);
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                }

                .artifact-icon {
                    font-size: 14px;
                }

                .artifact-type {
                    text-transform: capitalize;
                }

                .artifact-more {
                    opacity: 0.7;
                }

                .blockers-section {
                    margin-top: 12px;
                }

                .blocker-alert {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 87, 87, 0.3);
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                }

                .blocker-icon {
                    font-size: 16px;
                }
            `}</style>
        </div>
    );
}

function calculateProgress(taskGraph: any): {
    total: number;
    available: number;
    claimed: number;
    in_progress: number;
    completed: number;
    blocked: number;
    percentage: number;
} {
    const nodes = Object.values(taskGraph.nodes || {}) as any[];
    const stats = {
        total: nodes.length,
        available: 0,
        claimed: 0,
        in_progress: 0,
        completed: 0,
        blocked: 0,
        percentage: 0
    };

    nodes.forEach((task: any) => {
        switch (task.status) {
            case 'available':
                stats.available++;
                break;
            case 'claimed':
                stats.claimed++;
                break;
            case 'in_progress':
                stats.in_progress++;
                break;
            case 'completed':
                stats.completed++;
                break;
            case 'blocked':
                stats.blocked++;
                break;
        }
    });

    stats.percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return stats;
}
