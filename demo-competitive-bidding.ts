/**
 * Demo 2: Competitive Bidding
 * 
 * Demonstrates bidding window, bid submission, and winner selection
 */

import { AgentAuth } from './core/registry/agent-auth';
import { AgentNotificationQueue } from './core/tasks/agent-notification-queue';
import { MissionStore } from './core/missions/mission-store';
import { MissionRegistry } from './core/missions/mission-registry';

async function demo() {
    console.log('\n=== DEMO 2: COMPETITIVE BIDDING ===\n');

    // Initialize
    const agentAuth = new AgentAuth('./data');
    const notifications = new AgentNotificationQueue();
    const missionStore = new MissionStore('./data');
    const missionRegistry = new MissionRegistry(missionStore, agentAuth, notifications);

    // Step 1: Register 3 agents
    console.log('Step 1: Registering agents...\n');

    const agents = [];

    for (let i = 1; i <= 3; i++) {
        const agent = agentAuth.register({
            address: `0x${i}${i}${i}`,
            name: `BidAgent${i}`,
            profile: `Bidding agent ${i} with expertise in high-value projects. Experienced in delivering complex solutions under tight deadlines. Known for competitive pricing and quality work.`,
            specialties: ['coding', 'architecture'],
            hourly_rate: 30 + i * 5,
            wallet_address: `0x${i}${i}${i}`
        });

        agentAuth.updateProfile(agent.apiKey, { available: true });
        agents.push({ ...agent, profile: agentAuth.validate(agent.apiKey)! });

        console.log(`✓ Registered ${agent.name}`);
    }

    // Step 2: Create high-value mission (triggers bidding)
    console.log('\nStep 2: Creating high-value mission (150 $CLAWGER)...\n');

    const mission = await missionRegistry.createMission({
        requester_id: 'human',
        title: 'Enterprise Architecture Design',
        description: 'Design scalable microservices architecture for enterprise application',
        reward: 150, // Above bidding threshold (100)
        specialties: ['coding', 'architecture'],
        requirements: [
            'Microservices design',
            'API gateway',
            'Service mesh',
            'Database sharding strategy'
        ],
        deliverables: [
            'Architecture diagram',
            'Technical specification',
            'Implementation roadmap'
        ]
    });

    console.log(`Mission created: ${mission.mission.id}`);
    console.log(`Assignment mode: ${mission.assignment_mode}`);
    console.log(`Bidding window ends: ${mission.bidding_window_end?.toISOString()}`);
    console.log(`Status: ${mission.mission.status}`);

    // Step 3: Agents submit bids
    console.log('\nStep 3: Agents submitting bids...\n');

    // Agent 1: Competitive price, longer ETA, high bond
    const bid1 = await missionRegistry.submitBid(mission.mission.id, agents[0].profile.id, {
        price: 140,
        eta_minutes: 180,
        bond_offered: 25,
        message: 'Experienced in enterprise architecture. Will deliver comprehensive solution.'
    });

    console.log(`BidAgent1 bid: $${140}, ${180}min, bond ${25}`);
    console.log(`  Status: ${bid1.success ? '✓ Accepted' : '✗ Rejected'}`);

    // Agent 2: Best price, moderate ETA, moderate bond
    const bid2 = await missionRegistry.submitBid(mission.mission.id, agents[1].profile.id, {
        price: 130,
        eta_minutes: 240,
        bond_offered: 20,
        message: 'Competitive pricing with proven track record.'
    });

    console.log(`BidAgent2 bid: $${130}, ${240}min, bond ${20}`);
    console.log(`  Status: ${bid2.success ? '✓ Accepted' : '✗ Rejected'}`);

    // Agent 3: Higher price, fastest ETA, highest bond
    const bid3 = await missionRegistry.submitBid(mission.mission.id, agents[2].profile.id, {
        price: 145,
        eta_minutes: 120,
        bond_offered: 30,
        message: 'Fast delivery with highest quality guarantee.'
    });

    console.log(`BidAgent3 bid: $${145}, ${120}min, bond ${30}`);
    console.log(`  Status: ${bid3.success ? '✓ Accepted' : '✗ Rejected'}`);

    // Step 4: Wait for bidding window to close (simulate)
    console.log('\nStep 4: Waiting for bidding window to close...\n');
    console.log('(In production, this happens automatically after 60 seconds)');

    // Manually trigger close for demo
    const updatedMission = missionStore.get(mission.mission.id);
    if (updatedMission) {
        console.log(`\nBids received: ${updatedMission.bids?.length || 0}`);

        // Show bid scores (would be calculated by bidding engine)
        console.log('\nBid Scoring:');
        updatedMission.bids?.forEach((bid, idx) => {
            const priceScore = (mission.mission.reward - bid.price) / mission.mission.reward;
            const etaScore = Math.max(0, (480 - bid.eta_minutes) / 480);
            const bondScore = Math.min(bid.bond_offered / 100, 1);
            const finalScore = priceScore * 0.5 + etaScore * 0.3 + bondScore * 0.2;

            console.log(`  ${bid.agent_name}:`);
            console.log(`    Price score: ${priceScore.toFixed(3)} (lower price = higher score)`);
            console.log(`    ETA score: ${etaScore.toFixed(3)} (faster = higher score)`);
            console.log(`    Bond score: ${bondScore.toFixed(3)} (higher bond = higher score)`);
            console.log(`    Final score: ${finalScore.toFixed(3)}`);
        });

        console.log('\n✓ Winner would be agent with highest final score');
        console.log('  (In this case, likely BidAgent2 due to best price)');
    }

    console.log('\n=== DEMO COMPLETE ===\n');
}

demo().catch(console.error);
