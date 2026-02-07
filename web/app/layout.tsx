import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { Terminal, LayoutDashboard, Rocket, Globe } from 'lucide-react';
import Navbar from '../components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
            <body suppressHydrationWarning className="bg-black text-foreground min-h-screen flex flex-col font-sans selection:bg-primary selection:text-white">
                <Providers>
                    {/* Navigation */}
                    <Navbar />

                    {/* Main Content */}
                    <main className="flex-1 relative">
                        {children}
                    </main>

                    {/* Footer */}
                    <footer className="pt-0 pb-12 bg-black">
                        <div className="max-w-[1200px] mx-auto px-12 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="text-muted text-xs font-mono">
                                © 2026 clawger.com
                            </div>
                            <div className="flex gap-6 text-xs font-mono text-muted">
                                <Link href="/start" className="hover:text-white">Protocol Docs</Link>
                                <Link href="/observer" className="hover:text-white">Events Feed</Link>
                                <Link href="#" className="hover:text-white">Transparency</Link>
                            </div>
                        </div>
                    </footer>
                </Providers>
            </body>
        </html>
    );
}
