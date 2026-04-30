'use client';

import { usePathname, useSearchParams } from "next/navigation"
import {
    Home,
    Leaf,
    Users,
    Megaphone,
    History,
    Database,
    Settings,
} from "lucide-react"
import {
    RawStockIcon,
    MillingIcon,
    PackageIcon,
    SalesIcon,
    StatsIcon,
} from "@/components/icons/duotone"

// Set C 듀오톤 아이콘과 lucide 아이콘이 공유하는 최소 prop 인터페이스
type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>

type BreadcrumbConfig = {
    icon: IconComponent
    title: string
    description?: string
}

// path → 페이지 구성. 정확 매치 우선, 실패 시 긴 prefix 매치.
// 핵심 5개 메뉴는 Set C 듀오톤 (handoff.md §2.2), 그 외는 lucide-react.
const PAGE_CONFIG: Record<string, BreadcrumbConfig> = {
    '/': { icon: Home, title: '실시간 현황' },

    '/raw-stocks': {
        icon: RawStockIcon,
        title: '원물재고',
        description: '벼·잡곡 원물 입고 및 도정 전 재고를 관리합니다.',
    },

    '/milling': {
        icon: MillingIcon,
        title: '도정관리',
        description: '벼 도정 작업을 등록하고 출고량을 기록합니다.',
    },
    '/milling/new': {
        icon: MillingIcon,
        title: '도정관리',
        description: '새로운 도정 작업을 등록합니다.',
    },

    '/packages': {
        icon: PackageIcon,
        title: '제품재고',
        description: '제품으로 포장된 재고를 품목별로 조회하고, 매입·포장 내역을 관리합니다.',
    },

    '/sales': {
        icon: SalesIcon,
        title: '판매관리',
        description: '출고 및 판매 내역을 관리합니다.',
    },
    '/releases': {
        icon: SalesIcon,
        title: '출고 관리',
        description: '출고 내역을 관리합니다.',
    },

    '/statistics': {
        icon: StatsIcon,
        title: '통계',
        description: '수율·재고·판매 지표를 분석합니다.',
    },
    '/statistics/milling': { icon: StatsIcon, title: '수율분석' },
    '/statistics/millingtype': { icon: StatsIcon, title: '도정구분별 분석' },
    '/statistics/stock': { icon: StatsIcon, title: '재고분석' },
    '/statistics/output': { icon: StatsIcon, title: '판매분석' },

    '/admin/varieties': { icon: Leaf, title: '품종 관리' },
    '/admin/farmers': { icon: Users, title: '생산자 관리' },
    '/admin/users': { icon: Users, title: '사용자 관리' },
    '/admin/notices': { icon: Megaphone, title: '공지사항 관리' },
    '/admin/logs': { icon: History, title: '활동 로그' },
    '/admin/backup': { icon: Database, title: '시스템 백업' },
    '/admin/settings': { icon: Settings, title: '관리자 설정' },
}

// URL query "?tab=xxx" → 브레드크럼 서브컨텍스트 라벨
const TAB_LABEL_MAP: Record<string, string> = {
    rice: '벼',
    misc: '잡곡',
    release: '출고',
}

// path별 기본 탭 — URL에 ?tab= 쿼리가 없을 때 추론할 값.
// 예) /raw-stocks 직접 진입 시 자동으로 '벼'를 서브컨텍스트로 표시.
const PATH_DEFAULT_TAB: Record<string, string> = {
    '/raw-stocks': 'rice',
}

function resolveConfig(pathname: string): BreadcrumbConfig | null {
    if (PAGE_CONFIG[pathname]) return PAGE_CONFIG[pathname]
    const match = Object.keys(PAGE_CONFIG)
        .filter(key => key !== '/' && pathname.startsWith(key))
        .sort((a, b) => b.length - a.length)[0]
    return match ? PAGE_CONFIG[match] : null
}

export function BreadcrumbDisplay() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const config = resolveConfig(pathname)

    if (!config) {
        const last = pathname.split('/').filter(Boolean).pop() ?? ''
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-bold text-slate-900 truncate">{last}</span>
            </div>
        )
    }

    const Icon = config.icon
    const tab = searchParams.get('tab') || PATH_DEFAULT_TAB[pathname] || null
    const subContext = tab ? TAB_LABEL_MAP[tab] : null

    return (
        <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon className="w-4 h-4 text-slate-700 shrink-0" strokeWidth={1.8} />
            <span className="text-base font-bold text-slate-900 shrink-0">
                {config.title}
            </span>
            {subContext && (
                <>
                    <span className="text-sm text-slate-300 shrink-0">/</span>
                    <span className="text-sm font-medium text-slate-600 shrink-0">
                        {subContext}
                    </span>
                </>
            )}
            {config.description && (
                <>
                    <span className="text-sm text-slate-300 shrink-0">·</span>
                    <span className="text-xs text-slate-500 truncate min-w-0">
                        {config.description}
                    </span>
                </>
            )}
        </div>
    )
}
