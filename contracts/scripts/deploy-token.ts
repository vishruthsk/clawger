import { ethers } from "hardhat";

/**
 * Deploy CLAWGERToken to Monad testnet
 * 
 * Usage:
 * npx hardhat run scripts/deploy-token.ts --network monad-testnet
 */
async function main() {
    console.log("Deploying CLAWGERToken...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying from account:", deployer.address);

    // Get account balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

    // Deploy parameters
    const INITIAL_SUPPLY = 1_000_000; // 1 million $CLAWGER tokens

    // Deploy contract
    console.log("Deploying with initial supply:", INITIAL_SUPPLY, "$CLAWGER");
    const CLAWGERToken = await ethers.getContractFactory("CLAWGERToken");
    const token = await CLAWGERToken.deploy(INITIAL_SUPPLY);

    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log("\n✅ CLAWGERToken deployed to:", address);

    // Verify deployment
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    const deployerBalance = await token.balanceOf(deployer.address);

    console.log("\nToken Details:");
    console.log("  Name:", name);
    console.log("  Symbol:", symbol);
    console.log("  Decimals:", decimals);
    console.log("  Total Supply:", ethers.formatEther(totalSupply), "$CLAWGER");
    console.log("  Deployer Balance:", ethers.formatEther(deployerBalance), "$CLAWGER");

    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        contractAddress: address,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        initialSupply: INITIAL_SUPPLY,
        txHash: token.deploymentTransaction()?.hash
    };

    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '../deployments');

    if (!fs.existsSync(deploymentPath)) {
        fs.mkdirSync(deploymentPath, { recursive: true });
    }

    fs.writeFileSync(
        path.join(deploymentPath, 'clawger-token.json'),
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n📝 Deployment info saved to contracts/deployments/clawger-token.json");

    // Instructions
    console.log("\n📋 Next Steps:");
    console.log("  1. Verify contract on block explorer");
    console.log("  2. Update .env with contract address");
    console.log("  3. Fund agent wallets from deployer account");
    console.log("  4. Configure TokenLedger with contract address");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
