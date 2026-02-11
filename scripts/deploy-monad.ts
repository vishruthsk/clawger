/**
 * Monad Deployment Script
 * 
 * Deploys CLAWGER contracts to Monad in the correct order and wires them together.
 * 
 * Deployment order:
 * 1. CLGR Token (ERC20)
 * 2. AgentRegistry
 * 3. ClawgerManager
 * 4. Wire Registry → Manager
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-monad.ts --network monad
 * 
 * IMPORTANT: Ensure .env has MONAD_PRIVATE_KEY and MONAD_RPC_URL set
 */

import { ethers } from "hardhat";

async function main() {
    console.log("\n🚀 CLAWGER Monad Deployment Script\n");
    console.log("=".repeat(60));

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:   ", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:    ", ethers.formatEther(balance), "MON");
    console.log("=".repeat(60) + "\n");

    if (balance === 0n) {
        console.error("❌ Deployer has no MON for gas fees!");
        process.exit(1);
    }

    // Get CLAWGER operator address from env or use deployer
    const clawgerOperator = process.env.CLAWGER_OPERATOR || deployer.address;
    console.log(`CLAWGER Operator: ${clawgerOperator}\n`);

    let clgrAddress: string;
    let registryAddress: string;
    let managerAddress: string;

    // Step 1: Deploy CLGR Token
    console.log("📝 Step 1: Deploying CLGR Token...");
    try {
        const CLGRFactory = await ethers.getContractFactory("ERC20Mock");
        const clgr = await CLGRFactory.deploy(
            "CLAWGER Token",
            "CLGR",
            ethers.parseEther("10000000") // 10M initial supply
        );
        await clgr.waitForDeployment();
        clgrAddress = await clgr.getAddress();
        console.log(`   ✅ CLGR Token deployed: ${clgrAddress}\n`);
    } catch (error: any) {
        console.error("❌ Failed to deploy CLGR Token:");
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }

    // Step 2: Deploy AgentRegistry
    console.log("📝 Step 2: Deploying AgentRegistry...");
    try {
        const RegistryFactory = await ethers.getContractFactory("AgentRegistryV3");
        const registry = await RegistryFactory.deploy(deployer.address); // Temporary manager
        await registry.waitForDeployment();
        registryAddress = await registry.getAddress();
        console.log(`   ✅ AgentRegistry deployed: ${registryAddress}\n`);
    } catch (error: any) {
        console.error("❌ Failed to deploy AgentRegistry:");
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }

    // Step 3: Deploy ClawgerManager
    console.log("📝 Step 3: Deploying ClawgerManager...");
    try {
        const ManagerFactory = await ethers.getContractFactory("ClawgerManagerV4");
        const manager = await ManagerFactory.deploy(
            clgrAddress,
            registryAddress,
            clawgerOperator
        );
        await manager.waitForDeployment();
        managerAddress = await manager.getAddress();
        console.log(`   ✅ ClawgerManager deployed: ${managerAddress}\n`);
    } catch (error: any) {
        console.error("❌ Failed to deploy ClawgerManager:");
        console.error(`   ${error.message}\n`);
        process.exit(1);
    }

    // Step 4: Wire Registry → Manager
    console.log("📝 Step 4: Wiring Registry → Manager...");
    try {
        const registry = await ethers.getContractAt("AgentRegistryV3", registryAddress);

        // Propose manager
        const tx1 = await registry.proposeManager(managerAddress);
        console.log(`   Proposing manager... (tx: ${tx1.hash})`);
        await tx1.wait();

        // Accept manager role (called by deployer who is the pending manager)
        const tx2 = await registry.acceptManagerRole();
        console.log(`   Accepting manager role... (tx: ${tx2.hash})`);
        await tx2.wait();

        console.log(`   ✅ Registry wired to Manager\n`);
    } catch (error: any) {
        console.error("❌ Failed to wire Registry → Manager:");
        console.error(`   ${error.message}`);
        console.error("   You may need to run wire-registry-manager.ts manually\n");
    }

    // Verification
    console.log("🔍 Verifying deployment...\n");

    const registry = await ethers.getContractAt("AgentRegistryV3", registryAddress);
    const manager = await ethers.getContractAt("ClawgerManagerV4", managerAddress);

    const registryManager = await registry.manager();
    const managerRegistry = await manager.registry();
    const managerCLGR = await manager.CLGR();
    const managerClawger = await manager.clawger();

    console.log("Verification:");
    console.log(`  Registry.manager() == Manager:  ${registryManager === managerAddress ? "✅" : "❌"}`);
    console.log(`  Manager.registry() == Registry: ${managerRegistry === registryAddress ? "✅" : "❌"}`);
    console.log(`  Manager.CLGR() == CLGR:         ${managerCLGR === clgrAddress ? "✅" : "❌"}`);
    console.log(`  Manager.clawger() == Operator:  ${managerClawger === clawgerOperator ? "✅" : "❌"}\n`);

    // Print summary
    console.log("=".repeat(60));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log("\nDeployed Addresses:");
    console.log(`  CLGR Token:       ${clgrAddress}`);
    console.log(`  AgentRegistry:    ${registryAddress}`);
    console.log(`  ClawgerManager:   ${managerAddress}`);
    console.log(`  CLAWGER Operator: ${clawgerOperator}`);
    console.log("\nAdd to .env:");
    console.log(`MONAD_CLGR_TOKEN=${clgrAddress}`);
    console.log(`MONAD_AGENT_REGISTRY=${registryAddress}`);
    console.log(`MONAD_CLAWGER_MANAGER=${managerAddress}`);
    console.log(`MONAD_CLAWGER_OPERATOR=${clawgerOperator}`);
    console.log("\n" + "=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
