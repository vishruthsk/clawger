import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@core/db';
import { formatEther } from 'ethers';

/**
 * GET /api/missions/:id
 * 
 * Returns a single mission by merging data from proposals and tasks tables.
 * Support Next.js 15+ async params.
 */
type Params = Promise<{ id: string }>;

export async function GET(
    request: NextRequest,
    props: { params: Params } // Next.js 15+ compatible signature
) {
    try {
        // Handle params being a Promise (Next.js 15) or an object (Next.js 14)
        // await is safe for both (awaiting an object returns the object)
        const params = await props.params;
        const { id } = params;

        console.log('[Mission Detail API] Fetching mission:', id);

        // ========================================
        // STEP 1: Fetch Proposal Data
        // ========================================
        const proposalResult = await pool.query(`
            SELECT 
                id,
                proposer,
                objective,
                escrow,
                deadline,
                status,
                tx_hash,
                block_number,
                created_at
            FROM proposals
            WHERE id = $1::integer
        `, [id]);

        if (proposalResult.rows.length === 0) {
            console.log('[Mission Detail API] Not found:', id);
            return NextResponse.json(
                {
                    error: 'Mission not found',
                    code: 'NOT_FOUND'
                },
                { status: 404 }
            );
        }

        const proposal = proposalResult.rows[0];

        // ========================================
        // STEP 2: Fetch Task Data with Agent Details
        // ========================================
        const taskResult = await pool.query(`
            SELECT 
                t.id as task_id,
                t.worker,
                t.verifier,
                t.status as task_status,
                t.settled,
                t.escrow as task_escrow,
                t.worker_bond,
                t.created_at as task_created_at,
                worker_agent.name as worker_name,
                worker_agent.reputation as worker_reputation,
                worker_agent.agent_type as worker_type,
                verifier_agent.name as verifier_name,
                verifier_agent.reputation as verifier_reputation
            FROM tasks t
            LEFT JOIN agents worker_agent ON t.worker = worker_agent.address
            LEFT JOIN agents verifier_agent ON t.verifier = verifier_agent.address
            WHERE t.proposal_id = $1::integer
        `, [id]);

        const task = taskResult.rows[0] || null;

        // ========================================
        // STEP 3: Transform to Mission Format
        // ========================================

        // Format bounty from wei to CLGR (remove decimals)
        const formattedReward = parseFloat(formatEther(proposal.escrow)).toString();

        // Determine display status (settled takes priority, then task status, then proposal status)
        let displayStatus = task ? task.task_status : proposal.status;
        if (task && task.settled) {
            displayStatus = 'settled';
        }

        // Clean title (remove timestamp suffix like " - 1771000869504")
        let cleanTitle = (proposal.objective?.substring(0, 60) || `Proposal #${proposal.id}`)
            .replace(/ - \d+$/, '');

        // Add ellipsis if title was truncated
        if (proposal.objective && proposal.objective.length > 60) {
            cleanTitle += '...';
        }

        // Extract tags and deliverables from description
        const tags = extractTags(proposal.objective);
        const deliverables = extractDeliverables(proposal.objective);

        // Build mission object
        const mission = {
            id: proposal.id,
            title: cleanTitle,
            description: proposal.objective,
            reward: formattedReward, // "1" instead of "1.0"
            status: displayStatus,
            assignment_mode: 'autopilot',
            requester_id: proposal.proposer,
            posted_at: proposal.created_at,
            deadline: proposal.deadline,

            // Task-specific fields with agent details
            assigned_agent: task?.worker ? {
                agent_id: task.worker,
                name: task.worker_name || task.worker.substring(0, 8) + '...',
                reputation: task.worker_reputation || 50,
                type: task.worker_type || 'Standard'
            } : null,
            verifier: task?.verifier ? {
                agent_id: task.verifier,
                name: task.verifier_name || task.verifier.substring(0, 8) + '...',
                reputation: task.verifier_reputation || 50
            } : null,
            verifiers: task?.verifier ? [{
                agent_id: task.verifier,
                name: task.verifier_name || task.verifier.substring(0, 8) + '...',
                reputation: task.verifier_reputation || 50
            }] : [],
            task_id: task?.task_id || null,
            settled: task?.settled || false,
            worker_bond: task?.worker_bond ? parseFloat(formatEther(task.worker_bond)).toString() : null,

            // Additional fields for compatibility
            specialties: [], // Don't duplicate tags here
            requirements: [],
            deliverables: deliverables, // Use extracted deliverables
            tags: tags, // Tags only appear here
            escrow: formattedReward,
            timeline: generateTimeline(proposal, task),
            bids: [],

            // Escrow status for UI (determines if "Required Bond" shows "Posted" or "Pending")
            escrow_status: {
                locked: task?.worker_bond && task.worker_bond !== '0',
                amount: task?.worker_bond ? parseFloat(formatEther(task.worker_bond)).toString() : null
            },

            // Metadata
            tx_hash: proposal.tx_hash,
            block_number: proposal.block_number,
            demo: false,
        };

        return NextResponse.json(mission);
    } catch (error: any) {
        console.error('[API /missions/:id] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch mission',
                code: 'DATABASE_ERROR',
                details: error.message
            },
            { status: 500 }
        );
    }
}

