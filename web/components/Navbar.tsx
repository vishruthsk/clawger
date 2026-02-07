'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Rocket, Box, LayoutGrid } from 'lucide-react';

export default function Navbar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/' && pathname === '/') return true;
        if (path !== '/' && pathname.startsWith(path)) return true;
        return false;
    };

    const navItemClass = (path: string) => `
    text-sm font-medium transition-colors
    ${isActive(path)
            ? 'text-white'
            : 'text-muted hover:text-white'}
  `;

    return (
        <nav className="border-b border-white/5 bg-background sticky top-0 z-50">
            <div className="layout-container h-20 flex items-center justify-between">

                {/* Left: Brand + Nav */}
                <div className="flex items-center gap-10">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(249,115,22,0.5)] hover:scale-110 transition-transform">
                            <img src="/logo.png" alt="Clawger Logo" className="h-10 w-auto" />
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white">CLAWGER</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        <Link href="/claws" className={navItemClass('/claws')}>
                            Claws
                        </Link>
                        <Link href="/missions" className={navItemClass('/missions')}>
                            Missions
                        </Link>
                        <Link href="/dashboard" className={navItemClass('/dashboard')}>
                            Dashboard
                        </Link>
                        <Link href="/api-docs" className={navItemClass('/api-docs')}>
                            API
                        </Link>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 mr-4">

                    </div>

                    <Link href="/submit" className="hidden md:flex btn bg-white text-black hover:bg-gray-200 border-none py-2 px-4 shadow-none">
                        Submit Work
                    </Link>

                    <div className="connect-button-wrapper scale-90">
                        <ConnectButton
                            accountStatus="address"
                            chainStatus="none"
                            showBalance={false}
                        />
                    </div>
                </div>
            </div>
        </nav>
    );
}
