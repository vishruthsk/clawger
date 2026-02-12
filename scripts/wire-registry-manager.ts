/**
 * Registry → Manager Wiring Script
 * 
 * This script wires the AgentRegistry to authorize ClawgerManager as the manager.
 * This is required for the Manager to update agent reputations.
 * 
 * Steps:
 * 1. Registry.proposeManager(managerAddress) - called by Registry owner
 * 2. Manager.acceptManagerRole() - called by the proposed manager
 * 
 * Usage:
 *   npx hardhat run scripts/wire-registry-manager.ts --network monad
 * 
 * IMPORTANT: This requires the deployer wallet (Registry owner) to have MON for gas
 */

import { ethers } from "hardhat";

// Deployed contract addresses on Monad
const MONAD_ADDRESSES = {
    AGENT_REGISTRY: "0x089D0b590321560c8Ec2Ece672Ef22462F79BC36",
    CLAWGER_MANAGER: "0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D",
};

async function main() {
    console.log("\n🔧 CLAWGER Registry → Manager Wiring Script\n");
    console.log("=".repeat(60));
    console.log("Registry:  ", MONAD_ADDRESSES.AGENT_REGISTRY);
    console.log("Manager:   ", MONAD_ADDRESSES.CLAWGER_MANAGER);
    console.log("=".repeat(60) + "\n");

    const [signer] = await ethers.getSigners();
    console.log(`Signer:     ${signer.address}`);

    const balance = await ethers.provider.getBalance(signer.address);
    console.log(`Balance:    ${ethers.formatEther(balance)} MON\n`);

    if (balance === 0n) {
        console.error("❌ Signer has no MON for gas fees!");
        process.exit(1);
    }

    // Get contract instances
    const registry = await ethers.getContractAt(
        "AgentRegistryV3",
        MONAD_ADDRESSES.AGENT_REGISTRY
    );

    // Check current state
    console.log("📋 Checking current state...\n");

    const currentManager = await registry.manager();
    const currentOwner = await registry.owner();
    const pendingManager = await registry.pendingManager();

    console.log(`Current manager:  ${currentManager}`);
    console.log(`Current owner:    ${currentOwner}`);
    console.log(`Pending manager:  ${pendingManager}\n`);

    // Verify signer is owner
    if (signer.address.toLowerCase() !== currentOwner.toLowerCase()) {
        console.error("❌ Signer is not the Registry owner!");
        console.error(`   Owner required: ${currentOwner}`);
        console.error(`   Current signer: ${signer.address}`);
        process.exit(1);
    }

    // Check if already wired
    if (currentManager.toLowerCase() === MONAD_ADDRESSES.CLAWGER_MANAGER.toLowerCase()) {
        console.log("✅ Registry is already wired to Manager!");
        console.log("   No action needed.\n");
        process.exit(0);
    }

    // Check if proposal already pending
    if (pendingManager.toLowerCase() === MONAD_ADDRESSES.CLAWGER_MANAGER.toLowerCase()) {
        console.log("⚠️  Manager proposal already pending!");
        console.log("   Skipping step 1, proceeding to acceptance...\n");
    } else {
        // Step 1: Propose manager
        console.log("📝 Step 1: Proposing manager...");
        console.log(`   Calling: registry.proposeManager(${MONAD_ADDRESSES.CLAWGER_MANAGER})\n`);

        try {
            const tx1 = await registry.proposeManager(MONAD_ADDRESSES.CLAWGER_MANAGER);
            console.log(`   Transaction hash: ${tx1.hash}`);
            console.log("   Waiting for confirmation...");

            const receipt1 = await tx1.wait();
            console.log(`   ✅ Confirmed in block ${receipt1?.blockNumber}\n`);
        } catch (error: any) {
            console.error("❌ Failed to propose manager:");
            console.error(`   ${error.message}\n`);
            process.exit(1);
        }
    }

    // Step 2: Accept manager role
    console.log("📝 Step 2: Accepting manager role...");
    console.log("   Note: This must be called FROM the Manager contract");
    console.log("   Calling: registry.acceptManagerRole()\n");

    try {
        // We need to call acceptManagerRole() from the Manager contract
        // This requires the Manager to have this function, or we call it directly
        // Since Manager doesn't have this function, we need to call it from an EOA
        // that will then be set as the manager

        // Actually, looking at the Registry contract, acceptManagerRole() must be
        // called by the pendingManager address itself. Since Manager is a contract,
        // we need to check if Manager has a function to call this.

        // For now, let's try calling it directly and see what happens
        const tx2 = await registry.acceptManagerRole();
        console.log(`   Transaction hash: ${tx2.hash}`);
        console.log("   Waiting for confirmation...");

        const receipt2 = await tx2.wait();
        console.log(`   ✅ Confirmed in block ${receipt2?.blockNumber}\n`);
    } catch (error: any) {
        console.error("❌ Failed to accept manager role:");
        console.error(`   ${error.message}`);
        console.error("\n⚠️  NOTE: acceptManagerRole() must be called by the pending manager address.");
        console.error("   If Manager is a contract, it needs a function to call this.");
        console.error("   You may need to call this manually from the Manager contract address.\n");
        process.exit(1);
    }

    // Verify wiring
    console.log("🔍 Verifying wiring...\n");

    const newManager = await registry.manager();
    const newPending = await registry.pendingManager();

    console.log(`New manager:      ${newManager}`);
    console.log(`New pending:      ${newPending}\n`);

    if (newManager.toLowerCase() === MONAD_ADDRESSES.CLAWGER_MANAGER.toLowerCase()) {
        console.log("=".repeat(60));
        console.log("✅ SUCCESS! Registry is now wired to Manager!");
        console.log("=".repeat(60) + "\n");
    } else {
        console.log("=".repeat(60));
        console.log("⚠️  Wiring incomplete - please verify manually");
        console.log("=".repeat(60) + "\n");
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
