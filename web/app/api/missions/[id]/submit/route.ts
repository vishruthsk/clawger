import { NextRequest, NextResponse } from 'next/server';
import { AgentAuth } from '@core/registry/agent-auth';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { MissionStore } from '@core/missions/mission-store';
import { MissionRegistry } from '@core/missions/mission-registry';
import { TaskQueue } from '@core/dispatch/task-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { WalletAuth } from '@core/auth/wallet-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { ArtifactStorage } from '@core/storage/artifact-storage';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';

const agentAuth = new AgentAuth('../data');
const notifications = new AgentNotificationQueue();
const missionStore = new MissionStore('../data');
const taskQueue = new TaskQueue('../data');
const heartbeatManager = new HeartbeatManager(agentAuth, '../data');
const walletAuth = new WalletAuth('../data');
const tokenLedger = new TokenLedger('../data');
const escrowEngine = new EscrowEngine(tokenLedger);
const artifactStorage = new ArtifactStorage('../data');
const assignmentHistory = new AssignmentHistoryTracker('../data');
const bondManager = new BondManager(tokenLedger, '../data');
const jobHistory = new JobHistoryManager('../data');
const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory, '../data');

const missionRegistry = new MissionRegistry(
    missionStore,
    agentAuth,
    notifications,
    taskQueue,
    heartbeatManager,
    escrowEngine,
    assignmentHistory,
    bondManager,
    settlementEngine
);

function extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
}

/**
 * POST /api/missions/:id/submit
 * Supports both JSON and multipart/form-data
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const apiKey = extractToken(request);
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agent = agentAuth.validate(apiKey);
        if (!agent) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
        }

        const contentType = request.headers.get('content-type') || '';
        let content = '';
        let artifacts: import('@core/missions/mission-store').ArtifactMetadata[] = [];

        // Handle multipart/form-data (file uploads)
        if (contentType.includes('multipart/form-data')) {
            console.log(`[SUBMIT] Processing multipart upload for mission ${id}`);

            const formData = await request.formData();
            content = (formData.get('content') as string) || '';
            const files = formData.getAll('files') as File[];

            // Save uploaded files
            if (files && files.length > 0) {
                console.log(`[SUBMIT] Uploading ${files.length} files for mission ${id}`);

                for (const file of files) {
                    if (file && file.size > 0) {
                        try {
                            const metadata = await artifactStorage.saveFile(id, file, agent.id);
                            artifacts.push(metadata);
                            console.log(`[SUBMIT] Saved file: ${metadata.original_filename}`);
                        } catch (error: any) {
                            console.error(`[SUBMIT] Failed to save file ${file.name}:`, error.message);
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
            content = body.content || '';
            // Legacy: body.artifacts would be string[] URLs, convert to ArtifactMetadata if needed
            // For now, we'll just accept the new format or empty array
            artifacts = body.artifacts || [];
        }

        // Validate submission
        if (!content && artifacts.length === 0) {
            return NextResponse.json({ error: 'Submission content or files required' }, { status: 400 });
        }

        // Submit work
        const success = missionRegistry.submitWork(
            id,
            agent.id,
            content,
            artifacts
        );

        if (!success) {
            return NextResponse.json(
                { error: 'Submission failed. Check if mission is executing and assigned to you.' },
                { status: 400 }
            );
        }

        const mission = missionRegistry.getMission(id);

        return NextResponse.json({
            success: true,
            mission,
            artifacts: artifacts.map(a => ({
                filename: a.original_filename,
                url: a.url,
                size: a.size
            })),
            message: 'Work submitted. Awaiting verification.',
            status: 'verifying'
        });
    } catch (error: any) {
        console.error('[SUBMIT] Error:', error);
        return NextResponse.json(
            { error: error.message, code: 'SUBMIT_ERROR' },
            { status: 400 }
        );
    }
}
