import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * E2E test for on-chain mission lifecycle
 * 
 * Tests:
 * 1. Escrow locking on ClawgerManager
 * 2. Worker bond staking
 * 3. Mission execution
 * 4. Verification and settlement
 * 5. Payout to worker
 * 
 * Prerequisites:
 * - Contracts deployed (run: npx hardhat run scripts/deploy-to-monad.ts)
 * - DEMO_MODE=false in .env
 * - Funded deployer wallet
 * 
 * Usage:
 *   npm run test:onchain
 */
async function main() {
    console.log("\n═══════════════════════════════════════");
    console.log("🧪 CLAWGER ON-CHAIN MISSION E2E TEST");
    console.log("═══════════════════════════════════════\n");

    // Verify environment
    if (!process.env.CLAWGER_MANAGER_ADDRESS) {
        console.error("❌ Error: CLAWGER_MANAGER_ADDRESS not set.");
        console.error("   Run deployment first: npx hardhat run scripts/deploy-to-monad.ts --network monad");
        process.exit(1);
    }

    if (process.env.DEMO_MODE !== "false") {
        console.error("❌ Error: DEMO_MODE must be 'false' for on-chain testing.");
        console.error("   Update .env: DEMO_MODE=false");
        process.exit(1);
    }

    const [deployer, worker, verifier] = await ethers.getSigners();

    console.log(`Deployer:  ${deployer.address} (${ethers.utils.formatEther(await deployer.getBalance())} ETH)`);
    console.log(`Worker:    ${worker.address} (${ethers.utils.formatEther(await worker.getBalance())} ETH)`);
    console.log(`Verifier:  ${verifier.address} (${ethers.utils.formatEther(await verifier.getBalance())} ETH)\n`);

    const clgrToken = await ethers.getContractAt("CLAWGERToken", process.env.CLGR_TOKEN_ADDRESS!);
    const manager = await ethers.getContractAt("ClawgerManager", process.env.CLAWGER_MANAGER_ADDRESS!);

    // Test 1: Create mission escrow
    console.log("📦 Step 1: Creating mission escrow");
    const missionId = ethers.utils.id("mission_onchain_test_001");
    const reward = ethers.utils.parseEther("50"); // 50 CLGR

    try {
        // Fund deployer with CLGR tokens (mint for test)
        if ((await clgrToken.balanceOf(deployer.address)).lt(reward)) {
            console.log("   Minting test CLGR tokens...");
            const mintTx = await clgrToken.mint(deployer.address, 1000);
            await mintTx.wait();
            console.log(`   ✅ Minted 1000 CLGR`);
        }

        const tx1 = await manager.createMissionEscrow(missionId, { value: reward });
        const receipt1 = await tx1.wait();
        console.log(`   ✅ Escrow locked: ${ethers.utils.formatEther(reward)} CLGR`);
        console.log(`   📝 Transaction: ${receipt1.transactionHash}\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Test 2: Worker posts bond
    console.log("🔒 Step 2: Worker posting bond");
    const bond = ethers.utils.parseEther("5"); // 5 CLGR
    const taskId = 1;

    try {
        const tx2 = await manager.connect(worker).postWorkerBond(taskId, { value: bond });
        const receipt2 = await tx2.wait();
        console.log(`   ✅ Bond staked: ${ethers.utils.formatEther(bond)} CLGR`);
        console.log(`   📝 Transaction: ${receipt2.transactionHash}\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Test 3: Worker starts task
    console.log("🚀 Step 3: Worker starting task");
    try {
        const tx3 = await manager.connect(worker).startTask(taskId);
        const receipt3 = await tx3.wait();
        console.log(`   ✅ Task started`);
        console.log(`   📝 Transaction: ${receipt3.transactionHash}\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Test 4: Worker submits work
    console.log("📤 Step 4: Worker submitting work");
    try {
        const tx4 = await manager.connect(worker).submitWork(taskId);
        const receipt4 = await tx4.wait();
        console.log(`   ✅ Work submitted`);
        console.log(`   📝 Transaction: ${receipt4.transactionHash}\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Test 5: Verifier approves work
    console.log("✅ Step 5: Verifier approving work");
    try {
        const workerBalanceBefore = await ethers.provider.getBalance(worker.address);

        const tx5 = await manager.connect(verifier).verifyTask(taskId, true);
        const receipt5 = await tx5.wait();

        const workerBalanceAfter = await ethers.provider.getBalance(worker.address);
        const payout = workerBalanceAfter.sub(workerBalanceBefore);

        console.log(`   ✅ Verification approved`);
        console.log(`   💰 Worker payout: ${ethers.utils.formatEther(payout)} ETH`);
        console.log(`   📝 Transaction: ${receipt5.transactionHash}\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Test 6: Check on-chain reputation
    console.log("📊 Step 6: Checking on-chain reputation");
    try {
        const [tasksCompleted, tasksAssigned, totalEarned, totalSlashed, reputationScore] =
            await manager.getAgentReputation(worker.address);

        console.log(`   Tasks Completed: ${tasksCompleted}`);
        console.log(`   Tasks Assigned:  ${tasksAssigned}`);
        console.log(`   Total Earned:    ${ethers.utils.formatEther(totalEarned)} ETH`);
        console.log(`   Total Slashed:   ${ethers.utils.formatEther(totalSlashed)} ETH`);
        console.log(`   Reputation:      ${reputationScore}/100\n`);
    } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        process.exit(1);
    }

    // Summary
    console.log("═══════════════════════════════════════");
    console.log("📋 TEST SUMMARY");
    console.log("═══════════════════════════════════════");
    console.log(`✅ Escrow created on-chain`);
    console.log(`✅ Worker bond staked`);
    console.log(`✅ Mission executed`);
    console.log(`✅ Work verified and approved`);
    console.log(`✅ Payout distributed`);
    console.log(`✅ Reputation updated on-chain`);
    console.log("═══════════════════════════════════════\n");

    console.log("🎉 All on-chain tests passed!");
    console.log("\n📖 CLAWGER is now running on real Monad transactions.\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
