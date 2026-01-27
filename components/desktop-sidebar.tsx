'use client';

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    Package,
    ClipboardList,
    Server,
    BarChart3
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
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200 group-hover:shadow-blue-300 transition-all flex-shrink-0">
                        <Server className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap overflow-visible group-hover:text-blue-600 transition-colors">
                            땅끝황토친환경
                        </span>
                        <span className="text-[10px] text-blue-600 font-medium tracking-wider">
                            IMS v2.4
                        </span>
                    </div>
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
                        href="#"
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                        <BarChart3 className="w-4 h-4" />
                        통계
                    </Link>
                </div>
            </div>
        </aside>
    );
}
