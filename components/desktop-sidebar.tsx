'use client';

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    Home,
    Server,
    Leaf,
    Users,
    ChevronDown,
    ChevronRight,
} from "lucide-react"
import {
    RawStockIcon,
    MillingIcon,
    PackageIcon,
    SalesIcon,
    StatsIcon,
} from "@/components/icons/duotone"
import { hasPermission, hasAnyPermission } from "@/lib/permissions"

type IconComponent = React.ComponentType<{
    className?: string
    strokeWidth?: number
    active?: boolean
}>

type MainMenuItem = {
    href: string
    label: string
    icon: IconComponent
    duotone?: boolean
}

const MAIN_MENU: MainMenuItem[] = [
    { href: '/', label: '홈', icon: Home },
    { href: '/raw-stocks', label: '원물재고', icon: RawStockIcon, duotone: true },
    { href: '/milling', label: '도정관리', icon: MillingIcon, duotone: true },
    { href: '/packages', label: '제품재고', icon: PackageIcon, duotone: true },
    { href: '/sales', label: '판매관리', icon: SalesIcon, duotone: true },
]

const STATS_SUB = [
    { href: '/statistics/milling', label: '수율분석' },
    { href: '/statistics/stock', label: '재고분석' },
    { href: '/statistics/output', label: '판매분석' },
]

export function DesktopSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    // @ts-ignore
    const user = session?.user as { role?: string; permissions?: string[] } | undefined;

    const isActive = (path: string) => {
        if (path === '/') {
            return pathname === path;
        }
        return pathname.startsWith(path);
    };

    // 서브메뉴 자동펼침: 현재 경로가 해당 섹션 하위면 펼침 + 화살표 클릭으로 토글.
    const statsActive = isActive('/statistics');
    const adminActive = isActive('/admin') && !isActive('/admin/varieties') && !isActive('/admin/farmers');
    const [statsOpen, setStatsOpen] = useState(statsActive);
    const [adminOpen, setAdminOpen] = useState(adminActive);

    // 사이드바는 layout에 상주해 경로 이동 시 useState 초기값이 재평가되지 않으므로,
    // 해당 섹션 경로로 진입하면 자동으로 펼친다.
    useEffect(() => {
        if (statsActive) setStatsOpen(true);
    }, [statsActive]);
    useEffect(() => {
        if (adminActive) setAdminOpen(true);
    }, [adminActive]);

    return (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
                <Link href="/" className="flex items-center gap-3 mb-10 px-2 group cursor-pointer">
                    <img src="/logo-full.png" alt="MILL LOG" className="h-10 w-auto object-contain" />
                </Link>

                <div className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Main Menu</p>

                    {MAIN_MENU.map(item => {
                        const active = isActive(item.href)
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    active
                                        ? 'bg-blue-50 text-primary'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <Icon
                                    className="w-4 h-4 shrink-0"
                                    strokeWidth={1.8}
                                    {...(item.duotone ? { active } : {})}
                                />
                                {item.label}
                            </Link>
                        )
                    })}

                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setStatsOpen(v => !v)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/statistics') ? 'text-primary' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <StatsIcon
                                className="w-4 h-4 shrink-0"
                                strokeWidth={1.8}
                                active={isActive('/statistics')}
                            />
                            <span className="flex-1 text-left">통계</span>
                            {statsOpen
                                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                        {statsOpen && (
                            <div className="pl-10 mt-1 space-y-1">
                                {STATS_SUB.map(sub => (
                                    <Link
                                        key={sub.href}
                                        href={sub.href}
                                        className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                                            isActive(sub.href)
                                                ? 'text-primary bg-blue-50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`}
                                    >
                                        {sub.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                        Management
                    </p>
                    <div className="space-y-1">
                        <Link
                            href="/admin/varieties"
                            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/varieties')
                                ? 'bg-blue-50 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <Leaf className="w-4 h-4" />
                            품종 관리
                        </Link>
                        <Link
                            href="/admin/farmers"
                            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/admin/farmers')
                                ? 'bg-blue-50 text-primary'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            생산자 관리
                        </Link>
                        {hasAnyPermission(user, ['SALES_MANAGE', 'USER_MANAGE', 'NOTICE_MANAGE', 'SYSTEM_MANAGE']) && (
                        <div className="group pt-1">
                            <button
                                type="button"
                                onClick={() => setAdminOpen(v => !v)}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-50 transition-colors ${adminActive ? 'bg-slate-50 text-slate-900' : ''}`}
                            >
                                <Server className="w-4 h-4" />
                                <span className="flex-1 text-left">관리자 메뉴</span>
                                {adminOpen
                                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                            {adminOpen && (
                            <div className="pl-10 mt-1 space-y-1">
                                {hasPermission(user, 'SALES_MANAGE') && (
                                    <Link
                                        href="/admin/product-types"
                                        className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/product-types')
                                            ? 'text-primary bg-blue-50'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                            }`}
                                    >
                                        제품유형 관리
                                    </Link>
                                )}
                                {hasPermission(user, 'USER_MANAGE') && (
                                    <Link
                                        href="/admin/users"
                                        className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/users')
                                            ? 'text-primary bg-blue-50'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                            }`}
                                    >
                                        사용자 관리
                                    </Link>
                                )}
                                {hasPermission(user, 'NOTICE_MANAGE') && (
                                    <Link
                                        href="/admin/notices"
                                        className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/notices')
                                            ? 'text-primary bg-blue-50'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                            }`}
                                    >
                                        공지사항 관리
                                    </Link>
                                )}
                                {hasPermission(user, 'SYSTEM_MANAGE') && (
                                    <>
                                        <Link
                                            href="/admin/logs"
                                            className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/logs')
                                                ? 'text-primary bg-blue-50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                                }`}
                                        >
                                            활동 로그
                                        </Link>
                                        <Link
                                            href="/admin/backup"
                                            className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/backup')
                                                ? 'text-primary bg-blue-50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                                }`}
                                        >
                                            시스템 백업
                                        </Link>
                                    </>
                                )}
                                {user?.role === 'ADMIN' && (
                                    <Link
                                        href="/admin/settings"
                                        className={`block text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${isActive('/admin/settings')
                                            ? 'text-primary bg-blue-50'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                            }`}
                                    >
                                        관리자 설정
                                    </Link>
                                )}
                            </div>
                            )}
                        </div>
                        )}
                    </div>
                </div>

            </div>

        </aside>
    );
}
