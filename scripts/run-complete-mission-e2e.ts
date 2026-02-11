/**
 * Complete End-to-End Mission Lifecycle Automation
 * 
 * Runs a full mission from ASSIGNED → SETTLED: PASS
 * Including: execution, revision, verification, settlement, and rating
 */

import axios from 'axios';
import { MissionStore } from '../core/missions/mission-store';
import { AgentAuth } from '../core/registry/agent-auth';
import { TokenLedger } from '../core/ledger/token-ledger';

const API_BASE = 'http://localhost:3000/api';
const MISSION_ID = 'mission_1770621831758_jkwind';

interface StepResult {
    step: string;
    success: boolean;
    details: any;
    error?: string;
}

const results: StepResult[] = [];

function logStep(step: string, details: any) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`STEP: ${step}`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(JSON.stringify(details, null, 2));
    results.push({ step, success: true, details });
}

function logError(step: string, error: any) {
    console.error(`\n❌ ERROR in ${step}:`);
    console.error(error.response?.data || error.message || error);
    results.push({ step, success: false, details: null, error: error.message });
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCompleteE2E() {
    console.log('\n' + '█'.repeat(80));
    console.log('█' + ' '.repeat(78) + '█');
    console.log('█' + '  COMPLETE END-TO-END MISSION LIFECYCLE AUTOMATION'.padEnd(78) + '█');
    console.log('█' + ' '.repeat(78) + '█');
    console.log('█'.repeat(80) + '\n');

    // Initialize local stores for balance tracking
    const missionStore = new MissionStore();
    const agentAuth = new AgentAuth();
    const tokenLedger = new TokenLedger();

    // Get mission details
    const mission = missionStore.get(MISSION_ID);
    if (!mission) {
        throw new Error(`Mission ${MISSION_ID} not found`);
    }

    const workerId = mission.assigned_agent?.agent_id;
    const workerProfile = agentAuth.getById(workerId!);
    const workerApiKey = workerProfile?.apiKey;
    const requesterId = mission.requester_id;

    console.log(`Mission: ${mission.title}`);
    console.log(`Worker: ${workerProfile?.name} (${workerId})`);
    console.log(`Requester: ${requesterId}`);
    console.log(`Reward: ${mission.reward} CLAWGER\n`);

    // Get initial balances
    const initialWorkerBalance = tokenLedger.getBalance(workerId!);
    const initialRequesterBalance = tokenLedger.getBalance(requesterId);

    console.log('INITIAL BALANCES:');
    console.log(`  Worker: ${initialWorkerBalance} CLAWGER`);
    console.log(`  Requester: ${initialRequesterBalance} CLAWGER`);

    try {
        // ========== STEP 1: Worker Polls for Tasks ==========
        logStep('1. Worker Polls for Tasks', { workerId, workerApiKey: workerApiKey?.substring(0, 20) + '...' });

        const pollResponse = await axios.get(`${API_BASE}/agents/me/tasks`, {
            headers: { 'Authorization': `Bearer ${workerApiKey}` }
        });

        const missionTask = pollResponse.data.tasks.find((t: any) =>
            t.type === 'mission_assigned' && t.payload.mission_id === MISSION_ID
        );

        if (!missionTask) {
            throw new Error('Mission task not found in queue');
        }

        logStep('1a. Mission Task Retrieved', {
            taskId: missionTask.id,
            type: missionTask.type,
            priority: missionTask.priority,
            missionId: missionTask.payload.mission_id
        });

        await sleep(1000);

        // ========== STEP 2: Worker Starts Mission (Stakes Bond) ==========
        logStep('2. Worker Starts Mission', { missionId: MISSION_ID });

        const startResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/start`,
            {},
            { headers: { 'Authorization': `Bearer ${workerApiKey}` } }
        );

        logStep('2a. Mission Started', {
            status: startResponse.data.mission.status,
            bondStaked: startResponse.data.bond_staked,
            bondAmount: startResponse.data.bond_amount
        });

        await sleep(1000);

        // ========== STEP 3: Worker Executes Work ==========
        logStep('3. Worker Executes Work', { simulatedWork: 'Generating deliverables...' });
        await sleep(2000); // Simulate work

        const workOutput = {
            deliverables: [
                'Completed coding task as specified',
                'All requirements met',
                'Code tested and verified'
            ],
            notes: 'Work completed successfully on first attempt',
            files: []
        };

        logStep('3a. Work Completed', workOutput);

        // ========== STEP 4: Worker Submits Work ==========
        logStep('4. Worker Submits Work', { missionId: MISSION_ID });

        const submitResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/submit`,
            {
                deliverables: workOutput.deliverables,
                notes: workOutput.notes,
                files: workOutput.files
            },
            { headers: { 'Authorization': `Bearer ${workerApiKey}` } }
        );

        logStep('4a. Work Submitted', {
            status: submitResponse.data.mission.status,
            submittedAt: submitResponse.data.mission.submitted_at
        });

        await sleep(1000);

        // ========== STEP 5: Requester Requests Revision ==========
        logStep('5. Requester Requests Revision', { missionId: MISSION_ID });

        // Get requester's API key (requester might not be an agent, use a default key)
        const requesterAgents = agentAuth.listAgents();
        const requesterAgent = requesterAgents.find(a => a.id === requesterId || a.address === requesterId);
        let requesterApiKey = requesterAgent?.apiKey;

        // If requester is not an agent, use the first available agent as proxy
        if (!requesterApiKey) {
            console.log('  Requester is not an agent, using first agent as proxy...');
            requesterApiKey = requesterAgents[0]?.apiKey;
        }

        const feedbackResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/feedback`,
            {
                action: 'revision_required',
                feedback: 'Please add more detailed comments to the code',
                revision_notes: 'Need better documentation'
            },
            { headers: { 'Authorization': `Bearer ${requesterApiKey}` } }
        );

        logStep('5a. Revision Requested', {
            status: feedbackResponse.data.mission.status,
            revisionCount: feedbackResponse.data.mission.revision_count,
            feedback: feedbackResponse.data.mission.feedback
        });

        await sleep(1000);

        // ========== STEP 6: Worker Polls for Revision Task ==========
        logStep('6. Worker Polls for Revision Task', { workerId });

        const pollRevisionResponse = await axios.get(`${API_BASE}/agents/me/tasks`, {
            headers: { 'Authorization': `Bearer ${workerApiKey}` }
        });

        const revisionTask = pollRevisionResponse.data.tasks.find((t: any) =>
            t.type === 'revision_required' && t.payload.mission_id === MISSION_ID
        );

        logStep('6a. Revision Task Retrieved', {
            taskId: revisionTask?.id,
            feedback: revisionTask?.payload.feedback
        });

        await sleep(1000);

        // ========== STEP 7: Worker Revises and Resubmits ==========
        logStep('7. Worker Revises Work', { missionId: MISSION_ID });

        const revisedWork = {
            deliverables: [
                'Completed coding task with detailed comments',
                'All requirements met with comprehensive documentation',
                'Code tested, verified, and well-documented'
            ],
            notes: 'Added detailed comments and documentation as requested',
            files: []
        };

        const reviseResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/revise`,
            {
                deliverables: revisedWork.deliverables,
                notes: revisedWork.notes,
                files: revisedWork.files
            },
            { headers: { 'Authorization': `Bearer ${workerApiKey}` } }
        );

        logStep('7a. Revision Submitted', {
            status: reviseResponse.data.mission.status,
            revisionCount: reviseResponse.data.mission.revision_count
        });

        await sleep(1000);

        // ========== STEP 8: Requester Approves (Triggers Verification) ==========
        logStep('8. Requester Approves Work', { missionId: MISSION_ID });

        const approveResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/feedback`,
            {
                action: 'approve',
                feedback: 'Excellent work! Documentation is perfect now.'
            },
            { headers: { 'Authorization': `Bearer ${requesterApiKey}` } }
        );

        logStep('8a. Work Approved - Verification Started', {
            status: approveResponse.data.mission.status,
            message: approveResponse.data.message
        });

        await sleep(1000);

        // ========== STEP 9: Spawn 3 Verifiers and Vote ==========
        logStep('9. Verifiers Vote on Mission', { missionId: MISSION_ID });

        // Get 3 verifier agents
        const allAgents = agentAuth.listAgents();
        const verifiers = allAgents
            .filter(a => a.id !== workerId && a.id !== requesterId)
            .slice(0, 3);

        console.log(`Selected verifiers: ${verifiers.map(v => v.name).join(', ')}`);

        for (const verifier of verifiers) {
            console.log(`\n  Verifier: ${verifier.name} voting...`);

            try {
                const voteResponse = await axios.post(
                    `${API_BASE}/missions/${MISSION_ID}/vote`,
                    {
                        vote: 'approve',
                        reasoning: `Work meets all requirements. Quality is excellent.`
                    },
                    { headers: { 'Authorization': `Bearer ${verifier.apiKey}` } }
                );

                console.log(`  ✅ ${verifier.name} voted APPROVE`);
                console.log(`     Votes: ${voteResponse.data.votes.approve}/${voteResponse.data.votes.total}`);

                await sleep(500);
            } catch (error: any) {
                console.error(`  ❌ ${verifier.name} vote failed:`, error.response?.data || error.message);
            }
        }

        logStep('9a. All Verifiers Voted', { verifierCount: verifiers.length });

        await sleep(1000);

        // ========== STEP 10: Trigger Settlement ==========
        logStep('10. Triggering Settlement', { missionId: MISSION_ID });

        const verifyResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/verify`,
            {},
            { headers: { 'Authorization': `Bearer ${requesterApiKey}` } }
        );

        logStep('10a. Settlement Triggered', {
            status: verifyResponse.data.mission.status,
            outcome: verifyResponse.data.mission.outcome,
            settlementId: verifyResponse.data.settlement?.id,
            distributions: verifyResponse.data.settlement?.distributions
        });

        await sleep(1000);

        // ========== STEP 11: Requester Rates Worker ==========
        logStep('11. Requester Rates Worker', { missionId: MISSION_ID, rating: 5 });

        const rateResponse = await axios.post(
            `${API_BASE}/missions/${MISSION_ID}/rate`,
            {
                rating: 5,
                review: 'Outstanding work! Very professional and responsive to feedback.'
            },
            { headers: { 'Authorization': `Bearer ${requesterApiKey}` } }
        );

        logStep('11a. Rating Submitted', {
            rating: rateResponse.data.mission.rating,
            review: rateResponse.data.mission.review,
            reputationUpdate: rateResponse.data.reputation_updated
        });

        await sleep(1000);

        // ========== STEP 12: Verify Final State ==========
        logStep('12. Verifying Final State', { missionId: MISSION_ID });

        const finalMission = missionStore.get(MISSION_ID);
        const finalWorkerBalance = tokenLedger.getBalance(workerId!);
        const finalRequesterBalance = tokenLedger.getBalance(requesterId);
        const workerEarnings = finalWorkerBalance - initialWorkerBalance;

        logStep('12a. Final Mission State', {
            status: finalMission?.status,
            outcome: finalMission?.outcome,
            rating: finalMission?.rating,
            revisionCount: finalMission?.revision_count,
            settledAt: finalMission?.settled_at
        });

        logStep('12b. Final Balances', {
            worker: {
                initial: initialWorkerBalance,
                final: finalWorkerBalance,
                earnings: workerEarnings
            },
            requester: {
                initial: initialRequesterBalance,
                final: finalRequesterBalance,
                spent: initialRequesterBalance - finalRequesterBalance
            }
        });

        // ========== SUMMARY ==========
        console.log('\n' + '█'.repeat(80));
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█' + '  MISSION LIFECYCLE COMPLETE'.padEnd(78) + '█');
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█'.repeat(80) + '\n');

        console.log('✅ SUCCESS! Mission completed full lifecycle:\n');
        console.log(`   ASSIGNED → EXECUTING → SUBMITTED → REVISION → VERIFYING → SETTLED: ${finalMission?.outcome}\n`);
        console.log(`Mission ID: ${MISSION_ID}`);
        console.log(`Final Status: ${finalMission?.status}`);
        console.log(`Outcome: ${finalMission?.outcome}`);
        console.log(`Rating: ${finalMission?.rating}/5 ⭐`);
        console.log(`Revisions: ${finalMission?.revision_count}`);
        console.log(`Worker Earnings: +${workerEarnings} CLAWGER`);
        console.log(`\nTotal Steps Completed: ${results.filter(r => r.success).length}/${results.length}`);

        return {
            success: true,
            missionId: MISSION_ID,
            finalStatus: finalMission?.status,
            outcome: finalMission?.outcome,
            rating: finalMission?.rating,
            workerEarnings,
            results
        };

    } catch (error: any) {
        console.error('\n❌ E2E TEST FAILED\n');
        console.error(error);
        logError('E2E Test', error);

        return {
            success: false,
            error: error.message,
            results
        };
    }
}

// Run the test
runCompleteE2E()
    .then(result => {
        console.log('\n' + '='.repeat(80));
        console.log('FINAL RESULT:', result.success ? '✅ SUCCESS' : '❌ FAILED');
        console.log('='.repeat(80));
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
