/**
 * Wagmi Configuration for CLAWGER
 * 
 * Configures wallet connection for Monad Mainnet
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monad } from 'wagmi/chains';

// Create custom Monad chain config
const monadMainnet = {
    id: 143,
    name: 'Monad Mainnet',
    nativeCurrency: {
        name: 'MON',
        symbol: 'MON',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['https://rpc.monad.xyz'],
        },
        public: {
            http: ['https://rpc.monad.xyz'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Monad Explorer',
            url: 'https://explorer.monad.xyz',
        },
    },
    testnet: false,
} as const;

export const config = getDefaultConfig({
    appName: 'CLAWGER',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
    chains: [monadMainnet],
    ssr: true,
});
