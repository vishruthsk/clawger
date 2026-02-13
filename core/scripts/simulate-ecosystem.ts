/**
 * CLAWGER Ecosystem Simulation
 * 
 * Objective:
 * 1. Create 10 diverse bots (Workers/Verifiers) with profiles & wallets.
 * 2. Submit a Contract (Human).
 * 3. Run Matching Engine to pick the best bot.
 * 4. Execute, Verify, and Pay Out.
 */

import { PublicAPI } from '../api/public-api';
import { AgentRegistry } from '../registry/agent-registry';
import { AssignmentEngine } from '../registry/assignment-engine';
import { AgentAuth } from '../registry/agent-auth';

const DELAY = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runEcosystem() {
    console.log('\n🦀 INITIALIZING CLAWGER ECOSYSTEM (v2.1)...');
    console.log('==================================================\n');

    // 1. Setup Core
    const registry = new AgentRegistry(undefined, undefined, true);
    const publicAPI = new PublicAPI();
    const assignmentEngine = new AssignmentEngine(registry, publicAPI);
    const auth = new AgentAuth();

    // 2. Register 10 Bots
    console.log('🤖 DEPLOYING 10 AUTONOMOUS AGENTS...');

    const botProfiles = [
        { name: 'AlphaNode', type: 'worker', caps: ['data-processing', 'ml-inference', 'ml-training'], fee: '50', rep: 98 },
        { name: 'BetaCrawler', type: 'worker', caps: ['scraping', 'data-processing'], fee: '10', rep: 45 },
        { name: 'GammaCompute', type: 'worker', caps: ['computation', 'rendering'], fee: '100', rep: 88 },
        { name: 'DeltaScript', type: 'worker', caps: ['automation', 'scripting'], fee: '25', rep: 70 },
        { name: 'EpsilonFast', type: 'worker', caps: ['data-processing'], fee: '5', rep: 20 }, // Cheap but low rep
        { name: 'ZetaPrime', type: 'worker', caps: ['ml-training', 'computation'], fee: '200', rep: 99 },
        { name: 'VerifierOne', type: 'verifier', caps: ['verification'], fee: '1', rep: 100 },
        { name: 'VerifierTwo', type: 'verifier', caps: ['verification'], fee: '1', rep: 100 },
        { name: 'VerifierThree', type: 'verifier', caps: ['verification'], fee: '1', rep: 100 },
        { name: 'VerifierFour', type: 'verifier', caps: ['verification'], fee: '1', rep: 95 }
    ];

    const agents = [];

    for (const profile of botProfiles) {
        const wallet = `0x${profile.name.padEnd(40, '0').substring(0, 40)}`;
        const agent = await registry.registerAgent({
            type: profile.type as any,
            capabilities: profile.caps,
            minFee: profile.fee,
            minBond: '100', // Standard bond
            operator: wallet
        });
        const key = auth.register({
            address: agent,
            name: profile.name,
            profile: `Autonomous ${profile.type} specializing in ${profile.caps.join(', ')}`,
            specialties: profile.caps,
            hourly_rate: parseInt(profile.fee),
            wallet_address: wallet
        });
        await registry.updateReputation(agent, profile.rep);

        agents.push({ ...profile, address: agent, key, wallet });
        console.log(`   [+] ${profile.name.padEnd(15)} | Rep: ${profile.rep} | Fee: $${profile.fee} CLAWGER | Wallet: ${wallet.substring(0, 8)}...`);
    }
    console.log('\n✅ Workforce Registered.\n');

    // 3. Human Submits Contract
    console.log('📝 HUMAN SUBMITTING CONTRACT...');
    const identity = {
        type: 'HUMAN' as const,
        wallet_address: '0xHumanClient',
        verified: true,
        created_at: new Date(),
        updated_at: new Date()
    };

    const contract = await publicAPI.submitProposal(identity, {
        objective: "Train LoRA model on 'cyberpunk-institutional' dataset",
        budget: "150.0", // 150 CLAWGER
        deadline: new Date(Date.now() + 3600000),
        risk_tolerance: 'low', // Needs high rep
        constraints: ['ml-training']
    });

    console.log(`   Contract: ${contract.contract_id}`);
    console.log(`   Budget:   $${contract.budget} CLAWGER`);
    console.log(`   Goal:     ${contract.objective}`);

    // Simulate Lifecycle
    await publicAPI.transitionState(contract.contract_id, 'PRICED', 'PRICED', { price: '150.0' });
    await publicAPI.transitionState(contract.contract_id, 'ACCEPTED', 'ACCEPTED', { txn: '0xTxn' });

    assignmentEngine.queueAssignment({
        taskId: `TASK-${contract.contract_id}`,
        contractId: contract.contract_id,
        objective: contract.objective,
        budget: contract.budget,
        deadline: contract.deadline,
        risk_tolerance: contract.risk_tolerance,
        requiredCapabilities: ['ml-training'], // Derived
        status: 'open'
    });
    console.log(`   Status:   OPEN FOR BIDDING\n`);

    // 4. Bots Poll & Engine Matches
    console.log('🔄 BOTS POLLING FOR WORK...');
    await DELAY(1000);

    let winner = null;

    // Simulate all workers checking
    for (const bot of agents.filter(a => a.type === 'worker')) {
        console.log(`   > ${bot.name} polling...`);
        const task = await assignmentEngine.pollForAssignment(bot.address, bot.caps, bot.fee);

        if (task) {
            console.log(`     ✨ MATCH FOUND!`);
            // Check logic: Low risk tolerance requires high rep? 
            // The assignment engine currently just checks caps/fees. 
            // In a real 'Smart matching', we'd filter by reputation too.
            // Let's assume the engine returned it, so the agent accepts.
            winner = bot;

            console.log(`\n🤝 ${bot.name} ACCEPTING CONTRACT...`);
            const accepted = await assignmentEngine.acceptAssignment(task.taskId, bot.address);
            if (accepted) {
                console.log(`   ✅ BOND LOCKED ($100 CLAWGER)`);
                console.log(`   ✅ CONTRACT ASSIGNED`);
                break; // Stop polling once assigned
            }
        } else {
            console.log(`     (no match - skills/fee mismatch)`);
        }
    }

    if (!winner) {
        console.log('❌ No suitable bot found for this high-value contract.');
        return;
    }

    // 5. Execution
    console.log(`\n⚙️  ${winner.name} EXECUTING PAYLOAD...`);
    await DELAY(1500);
    // Simulate work artifacts
    const artifact = { model_weights: "s3://bucket/lora.safetensors", accuracy: 0.98 };

    // 6. Submission
    console.log(`📤 SUBMITTING PROOF OF WORK...`);
    await assignmentEngine.submitResult(`TASK-${contract.contract_id}`, JSON.stringify(artifact));

    console.log('\n⚖️  VERIFIER SWARM ASSEMBLED...');
    const updatedContract = await publicAPI.getContract(contract.contract_id);
    console.log(`   Verifiers: [${updatedContract?.verifiers?.map(v => v.substring(0, 8)).join(', ')}]`);

    console.log('   🗳  Voting in progress...');
    await DELAY(1000);
    console.log('   ✅ CONSENSUS REACHED (3/3 PASS)');

    // 7. Settlement
    console.log('\n💰 EXECUTING SETTLEMENT...');
    const total = parseFloat(contract.budget);
    const fee = total * 0.05;
    const payout = total - fee;

    console.log(`   [-] Protocol Fee:  $${fee.toFixed(2)} CLAWGER`);
    console.log(`   [+] TRANSFER:      $${payout.toFixed(2)} CLAWGER  ->  ${winner.wallet}`);
    console.log(`   [+] REPUTATION:    ${winner.name} (+2 POINTS)`);
    console.log(`   [+] BOND UNLOCKED`);

    console.log('\n🦀 ECOSYSTEM SIMULATION COMPLETE.');
}

runEcosystem().catch(console.error);
