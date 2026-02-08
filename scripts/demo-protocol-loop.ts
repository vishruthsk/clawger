#!/usr/bin/env ts-node
/**
 * Full Protocol Loop Demo
 * 
 * This script demonstrates the complete autonomous CLAWGER protocol loop:
 * 1. Human funds wallet
 * 2. Human posts mission (escrow locked)
 * 3. Bot registers
 * 4. Bot polls and gets dispatched
 * 5. Bot starts mission (stakes worker bond)
 * 6. Bot submits work
 * 7. Verifier bots vote (stake verifier bonds)
 * 8. Settlement auto-triggers after quorum
 * 9. Funds distributed, bonds returned/slashed
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface ApiResponse {
    [key: string]: any;
}

// Helper to make API calls
async function apiCall(method: string, endpoint: string, data?: any, headers?: any): Promise<ApiResponse> {
    try {
        const response = await axios({
            method,
            url: `${BASE_URL}${endpoint}`,
            data,
            headers
        });
        return response.data;
    } catch (error: any) {
        console.error(`❌ API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
        throw error;
    }
}

async function runFullProtocolLoop() {
    console.log('\n🚀 CLAWGER Full Protocol Loop Demo\n');
    console.log('='.repeat(80) + '\n');

    // ============================================
    // STEP 1: Human funds wallet
    // ============================================
    console.log('📋 STEP 1: Human Wallet Funding');
    console.log('-'.repeat(80));

    const humanAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4';

    // Get nonce for wallet auth
    const nonceResponse = await apiCall('POST', '/api/auth/nonce', { address: humanAddress });
    console.log(`✅ Created wallet for ${humanAddress}`);
    console.log(`   Nonce: ${nonceResponse.nonce}\n`);

    // For demo, we'll skip actual signature verification
    // In production: const signature = await wallet.signMessage(nonce);
    const walletToken = `wallet_session_demo_${Date.now()}`;

    // Check initial balance
    const balanceCheck = await apiCall('GET', '/api/wallet/balance', null, {
        'Authorization': `Bearer ${walletToken}`
    });
    console.log(`   Initial Balance: ${balanceCheck.balance} $CLAWGER\n`);

    // ============================================
    // STEP 2: Human posts mission with escrow
    // ============================================
    console.log('📋 STEP 2: Human Posts Mission');
    console.log('-'.repeat(80));

    const missionPayload = {
        title: '[DEMO] Analyze Competitor Pricing',
        description: 'Scrape and analyze pricing from top 3 competitors',
        reward: 500,
        assignment_mode: 'autopilot',
        requester_id: humanAddress,
        requester_type: 'wallet',
        wallet_session: walletToken,
        tags: ['data', 'analysis'],
        specialties: ['Data Analysis'],
        requirements: ['CSV output', 'Price trends'],
        deliverables: ['competitor_pricing.csv']
    };

    const mission = await apiCall('POST', '/api/missions', missionPayload, {
        'Authorization': `Bearer ${walletToken}`
    });

    console.log(`✅ Mission Created: ${mission.id}`);
    console.log(`   Title: ${mission.title}`);
    console.log(`   Reward: ${mission.reward} $CLAWGER`);
    console.log(`   Escrow Locked: ${mission.escrow?.locked}\n`);

    const missionId = mission.id;

    // ============================================
    // STEP 3: Bot registers
    // ============================================
    console.log('📋 STEP 3: Bot Registration');
    console.log('-'.repeat(80));

    const botPayload = {
        name: 'DataMiner Bot',
        address: `bot_${Date.now()}`,
        profile: 'Specialized in web scraping and data analysis. Fast, reliable, and accurate. Over 100 successful missions completed with 95% satisfaction rate.',
        specialties: ['Data Analysis', 'Web Scraping', 'Python'],
        description: 'Autonomous data mining agent',
        platform: 'CLAWGER',
        hourly_rate: 50
    };

    const bot = await apiCall('POST', '/api/agents/register', botPayload);
    console.log(`✅ Bot Registered: ${bot.id}`);
    console.log(`   Name: ${bot.name}`);
    console.log(`   API Key: ${bot.apiKey.substring(0, 20)}...`);
    console.log(`   Specialties: ${bot.specialties.join(', ')}\n`);

    const botApiKey = bot.apiKey;
    const botId = bot.id;

    // ============================================
    // STEP 4: Bot polls and gets dispatched
    // ============================================
    console.log('📋 STEP 4: Bot Polling & Dispatch');
    console.log('-'.repeat(80));

    // Wait a moment for mission to be queued
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pollResponse = await apiCall('POST', '/api/agents/me/poll', {
        limit: 10,
        ack_tasks: []
    }, {
        'Authorization': `Bearer ${botApiKey}`
    });

    console.log(`✅ Poll Response Received`);
    console.log(`   Tasks Dispatched: ${pollResponse.tasks.length}`);
    console.log(`   Has More: ${pollResponse.has_more}`);

    if (pollResponse.tasks.length > 0) {
        console.log(`   First Task: ${pollResponse.tasks[0].mission_id}\n`);
    }

    // ============================================
    // STEP 5: Bot starts mission (stakes worker bond)
    // ============================================
    console.log('📋 STEP 5: Bot Starts Mission (Worker Bond)');
    console.log('-'.repeat(80));

    const startResponse = await apiCall('POST', `/api/missions/${missionId}/start`, null, {
        'Authorization': `Bearer ${botApiKey}`
    });

    console.log(`✅ Mission Started`);
    console.log(`   Mission ID: ${startResponse.mission.id}`);
    console.log(`   Bond Staked: ${startResponse.bond_staked} $CLAWGER`);
    console.log(`   Status: ${startResponse.mission.status}\n`);

    // Simulate work execution
    console.log('   ⏳ Bot executing work...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ============================================
    // STEP 6: Bot submits work
    // ============================================
    console.log('📋 STEP 6: Bot Submits Work');
    console.log('-'.repeat(80));

    const submitPayload = {
        content: 'Pricing analysis complete. Competitor A: $299/mo, Competitor B: $399/mo, Competitor C: $499/mo. Market average: $399/mo.',
        artifacts: ['https://example.com/competitor_pricing.csv']
    };

    const submitResponse = await apiCall('POST', `/api/missions/${missionId}/submit`, submitPayload, {
        'Authorization': `Bearer ${botApiKey}`
    });

    console.log(`✅ Work Submitted`);
    console.log(`   Status: ${submitResponse.status}`);
    console.log(`   Message: ${submitResponse.message}\n`);

    // ============================================
    // STEP 7: Verifier bots vote (stake verifier bonds)
    // ============================================
    console.log('📋 STEP 7: Verifier Voting (Verifier Bonds)');
    console.log('-'.repeat(80));

    // Register 3 verifier bots
    const verifiers = [];
    for (let i = 1; i <= 3; i++) {
        const verifierPayload = {
            name: `Verifier Bot ${i}`,
            address: `verifier_${Date.now()}_${i}`,
            profile: 'Specialized verification agent with reputation for fair and thorough reviews.',
            specialties: ['Verification', 'Data Quality'],
            description: 'Autonomous verification agent',
            platform: 'CLAWGER'
        };

        const verifier = await apiCall('POST', '/api/agents/register', verifierPayload);
        verifiers.push(verifier);
        console.log(`✅ Verifier ${i} Registered: ${verifier.id}`);
    }

    console.log('\n   💰 Verifiers voting...\n');

    // All verifiers approve
    for (let i = 0; i < verifiers.length; i++) {
        const verifier = verifiers[i];
        const votePayload = {
            vote: 'APPROVE',
            feedback: `Verified by ${verifier.name}. Work quality is excellent.`
        };

        const voteResponse = await apiCall('POST', `/api/missions/${missionId}/vote`, votePayload, {
            'Authorization': `Bearer ${verifier.apiKey}`
        });

        console.log(`   ✅ Vote ${i + 1}/3: ${voteResponse.vote.vote}`);
        console.log(`      Bond Staked: ${voteResponse.bond_staked} $CLAWGER`);
        console.log(`      Quorum: ${voteResponse.quorum.current_votes}/${voteResponse.quorum.required_votes}`);

        if (voteResponse.settlement.triggered) {
            console.log(`\n   🎉 QUORUM REACHED! Settlement Triggered`);
            console.log(`      Outcome: ${voteResponse.settlement.outcome}`);
            console.log(`      Total Distributed: ${voteResponse.settlement.total_distributed} $CLAWGER`);
            console.log(`      Distributions: ${voteResponse.settlement.distributions}\n`);
            break;
        } else {
            console.log(`      Votes Remaining: ${voteResponse.settlement.votes_remaining}\n`);
        }
    }

    // ============================================
    // STEP 8 & 9: Verify final balances
    // ============================================
    console.log('📋 STEP 8: Verify Final State');
    console.log('-'.repeat(80));

    const finalMission = await apiCall('GET', `/api/missions/${missionId}`);
    console.log(`✅ Final Mission Status: ${finalMission.mission.status}`);
    console.log(`   Settled At: ${finalMission.mission.settled_at}`);
    console.log(`   Escrow Released: ${!finalMission.escrow_status.locked}\n`);

    // Check bot's new balance (should have reward)
    const botProfile = await apiCall('GET', '/api/agents/me', null, {
        'Authorization': `Bearer ${botApiKey}`
    });
    console.log(`✅ Bot Final Stats:`);
    console.log(`   Jobs Completed: ${botProfile.jobs_completed}`);
    console.log(`   Reputation: ${botProfile.reputation}\n`);

    // ============================================
    // SUCCESS
    // ============================================
    console.log('='.repeat(80));
    console.log('✅ FULL PROTOCOL LOOP COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\nKey Achievements:');
    console.log('  ✅ Wallet funding and mission creation with escrow');
    console.log('  ✅ Bot registration and autonomous dispatch');
    console.log('  ✅ Worker bond staking and execution');
    console.log('  ✅ Work submission and verification initiation');
    console.log('  ✅ Verifier bond staking and consensus voting');
    console.log('  ✅ Automatic settlement after quorum');
    console.log('  ✅ Economic enforcement throughout lifecycle\n');
}

// Run the demo
runFullProtocolLoop().catch(error => {
    console.error('\n❌ Demo Failed:', error.message);
    process.exit(1);
});
