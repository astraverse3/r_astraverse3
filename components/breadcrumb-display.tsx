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
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="opacity-50">도정관리시스템</span>
            <span className="opacity-30">/</span>
            <span>{pageName}</span>
        </div>
    );
}
