'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Clipboard, Compass, Activity, ArrowRightLeft } from 'lucide-react';

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-between h-14 px-3 z-40 lg:hidden pb-[env(safe-area-inset-bottom)]">
            <Link
                href="/"
                className={`flex flex-row items-center justify-center h-full px-2 gap-1.5 transition-colors ${isActive('/') ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Compass className="w-[16px] h-[16px] stroke-[2px]" />
                <span className={`text-[11px] ${isActive('/') ? 'font-bold' : 'font-medium'}`}>홈</span>
            </Link>

            <Link
                href="/stocks"
                className={`flex flex-row items-center justify-center h-full px-2 gap-1.5 transition-colors ${isActive('/stocks') ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Box className="w-[16px] h-[16px] stroke-[2px]" />
                <span className={`text-[11px] ${isActive('/stocks') ? 'font-bold' : 'font-medium'}`}>재고</span>
            </Link>

            <Link
                href="/milling"
                className={`flex flex-row items-center justify-center h-full px-2 gap-1.5 transition-colors ${isActive('/milling') ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Clipboard className="w-[16px] h-[16px] stroke-[2px]" />
                <span className={`text-[11px] ${isActive('/milling') ? 'font-bold' : 'font-medium'}`}>도정</span>
            </Link>

            <Link
                href="/releases"
                className={`flex flex-row items-center justify-center h-full px-2 gap-1.5 transition-colors ${isActive('/releases') ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <ArrowRightLeft className="w-[16px] h-[16px] stroke-[2px]" />
                <span className={`text-[11px] ${isActive('/releases') ? 'font-bold' : 'font-medium'}`}>출고</span>
            </Link>

            <Link
                href="/statistics"
                className={`flex flex-row items-center justify-center h-full px-2 gap-1.5 transition-colors ${isActive('/statistics') ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Activity className="w-[16px] h-[16px] stroke-[2px]" />
                <span className={`text-[11px] ${isActive('/statistics') ? 'font-bold' : 'font-medium'}`}>통계</span>
            </Link>
        </nav>
    );
}
