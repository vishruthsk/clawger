import { NextRequest, NextResponse } from 'next/server';
import { MissionStore } from '@core/missions/mission-store';
import { AgentAuth } from '@core/registry/agent-auth';
import { TaskQueue } from '@core/dispatch/task-queue';
import { ArtifactStorage } from '@core/storage/artifact-storage';

const MAX_REVISIONS = 5;

/**
 * POST /api/missions/:id/revise
 * 
 * Submit revised work for a mission after receiving feedback.
 * Tracks revision count and auto-fails after max revisions.
 * Supports multipart/form-data for file uploads.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: missionId } = await params;

        const contentType = request.headers.get('content-type') || '';
        let revised_content = '';
        let agent_id = '';
        let artifacts: import('@core/missions/mission-store').ArtifactMetadata[] = [];

        // Handle multipart/form-data (file uploads)
        if (contentType.includes('multipart/form-data')) {
            console.log(`[REVISE] Processing multipart upload for mission ${missionId}`);

            const formData = await request.formData();
            revised_content = (formData.get('revised_content') as string) || '';
            agent_id = (formData.get('agent_id') as string) || '';
            const files = formData.getAll('files') as File[];

            // Save uploaded files
            const artifactStorage = new ArtifactStorage('../data');
            if (files && files.length > 0) {
                console.log(`[REVISE] Uploading ${files.length} files for mission ${missionId}`);

                for (const file of files) {
                    if (file && file.size > 0) {
                        try {
                            const metadata = await artifactStorage.saveFile(missionId, file, agent_id);
                            artifacts.push(metadata);
                            console.log(`[REVISE] Saved file: ${metadata.original_filename}`);
                        } catch (error: any) {
                            console.error(`[REVISE] Failed to save file ${file.name}:`, error.message);
                            return NextResponse.json(
                                { error: `Failed to upload file ${file.name}: ${error.message}` },
                                { status: 400 }
                            );
                        }
                    }
                }
            }
        }
        // Handle JSON (backward compatibility)
        else {
            const body = await request.json();
            revised_content = body.revised_content || '';
            agent_id = body.agent_id || '';
            artifacts = body.revised_artifacts || [];
        }

        if (!revised_content && artifacts.length === 0) {
            return NextResponse.json(
                { error: 'Revised content or files required' },
                { status: 400 }
            );
        }

        // Get mission
        const missionStore = new MissionStore('../data');
        const mission = missionStore.get(missionId);

        if (!mission) {
            return NextResponse.json(
                { error: 'Mission not found' },
                { status: 404 }
            );
        }

        // Verify mission is in revisable state
        if (mission.status !== 'verifying' && mission.status !== 'executing') {
            return NextResponse.json(
                { error: 'Mission not in revisable state' },
                { status: 400 }
            );
        }

        // Verify agent is assigned to this mission
        if (mission.assigned_agent?.agent_id !== agent_id) {
            return NextResponse.json(
                { error: 'Unauthorized: not assigned to this mission' },
                { status: 403 }
            );
        }

        // Initialize or increment revision count
        const revisionCount = ((mission as any).revision_count || 0) + 1;

        if (revisionCount > MAX_REVISIONS) {
            // Auto-fail mission after max revisions
            (mission as any).status = 'failed';
            (mission as any).failure_reason = `Exceeded maximum revisions (${MAX_REVISIONS})`;
            missionStore.update(mission.id, mission as any);

            return NextResponse.json(
                {
                    error: 'Maximum revisions exceeded',
                    max_revisions: MAX_REVISIONS,
                    mission_failed: true
                },
                { status: 400 }
            );
        }

        // Update mission with revised work
        const existingArtifacts = (mission as any).work_artifacts || [];
        const allArtifacts = [...existingArtifacts, ...artifacts];

        // Track revision history
        const revisionHistory = (mission as any).artifact_revision_history || [];
        revisionHistory.push({
            revision_number: revisionCount,
            artifacts: artifacts,
            content: revised_content,
            submitted_at: new Date(),
            submitted_by: agent_id
        });

        (mission as any).work_content = revised_content;
        (mission as any).work_artifacts = allArtifacts;
        (mission as any).artifact_revision_history = revisionHistory;
        (mission as any).revision_count = revisionCount;
        (mission as any).last_revised_at = new Date();

        // Reset verification if needed
        if (mission.status === 'verifying') {
            mission.status = 'executing'; // Back to executing for re-verification
        }

        missionStore.update(mission.id, mission as any);

        // Notify requester of revision
        const taskQueue = new TaskQueue('../data');
        taskQueue.enqueue({
            agent_id: mission.requester_id,
            type: 'mission_assigned', // Use existing type
            priority: 'normal',
            payload: {
                mission_id: missionId,
                action: 'revision_submitted',
                revision_number: revisionCount,
                message: `Agent submitted revision ${revisionCount}/${MAX_REVISIONS}`
            }
        });

        return NextResponse.json({
            success: true,
            revision_count: revisionCount,
            max_revisions: MAX_REVISIONS,
            revisions_remaining: MAX_REVISIONS - revisionCount,
            artifacts: artifacts.map(a => ({
                filename: a.original_filename,
                url: a.url,
                size: a.size
            })),
            message: `Revision ${revisionCount} submitted successfully`
        });

    } catch (error: any) {
        console.error('[REVISE] Error:', error);
        return NextResponse.json(
            { error: 'Failed to submit revision', details: error.message },
            { status: 500 }
        );
    }
}
