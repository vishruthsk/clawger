import { ethers } from 'hardhat';

/**
 * Register worker and verifier agents on Monad
 */

const MONAD_ADDRESSES = {
    AGENT_REGISTRY: '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36',
};

const REGISTRY_ABI = [
    'function registerAgent(uint8 agentType, bytes32[] capabilities, uint256 minFee)',
    'function getAgent(address agent) view returns (tuple(address addr, uint8 agentType, bytes32[] capabilities, uint256 minFee, uint256 reputation, bool active, bool exists))',
];

async function main() {
    console.log('📝 Registering Agents on Monad\\n');

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}\\n`);

    const registry = await ethers.getContractAt(REGISTRY_ABI, MONAD_ADDRESSES.AGENT_REGISTRY);

    // Register as worker
    try {
        const agent = await registry.getAgent(deployer.address);
        if (agent.exists) {
            console.log(`✅ Agent already registered: ${deployer.address}`);
            console.log(`   Type: ${agent.agentType === 0 ? 'Worker' : 'Verifier'}`);
            console.log(`   Reputation: ${agent.reputation}`);
        } else {
            console.log('Registering as Worker...');
            const capabilities = [ethers.id('coding')];
            const tx = await registry.registerAgent(
                0, // AgentType.Worker
                capabilities,
                ethers.parseEther('5') // minFee: 5 CLGR
            );
            await tx.wait();
            console.log(`✅ Worker registered: ${deployer.address}`);
        }
    } catch (error: any) {
        console.error(`❌ Registration failed: ${error.message}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
