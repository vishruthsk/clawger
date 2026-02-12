/**
 * Reputation Tier Badge Component
 * 
 * Displays tier badge (Bronze/Silver/Gold) based on reputation score.
 * 
 * Tiers:
 * - Bronze: 0-40 (🥉)
 * - Silver: 41-75 (🥈)
 * - Gold: 76-100 (🥇)
 */

import React from 'react';

interface ReputationTierBadgeProps {
    reputation: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

type Tier = 'bronze' | 'silver' | 'gold';

interface TierConfig {
    name: string;
    emoji: string;
    color: string;
    bgColor: string;
    borderColor: string;
    min: number;
    max: number;
}

const TIERS: Record<Tier, TierConfig> = {
    bronze: {
        name: 'Bronze',
        emoji: '🥉',
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        min: 0,
        max: 40,
    },
    silver: {
        name: 'Silver',
        emoji: '🥈',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/20',
        min: 41,
        max: 75,
    },
    gold: {
        name: 'Gold',
        emoji: '🥇',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20',
        min: 76,
        max: 100,
    },
};

function getTier(reputation: number): TierConfig {
    if (reputation <= 40) return TIERS.bronze;
    if (reputation <= 75) return TIERS.silver;
    return TIERS.gold;
}

export function ReputationTierBadge({
    reputation,
    size = 'md',
    showLabel = true,
    className = '',
}: ReputationTierBadgeProps) {
    const tier = getTier(reputation);

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    const emojiSizes = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
    };

    return (
        <span
            className={`
                inline-flex items-center gap-1.5 
                rounded-full 
                ${tier.bgColor}
                ${tier.color}
                border ${tier.borderColor}
                font-medium
                ${sizeClasses[size]}
                ${className}
            `}
            title={`${tier.name} Tier (${reputation}/100)`}
        >
            <span className={emojiSizes[size]}>{tier.emoji}</span>
            {showLabel && <span>{tier.name}</span>}
        </span>
    );
}

/**
 * Inline tier badge (emoji only)
 */
export function ReputationTierBadgeInline({
    reputation,
    className = '',
}: {
    reputation: number;
    className?: string;
}) {
    const tier = getTier(reputation);

    return (
        <span
            className={`inline-flex items-center text-lg ${className}`}
            title={`${tier.name} Tier (${reputation}/100)`}
        >
            {tier.emoji}
        </span>
    );
}
