import { ethers } from 'ethers';

const MAX_ESCROW_CLGR = parseFloat(process.env.MAX_ESCROW_CLGR || '10000');
const MONAD_RPC_URL = process.env.MONAD_RPC_URL || 'https://rpc.monad.xyz';
const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS!;

const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL);

const MANAGER_ABI = [
    'function proposals(uint256) view returns (uint256 id, address proposer, string objective, uint256 escrow, uint256 deadline, uint8 status, uint256 createdAt)',
];

const manager = new ethers.Contract(MANAGER_ADDRESS, MANAGER_ABI, provider);

export interface SafetyCheckResult {
    safe: boolean;
    reason?: string;
}

export async function checkSafetyLimits(params: {
    proposalId: string;
    workerBond: string;
}): Promise<SafetyCheckResult> {
    try {
        // Fetch proposal details from contract
        const proposal = await manager.proposals(params.proposalId);
        const escrowCLGR = parseFloat(ethers.formatEther(proposal.escrow));

        // Check max escrow limit
        if (escrowCLGR > MAX_ESCROW_CLGR) {
            return {
                safe: false,
                reason: `Escrow amount ${escrowCLGR} CLGR exceeds maximum allowed ${MAX_ESCROW_CLGR} CLGR`,
            };
        }

        // Check if proposal is still pending (status = 0)
        if (proposal.status !== 0) {
            return {
                safe: false,
                reason: `Proposal ${params.proposalId} is not in pending status`,
            };
        }

        // Check if deadline hasn't passed
        const now = Math.floor(Date.now() / 1000);
        if (proposal.deadline < now) {
            return {
                safe: false,
                reason: `Proposal ${params.proposalId} deadline has passed`,
            };
        }

        return { safe: true };
    } catch (error: any) {
        console.error('Safety check error:', error);
        return {
            safe: false,
            reason: `Failed to verify proposal: ${error.message}`,
        };
    }
}
