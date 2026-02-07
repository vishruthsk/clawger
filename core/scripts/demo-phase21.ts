
/**
 * Phase 21 Demo: Assignment & Execution Loop
 * 
 * Simulates the full lifecycle:
 * 1. User submits Proposal
 * 2. AssignmentEngine queues it
 * 3. Worker polls and accepts it
 * 4. Worker executes and submits result
 * 5. Verifiers vote
 * 6. Contract completes
 */

import { PublicAPI } from '../api/public-api';
import { AgentRegistry } from '../registry/agent-registry';
import { AssignmentEngine } from '../registry/assignment-engine';
import { AgentAuth } from '../registry/agent-auth';

async function runDemo() {
    console.log('🚀 Starting Phase 21 Demo: The Engine\n');

    // 1. Setup Core System
    const registry = new AgentRegistry(undefined, undefined, true);
    const publicAPI = new PublicAPI();
    const assignmentEngine = new AssignmentEngine(registry, publicAPI);
    const auth = new AgentAuth();

    // 2. Register Agents
    console.log('🤖 Registering Agents...');

    // Worker A (High Rep)
    const workerA = await registry.registerAgent({
        type: 'worker',
        capabilities: ['data-processing', 'computation'],
        minFee: '0.1',
        minBond: '1.0',
        operator: '0xWorkerA'
    });
    const keyA = auth.register(workerA);
    await registry.updateReputation(workerA, 95);
    console.log(`   Worker A: ${workerA} (Rep: 95)`);

    // Worker B (Low Rep)
    const workerB = await registry.registerAgent({
        type: 'worker',
        capabilities: ['data-processing'],
        minFee: '0.05',
        minBond: '0.5',
        operator: '0xWorkerB'
    });
    const keyB = auth.register(workerB);
    await registry.updateReputation(workerB, 50);
    console.log(`   Worker B: ${workerB} (Rep: 50)`);

    // Verifiers
    const v1 = await registry.registerAgent({ type: 'verifier', capabilities: ['verification'], minFee: '0.01', minBond: '0.1' });
    const v2 = await registry.registerAgent({ type: 'verifier', capabilities: ['verification'], minFee: '0.01', minBond: '0.1' });
    const v3 = await registry.registerAgent({ type: 'verifier', capabilities: ['verification'], minFee: '0.01', minBond: '0.1' });
    console.log(`   Verifiers Registered: 3\n`);

    // 3. User Submits Proposal
    console.log('📝 User Submitting Proposal...');
    const identity = {
        type: 'HUMAN' as const,
        wallet_address: '0xUser',
        verified: true,
        created_at: new Date(),
        updated_at: new Date()
    };
    const contract = await publicAPI.submitProposal(identity, {
        objective: "Analyze ETH price action for last 24h",
        budget: "10.0",
        deadline: new Date(Date.now() + 3600000), // 1 hour
        risk_tolerance: 'low',
        constraints: ['data-source:coingecko']
    });
    console.log(`   Contract Created: ${contract.contract_id} (State: ${contract.state})`);

    // 3.5 Simulate Pricing and Acceptance (Required for Lifecycle)
    console.log('💰 Simulating Pricing & Acceptance...');
    await publicAPI.transitionState(contract.contract_id, 'PRICED', 'PRICED', { price: '10.0' });
    await publicAPI.transitionState(contract.contract_id, 'ACCEPTED', 'ACCEPTED', { txn: '0xTxn' });
    console.log(`   Contract State: ACCEPTED`);

    // 4. Engine Queues Task
    // In real app, this happens via event listener or direct call. Here we simulate the hook.
    assignmentEngine.queueAssignment({
        taskId: `TASK-${contract.contract_id}`,
        contractId: contract.contract_id,
        objective: contract.objective,
        budget: contract.budget,
        deadline: contract.deadline,
        risk_tolerance: contract.risk_tolerance,
        requiredCapabilities: ['data-processing'], // Derived from objective
        status: 'open'
    });
    console.log(`   Task Queued in AssignmentEngine\n`);

    // 5. Worker Polling Simulation
    console.log('🔄 Workers Polling...');

    // Worker B checks (Low Rep, might be skipped if logic prioritized High Rep, but for now strict queue)
    // Actually our queue logic is deadline/budget based.
    const taskForB = await assignmentEngine.pollForAssignment(workerB, ['data-processing'], '0.05');
    console.log(`   Worker B Poll Result: ${taskForB ? 'MATCH' : 'NO MATCH'}`);

    // Worker A checks
    const taskForA = await assignmentEngine.pollForAssignment(workerA, ['data-processing', 'computation'], '0.1');
    console.log(`   Worker A Poll Result: ${taskForA ? 'MATCH' : 'NO MATCH'}`);

    if (!taskForA) {
        console.error('❌ Worker A should have matched!');
        return;
    }

    // 6. Worker Accepts
    console.log(`\n🤝 Worker A Accepting Task...`);
    const accepted = await assignmentEngine.acceptAssignment(taskForA.taskId, workerA);
    console.log(`   Acceptance: ${accepted ? 'SUCCESS' : 'FAILED'}`);

    const updatedContract = await publicAPI.getContract(contract.contract_id);
    console.log(`   Contract State: ${updatedContract?.state}`);
    console.log(`   Assigned Worker: ${updatedContract?.worker}`);
    console.log(`   Selected Verifiers: ${updatedContract?.verifiers?.length}`);

    // 7. Execution Simulation
    console.log(`\n⚙️  Worker A Executing...`);
    await new Promise(r => setTimeout(r, 1000));

    // 8. Submit Result
    console.log(`📤 Worker A Submitting Result...`);
    await assignmentEngine.submitResult(taskForA.taskId, "ETH Price: $3500. Trend: Bullish.");

    const verifContract = await publicAPI.getContract(contract.contract_id);
    console.log(`   Contract State: ${verifContract?.state}`);
    console.log(`   Result: ${verifContract?.work_result}`);

    console.log(`\n✅ Demo Complete!`);
}

runDemo().catch(console.error);
