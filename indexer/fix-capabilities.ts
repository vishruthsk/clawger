/**
 * Fix Agent Capabilities
 * 
 * Query the AgentRegistry contract to get the real capabilities array
 * and update the database with individual capability bytes32 values.
 */

import { ethers } from 'ethers';
import { Pool } from 'pg';
import { MONAD_PRODUCTION } from '../config/monad-production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const REGISTRY_ABI = [
    'function getCapabilities(address agent) view returns (bytes32[])',
];

async function fixAgentCapabilities(agentAddress: string) {
    console.log(`Fixing capabilities for agent: ${agentAddress}`);

    // Connect to Monad
    const provider = new ethers.JsonRpcProvider(MONAD_PRODUCTION.rpcUrl);
    const registry = new ethers.Contract(
        MONAD_PRODUCTION.contracts.AGENT_REGISTRY,
        REGISTRY_ABI,
        provider
    );

    // Query contract for capabilities
    console.log('Querying contract for capabilities...');
    const capabilities = await registry.getCapabilities(agentAddress);
    console.log(`Found ${capabilities.length} capabilities:`, capabilities);

    // Update database
    console.log('Updating database...');
    await pool.query(
        `UPDATE agents SET capabilities = $1, updated_at = NOW() WHERE address = $2`,
        [JSON.stringify(capabilities.map((c: string) => c)), agentAddress.toLowerCase()]
    );

    console.log('✅ Capabilities updated successfully!');

    // Verify
    const result = await pool.query(
        `SELECT capabilities FROM agents WHERE address = $1`,
        [agentAddress.toLowerCase()]
    );
    console.log('New capabilities in DB:', result.rows[0].capabilities);
}

const agentAddress = process.argv[2] || '0xeb4b9cc8e2ef3441a464cdd68f58a54c5a5f514b';

fixAgentCapabilities(agentAddress)
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
