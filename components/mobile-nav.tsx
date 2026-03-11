'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Clipboard, Compass, Activity, ArrowRightLeft } from 'lucide-react';

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-[env(safe-area-inset-bottom)] px-4 mb-4 pointer-events-none">
            <nav className="bg-white/90 backdrop-blur-md border border-slate-200/50 shadow-2xl flex items-center justify-between h-[68px] px-2 rounded-2xl pointer-events-auto mx-auto max-w-md">
                <Link
                    href="/"
                    className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all group relative"
                >
                    <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${isActive('/') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-700'}`}>
                        <Compass className={`w-[22px] h-[22px] transition-all duration-300 ${isActive('/') ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-110'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive('/') ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'}`}>홈</span>
                </Link>

                <Link
                    href="/stocks"
                    className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all group relative"
                >
                    <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${isActive('/stocks') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-700'}`}>
                        <Box className={`w-[22px] h-[22px] transition-all duration-300 ${isActive('/stocks') ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-110'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive('/stocks') ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'}`}>재고</span>
                </Link>

                <Link
                    href="/milling"
                    className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all group relative"
                >
                    <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${isActive('/milling') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-700'}`}>
                        <Clipboard className={`w-[22px] h-[22px] transition-all duration-300 ${isActive('/milling') ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-110'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive('/milling') ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'}`}>도정</span>
                </Link>

                <Link
                    href="/releases"
                    className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all group relative"
                >
                    <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${isActive('/releases') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-700'}`}>
                        <ArrowRightLeft className={`w-[22px] h-[22px] transition-all duration-300 ${isActive('/releases') ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-110'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive('/releases') ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'}`}>출고</span>
                </Link>

                <Link
                    href="/statistics"
                    className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all group relative"
                >
                    <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${isActive('/statistics') ? 'bg-blue-50 text-blue-600' : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-700'}`}>
                        <Activity className={`w-[22px] h-[22px] transition-all duration-300 ${isActive('/statistics') ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-110'}`} />
                    </div>
                    <span className={`text-[10px] tracking-tight transition-all duration-300 ${isActive('/statistics') ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'}`}>통계</span>
                </Link>
            </nav>
        </div>
    );
}
