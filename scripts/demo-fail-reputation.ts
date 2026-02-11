import { ReputationEngine } from '../core/agents/reputation-engine';
import { JobHistoryManager } from '../core/jobs/job-history-manager';
import { AgentAuth } from '../core/registry/agent-auth';
import * as path from 'path';
import * as fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
    console.log('🧪 Starting Reputation Hardening verification...\n');

    // Initialize systems
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const agentAuth = new AgentAuth(DATA_DIR);
    const jobHistory = new JobHistoryManager(DATA_DIR);
    const reputationEngine = new ReputationEngine(DATA_DIR);

    // 1. Setup Test Agent
    const testAddress = 'test-addr-' + Date.now();
    const profile = await agentAuth.register({
        address: testAddress,
        name: 'Test Fail Agent',
        profile: 'Test agent for reputation verification',
        specialties: ['testing'],
        hourly_rate: 100
    });
    const agentId = profile.id;

    console.log(`Created agent: ${agentId}`);
    let rep = reputationEngine.calculateReputation(agentId);
    console.log(`Initial Reputation: ${rep} (Expected: 50)`);
    if (rep !== 50) throw new Error(`Initial reputation mismatch: ${rep}`);

    // 2. Simulate Failed Mission
    console.log('\n--- Test Case 1: Mission Failure ---');
    const missionId = 'mission-fail-' + Date.now();

    jobHistory.recordJobOutcome(agentId, {
        mission_id: missionId,
        mission_title: 'Failed Mission 101',
        reward: 0,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'FAIL',
        entry_id: `${missionId}:solo`
    });

    rep = reputationEngine.calculateReputation(agentId);
    console.log(`Reputation after FAIL: ${rep} (Expected: 40)`);
    if (rep !== 40) throw new Error(`Fail penalty mismatch: ${rep}`);

    // 3. Verify Idempotency (Duplicate Entry)
    console.log('\n--- Test Case 2: Idempotency ---');
    console.log('Attempting to record duplicate failure...');

    jobHistory.recordJobOutcome(agentId, {
        mission_id: missionId,
        mission_title: 'Failed Mission 101',
        reward: 0,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'FAIL',
        entry_id: `${missionId}:solo` // SAME ID
    });

    rep = reputationEngine.calculateReputation(agentId);
    console.log(`Reputation after Duplicate: ${rep} (Expected: 40)`);
    if (rep !== 40) throw new Error(`Idempotency failed! Reputation changed to ${rep}`);

    // 4. Verify Rating Scaling
    console.log('\n--- Test Case 3: Rating Scaling ---');

    // 5 Stars (+5 settlement + 2 bonus = +7) -> Rep 47
    jobHistory.recordJobOutcome(agentId, {
        mission_id: 'rating-5',
        mission_title: '5 Star Job',
        reward: 100,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'PASS',
        rating: 5,
        entry_id: 'rating-5:solo'
    });

    rep = reputationEngine.calculateReputation(agentId);
    console.log(`Reputation after 5★: ${rep} (Expected: 47)`);
    // Base 50 - 10 (fail) + 5 (settle) + 2 (bonus) = 47
    if (rep !== 47) throw new Error(`5★ mismatch: ${rep}`);

    // 1 Star (+5 settlement - 2 bonus = +3) -> Rep 50
    jobHistory.recordJobOutcome(agentId, {
        mission_id: 'rating-1',
        mission_title: '1 Star Job',
        reward: 100,
        completed_at: new Date().toISOString(),
        type: 'solo',
        outcome: 'PASS',
        rating: 1,
        entry_id: 'rating-1:solo'
    });

    rep = reputationEngine.calculateReputation(agentId);
    console.log(`Reputation after 1★: ${rep} (Expected: 50)`);
    // 47 + 5 (settle) - 2 (bonus) = 50
    if (rep !== 50) throw new Error(`1★ mismatch: ${rep}`);

    console.log('\n🎉 SUCCESS! Reputation Hardening Verified.');
}

main().catch(console.error);
