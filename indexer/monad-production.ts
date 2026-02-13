/**
 * CLAWGER Production Configuration
 * 
 * Single source of truth for all Monad Mainnet contract addresses and network config.
 * This file MUST be imported by all parts of the system.
 */

export const MONAD_PRODUCTION = {
    // Network Configuration
    chainId: 143,
    chainIdHex: '0x8f',
    name: 'Monad Mainnet',
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://explorer.monad.xyz',

    // Native Currency
    nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
    },

    // Deployed Contract Addresses (Immutable)
    contracts: {
        CLGR_TOKEN: '0x1F81fBE23B357B84a065Eb2898dBF087815c7777',
        AGENT_REGISTRY: '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36',
        CLAWGER_MANAGER: '0xA001b7BAb7E46181b5034d1D7B0dAe7B88e47B6D',
    },

    // Deployment Block Numbers (for indexer start)
    deploymentBlocks: {
        CLGR_TOKEN: 54800000,
        AGENT_REGISTRY: 54800000,
        CLAWGER_MANAGER: 54800000,
    },

    // Explorer Links
    getExplorerLink: (type: 'tx' | 'address' | 'block', value: string) => {
        const base = 'https://explorer.monad.xyz';
        switch (type) {
            case 'tx':
                return `${base}/tx/${value}`;
            case 'address':
                return `${base}/address/${value}`;
            case 'block':
                return `${base}/block/${value}`;
            default:
                return base;
        }
    },
} as const;

/**
 * Validate production configuration
 * Ensures all required values are set
 */
export function validateProductionConfig(): void {
    const { contracts, deploymentBlocks } = MONAD_PRODUCTION;

    // Validate contract addresses
    for (const [key, address] of Object.entries(contracts)) {
        if (!address || (address as string) === '0x0000000000000000000000000000000000000000') {
            throw new Error(`Invalid contract address for ${key}: ${address}`);
        }
    }

    // Warn if deployment blocks are not set (they can be 0 for genesis)
    for (const [key, block] of Object.entries(deploymentBlocks)) {
        if (block === undefined || block === null) {
            console.warn(`⚠️  Deployment block not set for ${key}`);
        }
    }
}

/**
 * Check if we're in production mode
 * Production mode means:
 * - Using Monad Mainnet (chainId 143)
 * - DEMO_MODE is false
 * - Real contracts only
 */
export function isProductionMode(): boolean {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    return !isDemoMode && MONAD_PRODUCTION.chainId === 143;
}

/**
 * Get contract address by name
 */
export function getContractAddress(name: keyof typeof MONAD_PRODUCTION.contracts): string {
    return MONAD_PRODUCTION.contracts[name];
}

/**
 * Get deployment block by contract name
 */
export function getDeploymentBlock(name: keyof typeof MONAD_PRODUCTION.deploymentBlocks): number {
    return MONAD_PRODUCTION.deploymentBlocks[name];
}

// Type exports for TypeScript
export type MonadProductionConfig = typeof MONAD_PRODUCTION;
export type ContractAddresses = typeof MONAD_PRODUCTION.contracts;
