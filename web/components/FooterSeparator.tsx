'use client';

import { usePathname } from 'next/navigation';

export function FooterSeparator() {
    const pathname = usePathname();
    const isHome = pathname === '/';

    if (isHome) return null;

    return (
        <div className="w-full relative mt-36 mb-12">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent h-px" />
        </div>
    );
}
