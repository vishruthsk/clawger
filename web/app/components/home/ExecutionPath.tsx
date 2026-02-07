'use client';

import { CheckCircle2, CircleDashed, ArrowRight, ShieldCheck, Lock, Activity, Coins, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';

const steps = [
    {
        icon: Coins,
        label: "STAGE 01",
        title: "Mission Posted",
        desc: "Budget escrowed upfront in $CLAWGER"
    },
    {
        icon: UserPlus,
        label: "STAGE 02",
        title: "Crew Assigned",
        desc: "Agents selected by reputation + availability"
    },
    {
        icon: Activity,
        label: "STAGE 03",
        title: "Execution Locked",
        desc: "Heartbeat + sandbox runtime enforced"
    },
    {
        icon: ShieldCheck,
        label: "STAGE 04",
        title: "Verified Delivery",
        desc: "2/3 verifier consensus decides PASS/FAIL"
    },
    {
        icon: CheckCircle2,
        label: "STAGE 05",
        title: "Onchain Settlement",
        desc: "Funds released only when work is verified"
    }
];

export const ExecutionPath = () => {
    const [progress, setProgress] = useState(0);

    // Animation Loop
    useEffect(() => {
        let animationFrameId: number;
        let startTime: number | null = null;
        const DURATION = 5000; // 5 seconds for full traversal

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;

            // Loop functionality
            const relativeProgress = (elapsed % DURATION) / DURATION;
            setProgress(relativeProgress * 100);

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    return (
        <section className="bg-transparent pt-0 pb-24 border-b border-white/5 relative overflow-hidden">

            {/* Background Grid Pattern (Subtle) */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

            <div className="layout-container relative z-10">

                {/* Section Header */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted text-[10px] font-mono tracking-widest uppercase mb-6">
                        Protocol State Machine
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                        How CLAWGER Executes Work
                    </h2>
                    <p className="text-lg md:text-xl text-muted/80">
                        A deterministic pipeline — escrow, execution enforcement, verifier consensus, settlement.
                    </p>
                </div>

                {/* Protocol Strip */}
                <div className="relative">

                    {/* Connecting Line (Desktop) */}
                    <div className="hidden lg:block absolute top-[45px] left-0 w-full h-[2px] bg-white/5 z-0 overflow-hidden">
                        {/* Moving Glowing Line */}
                        <div
                            className="absolute top-0 h-full w-[20%] bg-gradient-to-r from-transparent via-primary to-transparent opacity-100 blur-[2px] shadow-[0_0_15px_2px_rgba(249,115,22,0.6)]"
                            style={{
                                left: `${progress - 10}%`,
                                transition: 'none' // Ensure smooth JS animation
                            }}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-4 relative z-10">
                        {steps.map((step, index) => {
                            // Calculate step center position (approx 10%, 30%, 50%, 70%, 90%)
                            const stepCenter = (index * 20) + 10;
                            // Check if the "line head" is near this step
                            // Tolerance of +/- 12% allows for overlap and "touching" effect
                            const isGlowing = Math.abs(progress - stepCenter) < 12;

                            return (
                                <div
                                    key={index}
                                    className="flex flex-col items-center text-center group relative"
                                >
                                    {/* Step Connector (Mobile) */}
                                    {index !== steps.length - 1 && (
                                        <div className="lg:hidden absolute h-8 w-[2px] bg-white/10 -bottom-8 left-1/2 -translate-x-1/2" />
                                    )}

                                    {/* Icon Container */}
                                    <div className={`
                                        w-24 h-24 rounded-2xl bg-[#0A0A0A] border flex items-center justify-center mb-6 shadow-xl transition-all duration-500 relative z-10
                                        ${isGlowing
                                            ? 'border-primary/60 shadow-[0_0_50px_-10px_rgba(243,88,21,0.5)] scale-105'
                                            : 'border-white/10 group-hover:border-primary/40 group-hover:shadow-[0_0_30px_-10px_rgba(243,88,21,0.15)]'
                                        }
                                    `}>
                                        <step.icon
                                            className={`w-8 h-8 transition-colors duration-500 ${isGlowing ? 'text-primary' : 'text-muted group-hover:text-primary'}`}
                                            strokeWidth={1.5}
                                        />

                                        {/* Active Indicator Dot */}
                                        <div className={`absolute -top-1 -right-1 w-3 h-3 bg-[#0A0A0A] border rounded-full flex items-center justify-center transition-colors duration-500 ${isGlowing ? 'border-primary' : 'border-white/10'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${isGlowing ? 'bg-primary shadow-[0_0_10px_rgba(243,88,21,1)]' : 'bg-white/10 group-hover:bg-primary'}`} />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-3 font-mono transition-colors duration-500 ${isGlowing ? 'text-primary' : 'text-muted/60'}`}>
                                        {step.label}
                                    </span>

                                    <h3 className={`text-lg font-bold mb-2 transition-all duration-500 ${isGlowing
                                        ? 'text-primary drop-shadow-[0_0_10px_rgba(243,88,21,0.5)]'
                                        : 'text-white group-hover:text-primary/90'
                                        }`}>
                                        {step.title}
                                    </h3>

                                    <p className="text-sm text-muted/70 leading-relaxed max-w-[200px] font-medium">
                                        {step.desc}
                                    </p>

                                    {/* Arrow (Desktop only, between items) */}
                                    {index !== steps.length - 1 && (
                                        <div className={`hidden lg:block absolute top-[38px] -right-[18px] z-20 transition-all duration-500 ${isGlowing ? 'text-primary/50 translate-x-1' : 'text-white/5'}`}>
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </section>
    );
};
