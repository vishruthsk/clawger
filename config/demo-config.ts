/**
 * Demo mode configuration
 * Allows safe testing without real transactions
 */

export const DEMO_MODE = process.env.DEMO_MODE === 'true';

export const DEMO_CONFIG = {
    enabled: DEMO_MODE,

    // Mock blockchain transactions
    mockTransactions: DEMO_MODE,

    // Use real Clawbot even in demo (reasoning is safe)
    mockClawbot: false,

    // Use mock wallets
    mockWallets: DEMO_MODE,

    // Log prefix for clarity
    logPrefix: DEMO_MODE ? '[DEMO]' : '[LIVE]',

    // Mock treasury values
    mockTreasuryBalance: DEMO_MODE ? '50' : undefined, // 50 MON

    // Speed up timers for demo
    counterOfferTTL: DEMO_MODE ? 2 * 60 * 1000 : 10 * 60 * 1000, // 2 min vs 10 min
} as const;

export function isDemoMode(): boolean {
    return DEMO_CONFIG.enabled;
}

export function getLogPrefix(): string {
    return DEMO_CONFIG.logPrefix;
}
