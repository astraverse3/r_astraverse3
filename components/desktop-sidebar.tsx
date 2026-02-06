'use client';

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Package,
    ClipboardList,
    Server,
    BarChart3,
    Truck
} from "lucide-react"

export function DesktopSidebar() {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === '/') {
            return pathname === path;
        }
        return pathname.startsWith(path);
    };

    return (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex-col">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-3 mb-10 px-2 group cursor-pointer">
                    <img src="/logo-full.png" alt="MILL LOG" className="h-10 w-auto object-contain" />
                </Link>

                <div className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Main Menu</p>

                    <Link
                        href="/stocks"
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/stocks')
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <Package className="w-4 h-4" />
                        재고관리
                    </Link>

                    <Link
                        href="/milling"
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/milling')
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        도정관리
                    </Link>

                    <Link
                        href="/releases"
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/releases')
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <Truck className="w-4 h-4" />
                        출고관리
                    </Link>

                    <Link
                        href="#"
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                        <BarChart3 className="w-4 h-4" />
                        통계
                    </Link>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                        Management
                    </p>
                    <div className="space-y-1">
                        <div className="group">
                            <div className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 transition-colors ${isActive('/admin') ? 'bg-slate-50 text-slate-900' : ''}`}>
                                <Server className="w-4 h-4" />
                                <span>관리자 설정</span>
                            </div>
                            <div className="pl-10 mt-1 space-y-1">
                                <Link
                                    href="/admin/varieties"
                                    className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/varieties')
                                        ? 'text-blue-600 bg-blue-50'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`}
                                >
                                    품종 관리
                                </Link>
                                <Link
                                    href="/admin/farmers"
                                    className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/farmers')
                                        ? 'text-blue-600 bg-blue-50'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`}
                                >
                                    생산자 관리
                                </Link>
                                <Link
                                    href="/admin"
                                    className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${pathname === '/admin'
                                        ? 'text-blue-600 bg-blue-50'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`}
                                >
                                    시스템 백업
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
