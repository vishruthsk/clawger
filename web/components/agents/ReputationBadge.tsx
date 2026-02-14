import React from 'react';

interface ReputationBadgeProps {
    reputation: number;
    size?: 'sm' | 'md' | 'lg';
    showCurrent?: boolean; // Show current/max
    showTier?: boolean;
}

export const ReputationBadge: React.FC<ReputationBadgeProps> = ({
    reputation,
    size = 'md',
    showCurrent = true,
    showTier = true
}) => {
    // Determine tier
    let tier = 'Roam';
    let gradient = 'from-gray-800 to-gray-900 border-gray-700 text-gray-400';
    let icon = '🛡️';
    let glow = 'shadow-none';
    let indicatorColor = 'bg-gray-500';

    if (reputation >= 110) {
        tier = 'Platinum';
        gradient = 'from-cyan-950/80 to-slate-900 border-cyan-500/50 text-cyan-200';
        icon = '💠';
        glow = 'shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]';
        indicatorColor = 'bg-cyan-400';
    } else if (reputation >= 85) {
        tier = 'Gold';
        gradient = 'from-yellow-950/80 to-amber-950/50 border-yellow-500/50 text-yellow-200';
        icon = '🏆';
        glow = 'shadow-[0_0_15px_-3px_rgba(253,224,71,0.3)]';
        indicatorColor = 'bg-yellow-400';
    } else if (reputation >= 65) {
        tier = 'Silver';
        gradient = 'from-slate-800 to-slate-900 border-slate-500/50 text-slate-200';
        icon = '🥈';
        glow = 'shadow-[0_0_10px_-3px_rgba(203,213,225,0.2)]';
        indicatorColor = 'bg-slate-300';
    } else if (reputation >= 50) {
        tier = 'Bronze';
        gradient = 'from-orange-950/80 to-red-950/30 border-orange-700/50 text-orange-200';
        icon = '🥉';
        glow = 'shadow-[0_0_10px_-3px_rgba(249,115,22,0.2)]';
        indicatorColor = 'bg-orange-500';
    } else {
        tier = 'Risk';
        gradient = 'from-red-950 to-black border-red-900/50 text-red-400';
        icon = '⚠️';
        glow = 'shadow-[0_0_10px_-3px_rgba(239,68,68,0.2)]';
        indicatorColor = 'bg-red-500';
    }

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5 gap-1.5',
        md: 'text-sm px-3 py-1 gap-2',
        lg: 'text-base px-4 py-1.5 gap-2.5'
    };

    return (
        <div className={`
            inline-flex items-center rounded-full border 
            bg-gradient-to-r ${gradient} ${glow} 
            ${sizeClasses[size]} font-medium backdrop-blur-md
            transition-all duration-300 hover:scale-105 select-none
        `}>
            {/* Animated Indicator Dot */}
            <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${indicatorColor} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${indicatorColor}`}></span>
            </span>

            {showTier && <span className="font-bold tracking-wide">{tier}</span>}

            {showCurrent && (
                <>
                    {showTier && <div className="w-px h-3 bg-current opacity-20 mx-0.5" />}
                    <span className="font-mono opacity-90 tabular-nums tracking-tight">
                        {Math.round(reputation)}
                    </span>
                </>
            )}
        </div>
    );
};
