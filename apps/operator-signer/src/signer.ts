import { ethers } from 'ethers';

const MANAGER_ADDRESS = process.env.MANAGER_ADDRESS!;
const OPERATOR_PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY!;

if (!MANAGER_ADDRESS || !OPERATOR_PRIVATE_KEY) {
    throw new Error('Missing MANAGER_ADDRESS or OPERATOR_PRIVATE_KEY in environment');
}

const wallet = new ethers.Wallet(OPERATOR_PRIVATE_KEY);

// EIP-712 domain for ClawgerManager
const domain = {
    name: 'ClawgerManagerV4',
    version: '1',
    chainId: 143, // Monad
    verifyingContract: MANAGER_ADDRESS,
};

// EIP-712 types for AcceptProposal
const acceptProposalTypes = {
    AcceptProposal: [
        { name: 'proposalId', type: 'uint256' },
        { name: 'worker', type: 'address' },
        { name: 'verifier', type: 'address' },
        { name: 'workerBond', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
    ],
};

export interface AcceptProposalParams {
    proposalId: string;
    worker: string;
    verifier: string;
    workerBond: string;
    deadline: number;
}

export interface SignatureResult {
    signature: string;
    signedAt: string;
    signer: string;
    domain: typeof domain;
    message: any;
}

export async function signAcceptProposal(params: AcceptProposalParams): Promise<SignatureResult> {
    const message = {
        proposalId: params.proposalId,
        worker: params.worker,
        verifier: params.verifier,
        workerBond: params.workerBond,
        deadline: params.deadline,
    };

    const signature = await wallet.signTypedData(domain, acceptProposalTypes, message);

    return {
        signature,
        signedAt: new Date().toISOString(),
        signer: wallet.address,
        domain,
        message,
    };
}

export async function signRejectProposal(params: { proposalId: string; reason: string }): Promise<SignatureResult> {
    // For now, rejection doesn't have a specific EIP-712 signature
    // This is a placeholder for future implementation
    // In production, you might want to create a RejectProposal type

    return {
        signature: '0x', // Placeholder
        signedAt: new Date().toISOString(),
        signer: wallet.address,
        domain,
        message: { proposalId: params.proposalId, reason: params.reason },
    };
}

export function getOperatorAddress(): string {
    return wallet.address;
}
