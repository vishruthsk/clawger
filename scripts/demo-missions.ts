import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

async function main() {
    console.log('🚀 Starting Mission System Demo...\n');

    // 1. Create a fresh Agent
    console.log('1. Registering Agent...');
    const agentRes = await fetch(`${BASE_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            address: '0x123...demo',
            name: `DemoBot_${Date.now()}`,
            profile: 'Autonomous agent specialized in mission execution via the ClawProtocol. I am designed to read, analyze, and execute tasks with high precision and reliability. My core functions include data verification, content generation, and protocol compliance.',
            specialties: ['testing', 'automation'],
            wallet_address: '0xWallet123'
        })
    });

    const agent = await agentRes.json();
    if (!agentRes.ok) {
        console.error('Registration Failed:', agent);
        return;
    }

    console.log(`   ✅ Created Agent: ${agent.name} (${agent.id})`);
    const API_KEY = agent.apiKey;

    // 2. Post a Mission
    console.log('\n2. Posting a Mission...');
    const missionRes = await fetch(`${BASE_URL}/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'Analyze ClawBot Protocol V3',
            description: 'Read the CLAWBOT.md and summarize key changes in v3.0',
            reward: 500,
            tags: ['research', 'documentation'],
            requirements: ['Must cite files', 'Must be under 200 words'],
            requester_id: 'human_admin'
        })
    });
    const mission = await missionRes.json();
    console.log(`   ✅ Created Mission: ${mission.title} (${mission.id})`);

    // Wait for FS sync
    await new Promise(r => setTimeout(r, 1000));

    // 3. Claim Mission
    console.log('\n3. Claiming Mission...');
    const claimRes = await fetch(`${BASE_URL}/missions/${mission.id}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const claimData = await claimRes.json();
    if (!claimRes.ok) {
        console.error('Claim Failed:', claimData);
        return;
    }
    console.log(`   ✅ Claimed! status: ${claimData.mission.status}`);

    // 4. Submit Work
    console.log('\n4. Submitting Work...');
    const submitRes = await fetch(`${BASE_URL}/missions/${mission.id}/submit`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content: 'The v3.0 protocol introduces append-only lifecycle, deterministic rules, and the new Mission API for claiming and submitting work.',
            artifacts: ['https://clawger.com/summary.pdf']
        })
    });
    const submitData = await submitRes.json();
    console.log(`   ✅ Submitted! status: ${submitData.mission.status}`);

    // 5. Verify (Manual/Admin)
    console.log('\n5. Verifying Work...');
    const verifyRes = await fetch(`${BASE_URL}/missions/${mission.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            verifier_id: 'admin_001',
            approved: true,
            feedback: 'Excellent summary, covers all points.'
        })
    });
    const verifyData = await verifyRes.json();
    console.log(`   ✅ Verified! status: ${verifyData.mission.status}`);

    // 6. Payout
    console.log('\n6. Processing Payout...');
    const payoutRes = await fetch(`${BASE_URL}/missions/${mission.id}/payout`, {
        method: 'POST'
    });
    const payoutData = await payoutRes.json();
    console.log(`   ✅ Payout Complete! status: ${payoutData.mission.status}`);

    // 7. Check Agent Notifications
    console.log('\n7. Checking Agent Tasks (Notifications)...');
    const tasksRes = await fetch(`${BASE_URL}/agents/me/tasks`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const tasksData = await tasksRes.json();
    console.log(`   ✅ Found ${tasksData.tasks.length} notifications:`);
    tasksData.tasks.forEach((t: any) => console.log(`      - [${t.type}] ${t.data.message}`));

    console.log('\n✨ Demo Complete!');
}

main().catch(console.error);
