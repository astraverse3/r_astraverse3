'use client';

import { usePathname } from "next/navigation"

const PAGE_NAMES: Record<string, string> = {
    '/stocks': '재고 관리',
    '/milling': '도정 관리',
    '/admin/varieties': '품종 관리',
    '/admin/farmers': '생산자 관리',
}

export function BreadcrumbDisplay() {
    const pathname = usePathname();
    const pageName = PAGE_NAMES[pathname] || '도정관리시스템';

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">도정관리시스템</span>
            <span className="text-sm text-slate-300">/</span>
            <span className="text-xl font-bold text-slate-900">{pageName}</span>
        </div>
    );
}
