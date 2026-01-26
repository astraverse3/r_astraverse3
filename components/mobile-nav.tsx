'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, BarChart3, ClipboardList } from 'lucide-react';

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around h-20 px-4 z-40 lg:hidden pb-[env(safe-area-inset-bottom)]">
            <Link
                href="/"
                className={`flex flex-col items-center gap-1 p-2 ${isActive('/') ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <LayoutDashboard className="w-6 h-6" />
                <span className="text-[10px] font-bold">홈</span>
            </Link>

            <Link
                href="/stocks"
                className={`flex flex-col items-center gap-1 p-2 ${isActive('/stocks') ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <Package className="w-6 h-6" />
                <span className="text-[10px] font-bold">재고</span>
            </Link>

            <Link
                href="/milling"
                className={`flex flex-col items-center gap-1 p-2 ${isActive('/milling') ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <ClipboardList className="w-6 h-6" />
                <span className="text-[10px] font-bold">도정</span>
            </Link>

            <Link
                href="#"
                className={`flex flex-col items-center gap-1 p-2 ${isActive('/stats') ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <BarChart3 className="w-6 h-6" />
                <span className="text-[10px] font-bold">통계</span>
            </Link>
        </nav>
    );
}