/**
 * Extract tags from description text based on keywords
 */
function extractTags(description: string): string[] {
    if (!description) return [];

    const tags = new Set<string>();
    const lowerDesc = description.toLowerCase();

    // Keywords mapping
    const keywords: Record<string, string> = {
        'reputation': 'Reputation System',
        'audit': 'Smart Contract Audit',
        'security': 'Security',
        'frontend': 'Frontend',
        'backend': 'Backend',
        'api': 'API Development',
        'database': 'Database',
        'design': 'UI/UX Design',
        'agent': 'Autonomous Agents',
        'ai': 'AI Integration',
        'blockchain': 'Blockchain',
        'defi': 'DeFi',
        'nft': 'NFT',
        'test': 'QA & Testing',
        'verification': 'On-Chain Verification'
    };

    // Add matching tags
    Object.entries(keywords).forEach(([keyword, tag]) => {
        if (lowerDesc.includes(keyword)) {
            tags.add(tag);
        }
    });

    // Default tag if none found
    if (tags.size === 0) {
        tags.add('General Task');
    }

    return Array.from(tags).slice(0, 5); // Limit to 5 tags
}

/**
 * Extract deliverables from description (looking for bullet points or lists)
 */
function extractDeliverables(description: string): string[] {
    if (!description) return [];

    // Look for lines starting with -, *, or number.
    const lines = description.split('\n');
    const deliverables = lines
        .filter(line => /^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line))
        .map(line => line.replace(/^\s*[-*•\d\.]+\s+/, '').trim())
        .filter(line => line.length > 5); // Filter out too short lines

    // If no explicit list found, try to extract based on sentences containing "deliver" or "implement"
    if (deliverables.length === 0) {
        const sentences = description.match(/[^.!?]+[.!?]+/g) || [];
        sentences.forEach(sentence => {
            const s = sentence.toLowerCase();
            if (s.includes('deliver') || s.includes('create') || s.includes('implement') || s.includes('build')) {
                deliverables.push(sentence.trim());
            }
        });
    }

    // Fallback if still empty
    if (deliverables.length === 0) {
        return ["Complete mission objective", "Provide proof of work", "Submit executable artifacts"];
    }

    return deliverables.slice(0, 6); // Limit to 6 items
}

/**
 * Generate timeline events from proposal and task data
 */
function generateTimeline(proposal: any, task: any) {
    const events = [];

    // Mission posted
    events.push({
        event: 'Mission Posted',
        timestamp: proposal.created_at, // UPDATED: Changed from 'time' to 'timestamp' to match frontend expectation
        status: 'completed',
        actor: proposal.proposer
    });

    if (task) {
        // Agent assigned
        events.push({
            event: 'Agent Assigned',
            timestamp: task.task_created_at,
            status: 'completed',
            actor: task.worker
        });

        // Add status-based events
        if (task.task_status === 'executing' || task.task_status === 'completed' || task.task_status === 'verified') {
            events.push({
                event: 'Execution Started',
                timestamp: task.task_created_at, // Ideally we'd have a separate field, using created_at for now
                status: 'completed'
            });
        }

        if (task.task_status === 'completed' || task.task_status === 'verified') {
            events.push({
                event: 'Work Submitted',
                timestamp: task.task_created_at, // Use task creation time as approximation
                status: 'completed'
            });
        }

        if (task.task_status === 'verified') {
            events.push({
                event: 'Verification Complete',
                timestamp: task.task_created_at, // Use task creation time as approximation
                status: 'completed'
            });
        }

        if (task.settled) {
            events.push({
                event: 'Payment Settled',
                timestamp: task.task_created_at, // Use task creation time as approximation
                status: 'completed'
            });
        }
    }

    return events;
}
