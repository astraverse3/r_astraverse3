'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, BarChart3, ClipboardList } from 'lucide-react';

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-between h-16 px-6 z-40 lg:hidden pb-[env(safe-area-inset-bottom)]">
            <Link
                href="/"
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isActive('/') ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <LayoutDashboard className="w-6 h-6" />
                {isActive('/') && <span className="text-xs font-bold">홈</span>}
            </Link>

            <Link
                href="/stocks"
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isActive('/stocks') ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Package className="w-6 h-6" />
                <span className={`text-xs ${isActive('/stocks') ? 'font-bold' : 'font-medium'}`}>재고관리</span>
            </Link>

            <Link
                href="/milling"
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isActive('/milling') ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <ClipboardList className="w-6 h-6" />
                <span className={`text-xs ${isActive('/milling') ? 'font-bold' : 'font-medium'}`}>도정관리</span>
            </Link>

            <Link
                href="#"
                className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isActive('/stats') ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <BarChart3 className="w-6 h-6" />
                <span className="text-xs font-bold">통계</span>
            </Link>
        </nav>
    );
}
