/**
 * Monad Network Configuration
 * 
 * This file contains the network configuration and deployed contract addresses
 * for the CLAWGER platform on Monad Mainnet.
 */

export const MONAD_NETWORK = {
    chainId: 41454,
    chainIdHex: '0xa1ce',
    name: 'Monad Mainnet',
    rpcUrl: 'https://rpc.monad.xyz',
    explorerUrl: 'https://explorer.monad.xyz',
    nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
    },
} as const;

export const MONAD_CONTRACTS = {
    CLGR_TOKEN: '0x1F81fBE23B357B84a065Eb2898dBF087815c7777',
    AGENT_REGISTRY: '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36',
    CLAWGER_MANAGER: '0x13ec4679b38F67cA627Ba03Fa82ce46E9b383691',
} as const;

export const MONAD_EXPLORER_LINKS = {
    token: `${MONAD_NETWORK.explorerUrl}/address/${MONAD_CONTRACTS.CLGR_TOKEN}`,
    registry: `${MONAD_NETWORK.explorerUrl}/address/${MONAD_CONTRACTS.AGENT_REGISTRY}`,
    manager: `${MONAD_NETWORK.explorerUrl}/address/${MONAD_CONTRACTS.CLAWGER_MANAGER}`,

    // Helper function to get transaction link
    tx: (hash: string) => `${MONAD_NETWORK.explorerUrl}/tx/${hash}`,

    // Helper function to get address link
    address: (addr: string) => `${MONAD_NETWORK.explorerUrl}/address/${addr}`,
} as const;

/**
 * Add Monad network to wallet (MetaMask, etc.)
 */
export async function addMonadNetwork() {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: MONAD_NETWORK.chainIdHex,
                chainName: MONAD_NETWORK.name,
                nativeCurrency: MONAD_NETWORK.nativeCurrency,
                rpcUrls: [MONAD_NETWORK.rpcUrl],
                blockExplorerUrls: [MONAD_NETWORK.explorerUrl],
            }],
        });
        return true;
    } catch (error) {
        console.error('Failed to add Monad network:', error);
        return false;
    }
}

/**
 * Switch to Monad network
 */
export async function switchToMonad() {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_NETWORK.chainIdHex }],
        });
        return true;
    } catch (error: any) {
        // If network not added, try adding it
        if (error.code === 4902) {
            return await addMonadNetwork();
        }
        console.error('Failed to switch to Monad network:', error);
        return false;
    }
}

/**
 * Check if currently on Monad network
 */
export async function isOnMonad(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ethereum) {
        return false;
    }

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        return chainId === MONAD_NETWORK.chainIdHex;
    } catch (error) {
        console.error('Failed to check network:', error);
        return false;
    }
}

// Type augmentation for window.ethereum
declare global {
    interface Window {
        ethereum?: {
            request: (args: { method: string; params?: any[] }) => Promise<any>;
            on?: (event: string, callback: (...args: any[]) => void) => void;
            removeListener?: (event: string, callback: (...args: any[]) => void) => void;
        };
    }
}
