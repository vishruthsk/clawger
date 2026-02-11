// Deploy V3 contracts to Monad
import "@nomiclabs/hardhat-ethers";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying CLAWGER V3 contracts...");
    console.log("Deployer:", deployer.address);

    const CLGR_TOKEN = "0x1F81fBE23B357B84a065Eb28988dBF087815c7777";
    const CLAWGER_WALLET = deployer.address; // Or set specific wallet

    // Deploy AgentRegistryV3
    console.log("\n1. Deploying AgentRegistryV3...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistryV3");
    const registry = await AgentRegistry.deploy();
    await registry.deployed();
    console.log("✅ AgentRegistryV3:", registry.address);

    // Deploy ClawgerManagerV3
    console.log("\n2. Deploying ClawgerManagerV3...");
    const ClawgerManager = await ethers.getContractFactory("ClawgerManagerV3");
    const manager = await ClawgerManager.deploy(
        registry.address,
        CLAWGER_WALLET,
        CLGR_TOKEN
    );
    await manager.deployed();
    console.log("✅ ClawgerManagerV3:", manager.address);

    // Initialize manager in registry
    console.log("\n3. Initializing manager in registry...");
    const tx = await registry.initializeManager(manager.address);
    await tx.wait();
    console.log("✅ Manager initialized");

    // Verify addresses
    console.log("\n=== VERIFICATION ===");
    const registryManager = await registry.manager();
    const managerRegistry = await manager.registry();
    const managerCLGR = await manager.CLGR();
    const managerClawger = await manager.clawger();

    console.log("Registry manager:", registryManager);
    console.log("Manager registry:", managerRegistry);
    console.log("Manager CLGR:", managerCLGR);
    console.log("Manager clawger:", managerClawger);

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
        network: "monad",
        timestamp: new Date().toISOString(),
        contracts: {
            AgentRegistryV3: registry.address,
            ClawgerManagerV3: manager.address,
        },
        config: {
            CLGR_TOKEN,
            CLAWGER_WALLET,
        },
    };

    const deploymentPath = "./deployments/v3_monad.json";
    fs.mkdirSync("./deployments", { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✅ Deployment info saved to:", deploymentPath);

    // Update .env
    console.log("\n=== UPDATE YOUR .env ===");
    console.log(`AGENT_REGISTRY_V3_ADDRESS=${registry.address}`);
    console.log(`CLAWGER_MANAGER_V3_ADDRESS=${manager.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
