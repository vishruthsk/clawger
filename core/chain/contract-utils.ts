import { ethers, JsonRpcProvider, Wallet, Contract } from "ethers";

/**
 * Check if CLAWGER is running in demo mode (off-chain JSON) or production mode (on-chain Monad)
 */
export const isDemoMode = (): boolean => {
    return process.env.DEMO_MODE !== "false";
};

/**
 * Require production mode and verify contract addresses are set
 * Throws error if in demo mode or contracts not configured
 */
export const requireProductionMode = () => {
    if (isDemoMode()) {
        throw new Error(
            "This operation requires DEMO_MODE=false. Current mode: DEMO (JSON simulation)"
        );
    }

    if (!process.env.CLAWGER_MANAGER_ADDRESS) {
        throw new Error(
            "CLAWGER_MANAGER_ADDRESS not set. Run deployment first: npx hardhat run scripts/deploy-to-monad.ts --network monad"
        );
    }

    if (!process.env.CLGR_TOKEN_ADDRESS) {
        throw new Error("CLGR_TOKEN_ADDRESS not set in .env");
    }

    if (!process.env.MONAD_RPC_URL) {
        throw new Error("MONAD_RPC_URL not set in .env");
    }
};

/**
 * Get ethers provider for Monad network
 */
export const getMonadProvider = (): JsonRpcProvider => {
    requireProductionMode();

    const rpcUrl = process.env.MONAD_RPC_URL!;
    return new JsonRpcProvider(rpcUrl);
};

/**
 * Get ethers signer for CLAWGER operations
 * Uses private key from .env
 */
export const getClawgerSigner = (): Wallet => {
    requireProductionMode();

    if (!process.env.CLAWGER_PRIVATE_KEY) {
        throw new Error(
            "CLAWGER_PRIVATE_KEY not set. For production deployments, consider using Ledger (see docs/ledger-deploy.md)"
        );
    }

    const provider = getMonadProvider();
    return new Wallet(process.env.CLAWGER_PRIVATE_KEY, provider);
};

/**
 * Get ClawgerManager contract instance
 */
export const getClawgerManagerContract = async (): Promise<Contract> => {
    requireProductionMode();

    const signer = getClawgerSigner();
    const address = process.env.CLAWGER_MANAGER_ADDRESS!;

    // ABI - only the methods we need
    const abi = [
        "function createMissionEscrow(bytes32 missionId) external payable",
        "function getMissionEscrow(bytes32 missionId) external view returns (uint256)",
        "function postWorkerBond(uint256 taskId) external payable",
        "function releaseWorkerBond(address agent, uint256 taskId) external",
        "function slashWorkerBond(address agent, uint256 taskId, uint256 amount) external",
        "function verifyTask(uint256 taskId, bool success) external",
        "function getAgentReputation(address agent) external view returns (uint256, uint256, uint256, uint256, uint256)",
    ];

    return new Contract(address, abi, signer);
};

/**
 * Get CLGR Token contract instance
 */
export const getCLGRTokenContract = async (): Promise<Contract> => {
    requireProductionMode();

    const signer = getClawgerSigner();
    const address = process.env.CLGR_TOKEN_ADDRESS!;

    // Standard ERC-20 ABI
    const abi = [
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    ];

    return new Contract(address, abi, signer);
};

/**
 * Convert mission ID string to bytes32 for contract calls
 */
export const missionIdToBytes32 = (missionId: string): string => {
    return ethers.id(missionId);
};

/**
 * Convert $CLAWGER amount to wei (18 decimals)
 */
export const toWei = (amount: number): bigint => {
    return ethers.parseEther(amount.toString());
};

/**
 * Convert wei to $CLAWGER amount
 */
export const fromWei = (weiAmount: bigint): number => {
    return parseFloat(ethers.formatEther(weiAmount));
};

/**
 * Log mode information
 */
export const logModeInfo = () => {
    if (isDemoMode()) {
        console.log("🎭 [DEMO MODE] Using JSON simulation (no blockchain txs)");
    } else {
        console.log("⛓️  [PRODUCTION MODE] Using Monad blockchain");
        console.log(`   CLGR Token: ${process.env.CLGR_TOKEN_ADDRESS}`);
        console.log(`   Manager:    ${process.env.CLAWGER_MANAGER_ADDRESS}`);
    }
};
