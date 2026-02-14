import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { formatEther } from 'ethers';
import { MissionRegistry } from '@core/missions/mission-registry';
import { AgentAuth } from '@core/registry/agent-auth';
import { TokenLedger } from '@core/ledger/token-ledger';
import { TaskQueue } from '@core/dispatch/task-queue';
import { MissionStore, ArtifactMetadata } from '@core/missions/mission-store';
import { AgentNotificationQueue } from '@core/tasks/agent-notification-queue';
import { HeartbeatManager } from '@core/dispatch/heartbeat-manager';
import { EscrowEngine } from '@core/escrow/escrow-engine';
import { AssignmentHistoryTracker } from '@core/missions/assignment-history';
import { BondManager } from '@core/bonds/bond-manager';
import { SettlementEngine } from '@core/settlement/settlement-engine';
import { JobHistoryManager } from '@core/jobs/job-history-manager';
import { ReputationEngine } from '@core/agents/reputation-engine';
import { MISSION_CATEGORIES } from '@core/constants';
import { uploadArtifact, getSignedUrl } from '../../../lib/supabase-storage';


/**
 * GET /api/missions
 * 
 * Returns ALL missions: real missions from Postgres + demo missions appended.
 * 
 * CRITICAL RULES:
 * - Production missions come from Postgres table: proposals (joined with tasks)
 * - Demo missions come from /api/demo/missions
 * - Demo is ADDITIVE, never a fallback
 * - If Postgres fails, return 500 (do NOT serve demo as fallback)
 * 
 * Response Format:
 * {
 *   "missions": [...],
 *   "source": {
 *     "real": <count>,
 *     "demo": <count>
 *   }
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // ========================================
        // STEP 1: Fetch Real Missions from Postgres (JOIN with tasks)
        // ========================================
        const result = await pool.query(`
            SELECT 
                p.id,
                p.proposer as requester_id,
                p.objective as description,
                p.escrow as reward,
                p.status as proposal_status,
                p.deadline,
                p.tx_hash,
                p.block_number,
                p.created_at as posted_at,
                t.status as task_status,
                t.worker as assigned_agent,
                t.settled
            FROM proposals p
            LEFT JOIN tasks t ON p.id = t.proposal_id
            ORDER BY p.created_at DESC
        `);

        // Transform proposals into mission format
        const realMissions = result.rows.map((row: any) => {
            const formattedReward = parseFloat(formatEther(row.reward)).toString();

            // Use settled status if settled, otherwise task status, otherwise proposal status
            let displayStatus = row.task_status || row.proposal_status;
            if (row.settled) {
                displayStatus = 'settled';
            }

            // Clean title (remove timestamp suffix like " - 1771000869504")
            const cleanTitle = (row.description?.substring(0, 60) || `Proposal #${row.id}`)
                .replace(/ - \d+$/, '');

            return {
                id: row.id,
                title: cleanTitle + (row.description?.length > 60 ? '...' : ''),
                description: row.description,
                reward: formattedReward, // "1" instead of "1.0"
                status: displayStatus, // Use settled if settled, otherwise task status
                assignment_mode: 'autopilot',
                requester_id: row.requester_id,
                posted_at: row.posted_at,
                deadline: row.deadline,
                specialties: [],
                requirements: [],
                deliverables: [],
                tags: [],
                escrow: formattedReward,
                timeline: null,
                assigned_agent: row.assigned_agent || null,
                bids: [],
                tx_hash: row.tx_hash,
                block_number: row.block_number,
                crew: null,
                demo: false,
                settled: row.settled || false,
            };
        });

        // Return only production missions from Postgres
        // Demo missions are fetched and merged by the frontend hook
        return NextResponse.json(realMissions);

    } catch (error: any) {
        console.error('[API /missions] Postgres error:', error);

        // CRITICAL: If Postgres fails, return 500
        // DO NOT serve demo as fallback
        return NextResponse.json(
            {
                error: 'Database connection failed',
                code: 'DATABASE_ERROR',
                message: error.message,
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/missions
 * 
 * Create a new mission (supports both solo and crew missions)
 * 
 * Accepts:
 * - FormData (from UI with file uploads)
 * - JSON (from bot API calls)
 * 
 * Request Body (JSON):
 * {
 *   "title": string,
 *   "description": string,
 *   "reward": number,
 *   "specialties": string[],  // Must be from MISSION_CATEGORIES
 *   "tags": string[],         // Must be from MISSION_CATEGORIES
 *   "requirements": string[],
 *   "deliverables": string[],
 *   "deadline": string (ISO date),
 *   "mission_type": "solo" | "crew",
 *   "crew_enabled": boolean,
 *   "crew_size": number (2-10),
 *   "requester_id": string,
 *   "requester_type": "wallet" | "agent"
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // ========================================
        // STEP 1: Parse Request Body (FormData or JSON)
        // ========================================
        const contentType = request.headers.get('content-type') || '';
        let body: any;
        let files: File[] = [];

        if (contentType.includes('multipart/form-data')) {
            // UI submission with files
            const formData = await request.formData();

            body = {
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                reward: parseFloat(formData.get('reward') as string),
                specialties: JSON.parse(formData.get('specialties') as string || '[]'),
                tags: JSON.parse(formData.get('tags') as string || '[]'),
                requirements: JSON.parse(formData.get('requirements') as string || '[]'),
                deliverables: JSON.parse(formData.get('deliverables') as string || '[]'),
                mission_type: formData.get('mission_type') as string,
                crew_enabled: formData.get('crew_enabled') === 'true',
                crew_size: parseInt(formData.get('crew_size') as string || '0'),
                deadline: formData.get('deadline') as string,
                requester_id: formData.get('wallet_address') as string || formData.get('requester_id') as string,
                requester_type: formData.get('requester_type') as string || 'wallet',
                tx_hash: formData.get('tx_hash') as string,
                mission_id: formData.get('mission_id') as string
            };

            // Extract files
            for (let i = 0; i < 10; i++) {
                const file = formData.get(`file_${i}`);
                if (file && file instanceof File) {
                    files.push(file);
                }
            }
        } else {
            // Bot API call (JSON)
            body = await request.json();
        }

        // ========================================
        // STEP 2: Validate Required Fields
        // ========================================
        if (!body.title || !body.description || !body.reward) {
            return NextResponse.json(
                { error: 'Missing required fields: title, description, reward' },
                { status: 400 }
            );
        }

        if (typeof body.reward !== 'number' || body.reward <= 0) {
            return NextResponse.json(
                { error: 'Reward must be a positive number' },
                { status: 400 }
            );
        }

        // ========================================
        // STEP 3: Validate Standardized Categories
        // ========================================
        const specialties = body.specialties || [];
        const tags = body.tags || [];

        if (specialties.length === 0) {
            return NextResponse.json(
                { error: 'At least one specialty is required' },
                { status: 400 }
            );
        }

        const invalidSpecialties = specialties.filter((s: string) => !MISSION_CATEGORIES.includes(s as any));
        if (invalidSpecialties.length > 0) {
            return NextResponse.json(
                {
                    error: `Invalid specialties: ${invalidSpecialties.join(', ')}. Must be one of: ${MISSION_CATEGORIES.join(', ')}`
                },
                { status: 400 }
            );
        }

        const invalidTags = tags.filter((t: string) => !MISSION_CATEGORIES.includes(t as any));
        if (invalidTags.length > 0) {
            return NextResponse.json(
                {
                    error: `Invalid tags: ${invalidTags.join(', ')}. Must be one of: ${MISSION_CATEGORIES.join(', ')}`
                },
                { status: 400 }
            );
        }

        // ========================================
        // STEP 4: Validate Crew Mission Parameters
        // ========================================
        if (body.crew_enabled || body.mission_type === 'crew') {
            const crewSize = body.crew_size || 0;
            if (crewSize < 2 || crewSize > 10) {
                return NextResponse.json(
                    { error: 'Crew size must be between 2 and 10' },
                    { status: 400 }
                );
            }
        }

        // ========================================
        // STEP 5: Initialize MissionRegistry
        // ========================================
        const agentAuth = new AgentAuth();
        const missionStore = new MissionStore();
        const notifications = new AgentNotificationQueue();
        const taskQueue = new TaskQueue();
        const heartbeatManager = new HeartbeatManager(agentAuth);
        const tokenLedger = new TokenLedger();
        const escrowEngine = new EscrowEngine(tokenLedger);
        const assignmentHistory = new AssignmentHistoryTracker();
        const bondManager = new BondManager(tokenLedger);
        const jobHistory = new JobHistoryManager();
        const reputationEngine = new ReputationEngine(jobHistory);
        const settlementEngine = new SettlementEngine(tokenLedger, bondManager, agentAuth, jobHistory);

        const missionRegistry = new MissionRegistry(
            missionStore,
            agentAuth,
            notifications,
            taskQueue,
            heartbeatManager,
            escrowEngine,
            assignmentHistory,
            bondManager,
            settlementEngine,
            reputationEngine
        );

        // ========================================
        // STEP 6: Create Mission
        // ========================================
        console.log(`[POST /api/missions] Creating mission: ${body.title}`);
        console.log(`[POST /api/missions] Crew enabled: ${body.crew_enabled}, Type: ${body.mission_type}`);

        const result = await missionRegistry.createMission({
            requester_id: body.requester_id || 'demo_requester',
            requester_type: body.requester_type || 'wallet',
            title: body.title,
            description: body.description,
            reward: body.reward,
            specialties: specialties,
            requirements: body.requirements || [],
            deliverables: body.deliverables || [],
            tags: tags,
            deadline: body.deadline ? new Date(body.deadline) : undefined,
            crew_enabled: body.crew_enabled || body.mission_type === 'crew',
        });

        // ========================================
        // STEP 7: Handle File Uploads to Supabase Storage
        // ========================================
        if (files.length > 0) {
            console.log(`[POST /api/missions] Uploading ${files.length} files to Supabase Storage`);

            for (const file of files) {
                try {
                    // Upload to Supabase Storage
                    const artifact = await uploadArtifact(
                        result.mission.id,
                        file,
                        body.requester_id || 'requester'
                    );

                    // Generate signed URL (valid for 24 hours)
                    const { url: signedUrl, expiresAt } = await getSignedUrl(artifact.storage_path, 86400);

                    // Store artifact metadata in mission_artifacts table
                    await pool.query(
                        `INSERT INTO mission_artifacts (
                            id, mission_id, filename, original_filename, storage_path,
                            signed_url, url_expires_at, size, mime_type, uploaded_by, uploaded_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                        [
                            artifact.id,
                            result.mission.id,
                            artifact.filename,
                            artifact.original_filename,
                            artifact.storage_path,
                            signedUrl,
                            expiresAt,
                            artifact.size,
                            artifact.mime_type,
                            artifact.uploaded_by,
                            artifact.uploaded_at
                        ]
                    );

                    console.log(`[POST /api/missions] Uploaded ${artifact.original_filename} to Supabase Storage`);
                } catch (uploadError: any) {
                    console.error(`[POST /api/missions] Failed to upload ${file.name}:`, uploadError);
                    // Continue with other files even if one fails
                }
            }
        }

        // ========================================
        // STEP 8: Persist Crew Mission Data to Postgres
        // ========================================
        if (body.crew_enabled || body.mission_type === 'crew') {
            await pool.query(
                `UPDATE missions_data 
                 SET crew_enabled = $1, crew_size = $2, specialties = $3, tags = $4
                 WHERE id = $5`,
                [
                    true,
                    body.crew_size || 0,
                    JSON.stringify(specialties),
                    JSON.stringify(tags),
                    result.mission.id
                ]
            );
            console.log(`[POST /api/missions] Persisted crew mission data for ${result.mission.id}`);
        } else {
            // Persist specialties and tags for solo missions too
            await pool.query(
                `UPDATE missions_data 
                 SET specialties = $1, tags = $2
                 WHERE id = $3`,
                [
                    JSON.stringify(specialties),
                    JSON.stringify(tags),
                    result.mission.id
                ]
            );
        }

        // ========================================
        // STEP 9: Return Response
        // ========================================
        console.log(`[POST /api/missions] Mission ${result.mission.id} created successfully`);
        console.log(`[POST /api/missions] Assignment mode: ${result.assignment_mode}`);
        if (result.crew_subtasks) {
            console.log(`[POST /api/missions] Created ${result.crew_subtasks.length} subtasks`);
        }

        return NextResponse.json({
            success: true,
            mission_id: result.mission.id,
            mission: result.mission,
            assignment_mode: result.assignment_mode,
            crew_subtasks: result.crew_subtasks,
            assigned_agent: result.assigned_agent,
            bidding_window_end: result.bidding_window_end,
            artifacts_uploaded: files.length
        });

    } catch (error: any) {
        console.error('[POST /api/missions] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                code: 'MISSION_CREATION_FAILED'
            },
            { status: 500 }
        );
    }
}
