'use client';

import { usePathname } from "next/navigation"
import { Fragment } from "react"

const ROUTE_NAME_MAP: Record<string, string> = {
    'stocks': '재고 관리',
    'milling': '도정내역',
    'new': '작업 등록',
    'releases': '출고 관리',
    'admin': '관리자',
    'varieties': '품종 관리',
    'farmers': '생산자 관리',
    'users': '사용자 관리',
}

export function BreadcrumbDisplay() {
    const pathname = usePathname();

    // Special case for root
    if (pathname === '/') {
        return (
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">도정관리시스템</span>
                <span className="text-sm text-slate-300">/</span>
                <span className="text-xl font-bold text-slate-900">실시간 현황</span>
            </div>
        )
    }

    const segments = pathname.split('/').filter(Boolean);

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">도정관리시스템</span>
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const name = ROUTE_NAME_MAP[segment] || segment;

                return (
                    <Fragment key={segment}>
                        <span className="text-sm text-slate-300">/</span>
                        <span className={`text-xl font-bold ${isLast ? 'text-slate-900' : 'text-slate-400'}`}>
                            {name}
                        </span>
                    </Fragment>
                )
            })}
        </div>
    );
}
