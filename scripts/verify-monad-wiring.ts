/**
 * Monad Deployment Wiring Verification Script
 * 
 * This script verifies the wiring status of deployed CLAWGER contracts on Monad.
 * It checks:
 * - Registry.manager == ClawgerManager address
 * - Manager.registry == AgentRegistry address
 * - Manager.CLGR == CLGR token address
 * - Manager.clawger == CLAWGER operator address
 * - Ownership verification
 * 
 * Usage:
 *   npx hardhat run scripts/verify-monad-wiring.ts --network monad
 */

import { ethers } from "hardhat";

// Deployed contract addresses on Monad
const MONAD_ADDRESSES = {
    CLGR_TOKEN: "0x1F81fBE23B357B84a065Eb2898dBF087815c7777",
    AGENT_REGISTRY: "0x089D0b590321560c8Ec2Ece672Ef22462F79BC36",
    CLAWGER_MANAGER: "0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D",
};

interface VerificationResult {
    check: string;
    expected: string;
    actual: string;
    status: "✅ PASS" | "❌ FAIL" | "⚠️  WARN";
    details?: string;
}

async function main() {
    console.log("\n🔍 CLAWGER Monad Deployment Verification\n");
    console.log("=".repeat(60));
    console.log("Deployed Addresses:");
    console.log(`  CLGR Token:       ${MONAD_ADDRESSES.CLGR_TOKEN}`);
    console.log(`  AgentRegistry:    ${MONAD_ADDRESSES.AGENT_REGISTRY}`);
    console.log(`  ClawgerManager:   ${MONAD_ADDRESSES.CLAWGER_MANAGER}`);
    console.log("=".repeat(60) + "\n");

    const results: VerificationResult[] = [];

    try {
        // Get contract instances
        const registry = await ethers.getContractAt(
            "AgentRegistryV3",
            MONAD_ADDRESSES.AGENT_REGISTRY
        );

        const manager = await ethers.getContractAt(
            "ClawgerManagerV4",
            MONAD_ADDRESSES.CLAWGER_MANAGER
        );

        const clgr = await ethers.getContractAt(
            "IERC20",
            MONAD_ADDRESSES.CLGR_TOKEN
        );

        // Check 1: Registry.manager == ClawgerManager
        console.log("Checking Registry → Manager authorization...");
        const registryManager = await registry.manager();
        results.push({
            check: "Registry.manager()",
            expected: MONAD_ADDRESSES.CLAWGER_MANAGER,
            actual: registryManager,
            status: registryManager.toLowerCase() === MONAD_ADDRESSES.CLAWGER_MANAGER.toLowerCase()
                ? "✅ PASS"
                : "❌ FAIL",
            details: registryManager.toLowerCase() !== MONAD_ADDRESSES.CLAWGER_MANAGER.toLowerCase()
                ? "Manager authorization required! Run wire-registry-manager.ts"
                : undefined
        });

        // Check 2: Manager.registry == AgentRegistry
        console.log("Checking Manager → Registry connection...");
        const managerRegistry = await manager.registry();
        results.push({
            check: "Manager.registry()",
            expected: MONAD_ADDRESSES.AGENT_REGISTRY,
            actual: managerRegistry,
            status: managerRegistry.toLowerCase() === MONAD_ADDRESSES.AGENT_REGISTRY.toLowerCase()
                ? "✅ PASS"
                : "❌ FAIL"
        });

        // Check 3: Manager.CLGR == CLGR Token
        console.log("Checking Manager → CLGR token connection...");
        const managerCLGR = await manager.CLGR();
        results.push({
            check: "Manager.CLGR()",
            expected: MONAD_ADDRESSES.CLGR_TOKEN,
            actual: managerCLGR,
            status: managerCLGR.toLowerCase() === MONAD_ADDRESSES.CLGR_TOKEN.toLowerCase()
                ? "✅ PASS"
                : "❌ FAIL"
        });

        // Check 4: Manager.clawger (operator address)
        console.log("Checking CLAWGER operator address...");
        const clawgerOperator = await manager.clawger();
        results.push({
            check: "Manager.clawger()",
            expected: "<CLAWGER operator wallet>",
            actual: clawgerOperator,
            status: clawgerOperator !== ethers.ZeroAddress ? "✅ PASS" : "❌ FAIL",
            details: `Operator: ${clawgerOperator}`
        });

        // Check 5: Registry owner
        console.log("Checking Registry ownership...");
        const registryOwner = await registry.owner();
        results.push({
            check: "Registry.owner()",
            expected: "<Deployer address>",
            actual: registryOwner,
            status: registryOwner !== ethers.ZeroAddress ? "✅ PASS" : "⚠️  WARN",
            details: `Owner: ${registryOwner}`
        });

        // Check 6: Manager owner
        console.log("Checking Manager ownership...");
        const managerOwner = await manager.owner();
        results.push({
            check: "Manager.owner()",
            expected: "<Deployer address>",
            actual: managerOwner,
            status: managerOwner !== ethers.ZeroAddress ? "✅ PASS" : "⚠️  WARN",
            details: `Owner: ${managerOwner}`
        });

        // Check 7: Registry paused status
        console.log("Checking Registry pause status...");
        const registryPaused = await registry.paused();
        results.push({
            check: "Registry.paused()",
            expected: "false",
            actual: registryPaused.toString(),
            status: !registryPaused ? "✅ PASS" : "⚠️  WARN",
            details: registryPaused ? "Contract is PAUSED" : undefined
        });

        // Check 8: Manager paused status
        console.log("Checking Manager pause status...");
        const managerPaused = await manager.paused();
        results.push({
            check: "Manager.paused()",
            expected: "false",
            actual: managerPaused.toString(),
            status: !managerPaused ? "✅ PASS" : "⚠️  WARN",
            details: managerPaused ? "Contract is PAUSED" : undefined
        });

        // Check 9: Pending manager (should be zero if wiring complete)
        console.log("Checking pending manager...");
        const pendingManager = await registry.pendingManager();
        results.push({
            check: "Registry.pendingManager()",
            expected: ethers.ZeroAddress,
            actual: pendingManager,
            status: pendingManager === ethers.ZeroAddress ? "✅ PASS" : "⚠️  WARN",
            details: pendingManager !== ethers.ZeroAddress
                ? `Pending manager transfer to: ${pendingManager}`
                : undefined
        });

    } catch (error: any) {
        console.error("\n❌ Error during verification:");
        console.error(error.message);
        process.exit(1);
    }

    // Print results
    console.log("\n" + "=".repeat(60));
    console.log("VERIFICATION RESULTS");
    console.log("=".repeat(60) + "\n");

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    results.forEach((result) => {
        console.log(`${result.status} ${result.check}`);
        console.log(`   Expected: ${result.expected}`);
        console.log(`   Actual:   ${result.actual}`);
        if (result.details) {
            console.log(`   Note:     ${result.details}`);
        }
        console.log();

        if (result.status === "✅ PASS") passCount++;
        else if (result.status === "❌ FAIL") failCount++;
        else warnCount++;
    });

    console.log("=".repeat(60));
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
    console.log("=".repeat(60) + "\n");

    // Action items
    if (failCount > 0) {
        console.log("⚠️  ACTION REQUIRED:\n");

        const managerAuthFailed = results.find(
            r => r.check === "Registry.manager()" && r.status === "❌ FAIL"
        );

        if (managerAuthFailed) {
            console.log("🔧 Registry → Manager authorization is NOT set!");
            console.log("   Run the wiring script:");
            console.log("   npx hardhat run scripts/wire-registry-manager.ts --network monad\n");
        }

        process.exit(1);
    } else if (warnCount > 0) {
        console.log("✅ All critical checks passed!");
        console.log("⚠️  Some warnings detected - review above for details.\n");
    } else {
        console.log("✅ All checks passed! Deployment is correctly wired.\n");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
