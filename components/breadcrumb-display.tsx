'use client';

import { usePathname } from "next/navigation"
import { Fragment } from "react"

const ROUTE_NAME_MAP: Record<string, string> = {
    'stocks': '재고 관리',
    'milling': '도정내역',
    'new': '작업 등록',
    'releases': '출고 관리',
    'statistics': '통계',
    'admin': '관리자',
    'varieties': '품종 관리',
    'farmers': '생산자 관리',
    'users': '사용자 관리',
    'notices': '공지사항 관리',
    'logs': '활동 로그',
    'backup': '시스템 백업',
    'settings': '관리자 설정',
}

// 전체 경로 기준 마지막 세그먼트 이름 오버라이드
const PATH_TITLE_MAP: Record<string, string> = {
    '/statistics/milling':      '도정실적 분석',
    '/statistics/millingtype':  '도정구분별 분석',
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
    const pathTitle = PATH_TITLE_MAP[pathname];

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">도정관리시스템</span>
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                const name = (isLast && pathTitle) ? pathTitle : (ROUTE_NAME_MAP[segment] || segment);

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
