import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy CLAWGER core contracts to Monad
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-to-monad.ts --network monad
 * 
 * For Ledger deployment, see: docs/ledger-deploy.md
 */
async function main() {
    console.log("\n🚀 CLAWGER Contract Deployment to Monad\n");

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying from: ${deployer.address}`);
    console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`);

    // CLGR Token is already deployed
    const CLGR_TOKEN_ADDRESS = process.env.CLGR_TOKEN_ADDRESS || "0x1F81fBE23B357B84a065Eb28988dBF087815c7777";
    console.log(`✅ CLGR Token (existing): ${CLGR_TOKEN_ADDRESS}\n`);

    // Deploy ClawgerManager
    console.log("📝 Deploying ClawgerManager...");
    const ClawgerManager = await ethers.getContractFactory("ClawgerManager");
    const manager = await ClawgerManager.deploy(deployer.address);
    await manager.deployed();
    console.log(`✅ ClawgerManager deployed: ${manager.address}`);
    console.log(`   Transaction: ${manager.deployTransaction.hash}\n`);

    // Deploy AgentRegistry (if needed)
    console.log("📝 Deploying AgentRegistry...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.deployed();
    console.log(`✅ AgentRegistry deployed: ${registry.address}`);
    console.log(`   Transaction: ${registry.deployTransaction.hash}\n`);

    // Save deployment addresses
    const deploymentInfo = {
        network: "monad",
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            CLGRToken: CLGR_TOKEN_ADDRESS,
            ClawgerManager: manager.address,
            AgentRegistry: registry.address,
        },
        transactions: {
            ClawgerManager: manager.deployTransaction.hash,
            AgentRegistry: registry.deployTransaction.hash,
        },
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, "monad.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

    // Update .env file
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

    // Add or update contract addresses
    const updates = {
        CLGR_TOKEN_ADDRESS: CLGR_TOKEN_ADDRESS,
        CLAWGER_MANAGER_ADDRESS: manager.address,
        AGENT_REGISTRY_ADDRESS: registry.address,
    };

    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(envPath, envContent);
    console.log("✅ .env updated with contract addresses\n");

    // Summary
    console.log("═══════════════════════════════════════");
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("═══════════════════════════════════════");
    console.log(`Network:          Monad`);
    console.log(`CLGR Token:       ${CLGR_TOKEN_ADDRESS}`);
    console.log(`ClawgerManager:   ${manager.address}`);
    console.log(`AgentRegistry:    ${registry.address}`);
    console.log("═══════════════════════════════════════\n");

    console.log("🎉 Deployment complete!");
    console.log("\n📖 Next steps:");
    console.log("  1. Verify contracts on block explorer");
    console.log("  2. Set DEMO_MODE=false in .env for production");
    console.log("  3. Run: npm run test:onchain\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
