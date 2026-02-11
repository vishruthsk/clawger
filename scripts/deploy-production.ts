import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying CLAWGER V4 Production Contracts...");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "MON\n");

    // Configuration
    const CLGR_TOKEN = process.env.CLGR_TOKEN_ADDRESS || "0x1F81fBE23B357B84a065Eb28988dBF087815c7777";
    const CLAWGER_WALLET = process.env.CLAWGER_WALLET || deployer.address;

    console.log("Configuration:");
    console.log("- CLGR Token:", CLGR_TOKEN);
    console.log("- CLAWGER Wallet:", CLAWGER_WALLET);
    console.log("");

    // 1. Deploy AgentRegistryV3
    console.log("1/3 Deploying AgentRegistryV3...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistryV3");
    const registry = await AgentRegistry.deploy(deployer.address); // Temporary manager
    await registry.deployed();
    console.log("✅ AgentRegistryV3 deployed:", registry.address);

    // 2. Deploy ClawgerManagerV4
    console.log("\n2/3 Deploying ClawgerManagerV4...");
    const ClawgerManager = await ethers.getContractFactory("ClawgerManagerV4");
    const manager = await ClawgerManager.deploy(
        CLGR_TOKEN,
        registry.address,
        CLAWGER_WALLET
    );
    await manager.deployed();
    console.log("✅ ClawgerManagerV4 deployed:", manager.address);

    // 3. Update registry manager
    console.log("\n3/3 Setting manager in registry...");
    const tx1 = await registry.proposeManager(manager.address);
    await tx1.wait();
    console.log("✅ Manager proposed");

    // Note: In production, this would be a 2-step process
    // For now, deployer accepts as they are the temporary manager
    const tx2 = await registry.acceptManagerRole();
    await tx2.wait();
    console.log("✅ Manager accepted");

    // Verification
    console.log("\n=== VERIFICATION ===");
    const registryManager = await registry.manager();
    const managerRegistry = await manager.registry();
    const managerCLGR = await manager.CLGR();
    const managerClawger = await manager.clawger();
    const managerOwner = await manager.owner();

    console.log("Registry manager:", registryManager);
    console.log("Manager registry:", managerRegistry);
    console.log("Manager CLGR:", managerCLGR);
    console.log("Manager clawger:", managerClawger);
    console.log("Manager owner:", managerOwner);

    const allCorrect =
        registryManager === manager.address &&
        managerRegistry === registry.address &&
        managerCLGR === CLGR_TOKEN &&
        managerClawger === CLAWGER_WALLET &&
        managerOwner === deployer.address;

    if (allCorrect) {
        console.log("\n✅ ALL VERIFICATIONS PASSED");
    } else {
        console.log("\n❌ VERIFICATION FAILED");
        process.exit(1);
    }

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
        network: "monad",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            AgentRegistryV3: registry.address,
            ClawgerManagerV4: manager.address,
        },
        config: {
            CLGR_TOKEN,
            CLAWGER_WALLET,
        },
    };

    const deploymentPath = "./deployments/production_monad.json";
    fs.mkdirSync("./deployments", { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✅ Deployment info saved:", deploymentPath);

    // Update .env instructions
    console.log("\n=== UPDATE YOUR .env ===");
    console.log(`AGENT_REGISTRY_V3_ADDRESS=${registry.address}`);
    console.log(`CLAWGER_MANAGER_V4_ADDRESS=${manager.address}`);

    console.log("\n=== NEXT STEPS ===");
    console.log("1. Update .env with addresses above");
    console.log("2. Verify contracts on block explorer");
    console.log("3. Test with small amounts first");
    console.log("4. Monitor events and transactions");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
