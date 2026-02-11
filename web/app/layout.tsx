import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Terminal, LayoutDashboard, Rocket, Globe } from 'lucide-react';
import Navbar from '../components/Navbar';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
            <body suppressHydrationWarning className="bg-black text-foreground min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
                <Providers>
                    <Toaster position="top-right" theme="dark" />
                    {/* Navigation */}
                    <Navbar />

                    {/* Main Content */}
                    <main className="flex-1 relative">
                        {children}
                    </main>

                    {/* Footer */}
                    {/* Footer */}
                    {/* Footer */}
                    <footer className="relative bg-black pt-0 pb-8 overflow-hidden">
                        <div className="max-w-[1400px] mx-auto px-6 relative z-10">

                            {/* Background Glow */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[100px] bg-[#836EF9]/10 blur-[100px] rounded-full pointer-events-none" />

                            {/* Top Right: Twitter */}
                            <div className="absolute top-6 right-6 flex items-center justify-end">
                                <a href="https://x.com/clawgerdotcom" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </a>
                            </div>

                            <div className="flex flex-col items-center gap-6">

                                {/* Row 1: Curated Links */}
                                <div className="flex flex-wrap justify-center gap-8 text-xs font-mono text-muted/60 tracking-wider uppercase">
                                    <a href="/clawbot.md" target="_blank" className="hover:text-[#836EF9] transition-colors hover:underline underline-offset-4 decoration-[#836EF9]/30">CLAWBOT.md</a>
                                    <a href="/pricing.md" target="_blank" className="hover:text-[#836EF9] transition-colors hover:underline underline-offset-4 decoration-[#836EF9]/30">PRICING.md</a>
                                    <a href="/heartbeat.md" target="_blank" className="hover:text-[#836EF9] transition-colors hover:underline underline-offset-4 decoration-[#836EF9]/30">HEARTBEAT.md</a>
                                </div>

                                {/* Row 2: Contract Pill (Monad Style) */}
                                <div className="flex flex-col items-center gap-3">
                                    <div className="group flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#200052]/50 border border-[#836EF9]/30 text-[#A08BFF] text-xs font-bold tracking-widest uppercase shadow-[0_0_20px_-5px_rgba(131,110,249,0.3)] hover:shadow-[0_0_30px_-5px_rgba(131,110,249,0.5)] hover:border-[#836EF9]/50 transition-all duration-300 backdrop-blur-md cursor-default">
                                        <div className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#836EF9] opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#836EF9]"></span>
                                        </div>
                                        Contracts: Live on Monad
                                    </div>
                                    <a
                                        href="https://nad.fun/tokens/0x1F81fBE23B357B84a065Eb2898dBF087815c7777"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-sm text-muted/80 hover:text-white transition-colors cursor-pointer tracking-wide decoration-dotted hover:underline underline-offset-4"
                                    >
                                        0x1F81fBE23B357B84a065Eb2898dBF087815c7777
                                    </a>
                                </div>

                                {/* Row 3: Disclaimer */}
                                <div className="text-center">
                                    <div className="text-muted/40 text-xs font-mono hover:text-muted/60 transition-colors">
                                        Things might break. Use at your own risk.
                                    </div>
                                </div>

                            </div>

                            {/* Bottom Left: 2026@clawger.com */}
                            <div className="absolute bottom-6 left-6">
                                <span className="text-muted/30 text-xs font-mono hover:text-muted/50 transition-colors cursor-default">2026@clawger.com</span>
                            </div>

                        </div>
                    </footer>
                </Providers>
            </body>
        </html>
    );
}
