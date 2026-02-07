'use client';

export const CrabBackground = () => {
    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-20 flex items-center justify-center select-none">
            {/* Container for the giant crab */}
            <div className="relative w-[120vw] h-[120vh] max-w-none animate-float opacity-[0.04]">

                {/* Holographic Scanline Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/0 via-primary/10 to-primary/0 h-[20%] w-full animate-[scan_8s_linear_infinite] opacity-30 z-10 mix-blend-screen pointer-events-none" />

                <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full text-primary drop-shadow-[0_0_30px_rgba(243,88,21,0.5)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {/* Main Body Shell - Angular/Mecha */}
                    <path d="M30 40 L 40 35 L 60 35 L 70 40 L 75 55 L 60 65 L 40 65 L 25 55 Z" />
                    <path d="M40 35 L 50 30 L 60 35" strokeOpacity="0.5" />
                    <path d="M30 40 L 50 50 L 70 40" strokeOpacity="0.3" />
                    <path d="M50 50 L 50 65" strokeOpacity="0.3" />

                    {/* Eyes (Glowing) */}
                    <circle cx="35" cy="38" r="1.5" fill="currentColor" className="animate-pulse" />
                    <circle cx="65" cy="38" r="1.5" fill="currentColor" className="animate-pulse" />

                    {/* Left Claw (Big) */}
                    <path d="M25 55 L 15 50 L 10 35 Q 5 25 20 20 L 25 25" />
                    <path d="M15 50 L 12 40" strokeOpacity="0.5" />
                    <path d="M25 25 L 30 20" /> {/* Pincer top */}
                    <path d="M22 22 L 18 15" /> {/* Pincer bottom */}

                    {/* Right Claw (Big) */}
                    <path d="M75 55 L 85 50 L 90 35 Q 95 25 80 20 L 75 25" />
                    <path d="M85 50 L 88 40" strokeOpacity="0.5" />
                    <path d="M75 25 L 70 20" />
                    <path d="M78 22 L 82 15" />

                    {/* Legs Left */}
                    <path d="M30 60 L 20 70 L 15 80" />
                    <path d="M35 62 L 28 75 L 25 85" />
                    <path d="M40 65 L 38 78 L 38 88" />

                    {/* Legs Right */}
                    <path d="M70 60 L 80 70 L 85 80" />
                    <path d="M65 62 L 72 75 L 75 85" />
                    <path d="M60 65 L 62 78 L 62 88" />
                </svg>
            </div>

            {/* Secondary Ambient Glow */}
            <div className="absolute inset-0 bg-radial-gradient from-primary/5 via-transparent to-transparent opacity-50 mix-blend-screen" />
        </div>
    );
};
