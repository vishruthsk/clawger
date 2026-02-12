import { ethers } from 'ethers';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { indexAgentRegistered, indexProposalSubmitted, indexTaskCreated, indexTaskSettled, indexReputationUpdated } from './events';
import { getLastBlockNumbers, updateLastBlockNumber } from './db';

dotenv.config();

const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';
const AGENT_REGISTRY = process.env.AGENT_REGISTRY!;
const CLAWGER_MANAGER = process.env.CLAWGER_MANAGER!;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000');

const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);

const REGISTRY_ABI = [
    'event AgentRegistered(address indexed agent, uint8 indexed agentType, uint256 minFee, uint256 minBond, bytes32[] capabilities)',
    'event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore, string reason)',
];

const MANAGER_ABI = [
    'event ProposalSubmitted(uint256 indexed proposalId, address indexed proposer, string objective, uint256 escrow, uint256 deadline)',
    'event ProposalAccepted(uint256 indexed proposalId, uint256 indexed taskId, address worker, address verifier)',
    'event TaskSettled(uint256 indexed taskId, bool success, uint256 workerPayout)',
];

const registryContract = new ethers.Contract(AGENT_REGISTRY, REGISTRY_ABI, provider);
const managerContract = new ethers.Contract(CLAWGER_MANAGER, MANAGER_ABI, provider);

async function indexEvents() {
    console.log('🔍 Starting event indexer...');
    console.log(`   Registry: ${AGENT_REGISTRY}`);
    console.log(`   Manager: ${CLAWGER_MANAGER}`);
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms\\n`);

    while (true) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const { lastBlockRegistry, lastBlockManager } = await getLastBlockNumbers();

            // Index Registry events
            if (lastBlockRegistry < currentBlock) {
                console.log(`Indexing Registry events from block ${lastBlockRegistry + 1} to ${currentBlock}`);

                const agentEvents = await registryContract.queryFilter(
                    registryContract.filters.AgentRegistered(),
                    lastBlockRegistry + 1,
                    currentBlock
                );

                for (const event of agentEvents) {
                    await indexAgentRegistered(event);
                }

                const repEvents = await registryContract.queryFilter(
                    registryContract.filters.ReputationUpdated(),
                    lastBlockRegistry + 1,
                    currentBlock
                );

                for (const event of repEvents) {
                    await indexReputationUpdated(event);
                }

                await updateLastBlockNumber('registry', currentBlock);
                console.log(`✅ Indexed ${agentEvents.length} agent registrations, ${repEvents.length} reputation updates`);
            }

            // Index Manager events
            if (lastBlockManager < currentBlock) {
                console.log(`Indexing Manager events from block ${lastBlockManager + 1} to ${currentBlock}`);

                const proposalEvents = await managerContract.queryFilter(
                    managerContract.filters.ProposalSubmitted(),
                    lastBlockManager + 1,
                    currentBlock
                );

                for (const event of proposalEvents) {
                    await indexProposalSubmitted(event);
                }

                const acceptedEvents = await managerContract.queryFilter(
                    managerContract.filters.ProposalAccepted(),
                    lastBlockManager + 1,
                    currentBlock
                );

                for (const event of acceptedEvents) {
                    await indexTaskCreated(event);
                }

                const settledEvents = await managerContract.queryFilter(
                    managerContract.filters.TaskSettled(),
                    lastBlockManager + 1,
                    currentBlock
                );

                for (const event of settledEvents) {
                    await indexTaskSettled(event);
                }

                await updateLastBlockNumber('manager', currentBlock);
                console.log(`✅ Indexed ${proposalEvents.length} proposals, ${acceptedEvents.length} tasks, ${settledEvents.length} settlements`);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (error) {
            console.error('Error indexing events:', error);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }
}

// Start indexing
indexEvents().catch(console.error);
