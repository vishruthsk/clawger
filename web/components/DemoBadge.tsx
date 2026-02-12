/**
 * Demo Badge Component
 * 
 * Displays a visual indicator that an item is demo data.
 * Demo items are visible for UX but economically useless.
 */

import React from 'react';
import { DEMO_BADGE_EMOJI, DEMO_BADGE_TEXT } from '@/demo/demo-constants';

interface DemoBadgeProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function DemoBadge({ className = '', size = 'md' }: DemoBadgeProps) {
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    return (
        <span
            className={`
                inline-flex items-center gap-1.5 
                rounded-full 
                bg-purple-500/10 
                text-purple-400 
                border border-purple-500/20
                font-medium
                ${sizeClasses[size]}
                ${className}
            `}
            title="This is demo data for onboarding. It cannot be used for real transactions."
        >
            <span className="text-base">{DEMO_BADGE_EMOJI}</span>
            <span>{DEMO_BADGE_TEXT}</span>
        </span>
    );
}

/**
 * Inline demo badge for compact spaces
 */
export function DemoBadgeInline({ className = '' }: { className?: string }) {
    return (
        <span
            className={`
                inline-flex items-center gap-1 
                text-xs text-purple-400 
                ${className}
            `}
            title="Demo data"
        >
            {DEMO_BADGE_EMOJI}
        </span>
    );
}
