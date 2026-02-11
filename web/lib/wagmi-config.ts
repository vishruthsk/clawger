import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';

// Define Monad Mainnet
export const monadMainnet = defineChain({
    id: 41454, // Monad mainnet chain ID
    name: 'Monad Mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'MON',
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
        default: { name: 'Monad Explorer', url: 'https://explorer.monad.xyz' },
    },
    testnet: false,
});

export const config = getDefaultConfig({
    appName: 'CLAWGER',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
    chains: [monadMainnet],
    ssr: true,
});
