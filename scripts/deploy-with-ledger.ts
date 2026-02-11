import { ethers } from "hardhat";
import LedgerSigner from "@ledgerhq/hw-app-eth";
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy CLAWGER contracts using Ledger hardware wallet
 * 
 * IMPORTANT: Before running, ensure:
 * 1. Ledger device connected and unlocked
 * 2. Ethereum app opened
 * 3. "Contract data" enabled in Ethereum app settings
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-with-ledger.ts --network monad
 */
async function main() {
    console.log("\n🔐 CLAWGER Contract Deployment (Ledger Mode)\n");

    // Connect to Ledger
    console.log("Connecting to Ledger device...");
    const transport = await TransportNodeHid.create();
    const eth = new LedgerSigner(transport);

    // Get Ledger address (derivation path: m/44'/60'/0'/0/0)
    const derivationPath = "m/44'/60'/0'/0/0";
    const { address } = await eth.getAddress(derivationPath);
    console.log(`Ledger address: ${address}`);

    // Check balance
    const balance = await ethers.provider.getBalance(address);
    console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH\n`);

    if (balance.isZero()) {
        console.error("❌ Error: Ledger address has zero balance. Fund the address first.");
        process.exit(1);
    }

    // Create Ledger signer
    const ledgerSigner = await ethers.getSigner(address);

    // CLGR Token is already deployed
    const CLGR_TOKEN_ADDRESS = process.env.CLGR_TOKEN_ADDRESS || "0x1F81fBE23B357B84a065Eb28988dBF087815c7777";
    console.log(`✅ CLGR Token (existing): ${CLGR_TOKEN_ADDRESS}\n`);

    // Deploy ClawgerManager
    console.log("📝 Deploying ClawgerManager...");
    console.log("⏳ Please confirm on Ledger device...");

    const ClawgerManager = await ethers.getContractFactory("ClawgerManager", ledgerSigner);
    const manager = await ClawgerManager.deploy(address);
    await manager.deployed();

    console.log(`✅ ClawgerManager deployed: ${manager.address}`);
    console.log(`   Transaction: ${manager.deployTransaction.hash}\n`);

    // Deploy AgentRegistry
    console.log("📝 Deploying AgentRegistry...");
    console.log("⏳ Please confirm on Ledger device...");

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry", ledgerSigner);
    const registry = await AgentRegistry.deploy();
    await registry.deployed();

    console.log(`✅ AgentRegistry deployed: ${registry.address}`);
    console.log(`   Transaction: ${registry.deployTransaction.hash}\n`);

    // Close Ledger connection
    await transport.close();

    // Save deployment addresses
    const deploymentInfo = {
        network: "monad",
        timestamp: new Date().toISOString(),
        deployer: address,
        deploymentMethod: "Ledger",
        derivationPath,
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

    const deploymentFile = path.join(deploymentsDir, "monad-ledger.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📄 Deployment info saved: ${deploymentFile}\n`);

    // Update .env file
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

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
    console.log(`Method:           Ledger (${derivationPath})`);
    console.log(`Deployer:         ${address}`);
    console.log(`CLGR Token:       ${CLGR_TOKEN_ADDRESS}`);
    console.log(`ClawgerManager:   ${manager.address}`);
    console.log(`AgentRegistry:    ${registry.address}`);
    console.log("═══════════════════════════════════════\n");

    console.log("🎉 Deployment complete!");
    console.log("\n📖 Next steps:");
    console.log("  1. Verify contracts on block explorer");
    console.log("  2. Set DEMO_MODE=false in .env");
    console.log("  3. Run: npm run test:onchain\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
