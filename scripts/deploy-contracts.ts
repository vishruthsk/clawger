import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'wss://monad-testnet.drpc.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CLAWGER_ADDRESS = process.env.CLAWGER_ADDRESS || process.env.DEPLOYER_ADDRESS;

if (!DEPLOYER_PRIVATE_KEY) {
    console.error('❌ DEPLOYER_PRIVATE_KEY not found in .env');
    console.log('Please add your private key to .env:');
    console.log('DEPLOYER_PRIVATE_KEY=your_private_key_here');
    process.exit(1);
}

async function main() {
    console.log('🚀 Deploying ClawgerManager to Monad Testnet...\n');

    // Connect to Monad testnet
    const provider = new ethers.WebSocketProvider(MONAD_RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

    console.log('📡 Connected to Monad Testnet');
    console.log(`🔑 Deployer Address: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} MON\n`);

    if (balance === 0n) {
        console.error('❌ Insufficient balance. Please fund your wallet with testnet MON');
        process.exit(1);
    }

    // Read contract source
    const contractPath = path.join(__dirname, '../contracts/ClawgerManager.sol');
    const contractSource = fs.readFileSync(contractPath, 'utf8');

    console.log('📝 Compiling contract...');

    // For production, you'd use hardhat or foundry
    // For now, we'll provide the compiled bytecode and ABI
    // User should compile with: npx hardhat compile or forge build

    console.log('\n⚠️  MANUAL COMPILATION REQUIRED');
    console.log('Please compile the contract first using one of these methods:\n');
    console.log('Option 1 - Using Hardhat:');
    console.log('  npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox');
    console.log('  npx hardhat compile');
    console.log('  # Then update this script with the compiled artifacts\n');
    console.log('Option 2 - Using Foundry:');
    console.log('  forge build');
    console.log('  # Then update this script with the compiled artifacts\n');
    console.log('Option 3 - Use Remix IDE:');
    console.log('  1. Go to https://remix.ethereum.org');
    console.log('  2. Paste ClawgerManager.sol');
    console.log('  3. Compile and get ABI + Bytecode');
    console.log('  4. Update this script\n');

    // Placeholder for deployment
    const clawgerManagerAddress = CLAWGER_ADDRESS || wallet.address;

    console.log('📋 Deployment Configuration:');
    console.log(`   CLAWGER Address: ${clawgerManagerAddress}`);
    console.log(`   Network: Monad Testnet`);
    console.log(`   RPC: ${MONAD_RPC_URL}\n`);

    console.log('After compilation, update this script with:');
    console.log('1. Contract ABI');
    console.log('2. Contract Bytecode');
    console.log('3. Constructor arguments\n');

    // Example deployment code (uncomment after compilation):
    /*
    const ClawgerManager = new ethers.ContractFactory(
        ABI,  // Add compiled ABI here
        BYTECODE,  // Add compiled bytecode here
        wallet
    );

    const contract = await ClawgerManager.deploy(clawgerManagerAddress);
    await contract.waitForDeployment();

    const deployedAddress = await contract.getAddress();

    console.log('✅ ClawgerManager deployed!');
    console.log(`📍 Contract Address: ${deployedAddress}\n`);

    // Save to .env
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('NEXT_PUBLIC_CLAWGER_MANAGER=')) {
        envContent = envContent.replace(
            /NEXT_PUBLIC_CLAWGER_MANAGER=.*/,
    `NEXT_PUBLIC_CLAWGER_MANAGER=${deployedAddress}`
        );
} else {
    envContent += `\nNEXT_PUBLIC_CLAWGER_MANAGER=${deployedAddress}\n`;
}

fs.writeFileSync(envPath, envContent);
console.log('💾 Saved address to .env');
console.log(`\nAdd this to your .env file:`);
console.log(`NEXT_PUBLIC_CLAWGER_MANAGER=${deployedAddress}`);
    */

await provider.destroy();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
