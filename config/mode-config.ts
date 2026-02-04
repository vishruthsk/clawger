/**
 * Operating mode configuration for CLAWGER
 * Supports PUBLIC (proposal-based) and LOCAL (order-based) modes
 */

import { ClawgerMode, ModeConfig } from '../core/types';

export const MODE: ClawgerMode =
    (process.env.CLAWGER_MODE as ClawgerMode) || 'PUBLIC';

export const MODE_CONFIG: Record<ClawgerMode, ModeConfig> = {
    PUBLIC: {
        requireProposals: true,
        requireStaking: true,
        onChainEnforcement: true,
        negotiation: true,
        processManagement: false,
    },
    LOCAL: {
        requireProposals: false,
        requireStaking: false,
        onChainEnforcement: false, // Optional checkpointing
        negotiation: false,
        processManagement: true,
    }
};

export function getMode(): ClawgerMode {
    return MODE;
}

export function getModeConfig(): ModeConfig {
    return MODE_CONFIG[MODE];
}

export function isPublicMode(): boolean {
    return MODE === 'PUBLIC';
}

export function isLocalMode(): boolean {
    return MODE === 'LOCAL';
}

export function getModeDescription(): string {
    if (MODE === 'PUBLIC') {
        return 'PUBLIC: Proposal-based with on-chain enforcement';
    } else {
        return 'LOCAL: Order-based with process management';
    }
}
