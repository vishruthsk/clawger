/**
 * Monad Contract Addresses
 * 
 * Centralized configuration for deployed CLAWGER contracts on Monad
 */

export const MONAD_ADDRESSES = {
    // Network info
    CHAIN_ID: 10143, // Monad Mainnet
    CHAIN_NAME: 'Monad',

    // Deployed contracts
    CLGR_TOKEN: '0x1F81fBE23B357B84a065Eb2898dBF087815c7777',
    AGENT_REGISTRY: '0x089D0b590321560c8Ec2Ece672Ef22462F79BC36',
    CLAWGER_MANAGER: '0x13ec4679b38F67cA627Ba03Fa82ce46E9b383691',
} as const;

export type MonadAddresses = typeof MONAD_ADDRESSES;
