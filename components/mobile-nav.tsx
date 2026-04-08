'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Box, Clipboard, Compass, Activity, ArrowRightLeft, BarChart2, Layers, Package } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

const statsSubItems = [
    { href: '/statistics/milling', label: '수율 분석', icon: BarChart2 },
    { href: '/statistics/release', label: '출고분석', icon: Layers },
    { href: '/statistics/stock', label: '재고분석', icon: Package },
];

const navItems = [
    { href: '/', icon: Compass, label: '홈' },
    { href: '/stocks', icon: Box, label: '재고' },
    { href: '/milling', icon: Clipboard, label: '도정' },
    { href: '/releases', icon: ArrowRightLeft, label: '출고' },
    { href: '/statistics', icon: Activity, label: '통계' },
];

const BLOB_SIZE = 42;
const NAV_HEIGHT = 60;
const NAV_BG = '#ffffff';
const blobTop = (NAV_HEIGHT - BLOB_SIZE) / 2;

const getActiveIndex = (href: string) => {
    if (href.startsWith('/statistics')) return 4;
    const idx = navItems.findIndex((item) =>
        item.href === '/' ? href === '/' : href.startsWith(item.href)
    );
    return idx >= 0 ? idx : 0;
};

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();

    const [activeHref, setActiveHref] = useState(pathname);
    const [statsOpen, setStatsOpen] = useState(false);
    const [blobX, setBlobX] = useState(0);
    const [ready, setReady] = useState(false);

    const buttonRefs = useRef<(HTMLElement | null)[]>([]);

    const getTargetX = useCallback((index: number) => {
        const btn = buttonRefs.current[index];
        if (!btn) return 0;
        return btn.offsetLeft + btn.offsetWidth / 2 - BLOB_SIZE / 2;
    }, []);

    useEffect(() => {
        const x = getTargetX(getActiveIndex(pathname));
        setBlobX(x);
        setReady(true);
    }, [getTargetX, pathname]);

    useEffect(() => {
        setActiveHref(pathname);
        setStatsOpen(false);
        const x = getTargetX(getActiveIndex(pathname));
        setBlobX(x);
    }, [pathname, getTargetX]);

    const isActive = (href: string) => activeHref === href;
    const isStatsActive = activeHref.startsWith('/statistics');

    const handleNav = (href: string) => {
        setActiveHref(href);
        setBlobX(getTargetX(getActiveIndex(href)));
        router.push(href);
    };

    return (
        <>
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="nav-goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                        <feColorMatrix
                            in="blur" mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
                        />
                    </filter>
                </defs>
            </svg>

            <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-[env(safe-area-inset-bottom)] px-4 mb-4 pointer-events-none">
                <nav
                    className="relative flex items-center justify-between h-[60px] px-0 rounded-full pointer-events-auto mx-auto max-w-md"
                    style={{
                        background: NAV_BG,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                        border: '1px solid #cbd5e1',
                    }}
                >
                    {/* Goo blob 레이어 (흰 원) — overflow-hidden을 여기에만 적용 */}
                    <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none" style={{ filter: 'url(#nav-goo)' }}>
                        <div className="absolute rounded-full" style={{ background: '#2563eb',
                            width: BLOB_SIZE, height: BLOB_SIZE, top: blobTop, left: 0,
                            transform: `translateX(${blobX}px)`,
                            transition: ready ? 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                        }} />
                        <div className="absolute rounded-full" style={{ background: '#2563eb',
                            width: BLOB_SIZE, height: BLOB_SIZE, top: blobTop, left: 0,
                            transform: `translateX(${blobX}px)`,
                            transition: ready ? 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94) 0.06s' : 'none',
                        }} />
                    </div>

                    {/* 일반 메뉴 버튼 */}
                    {navItems.slice(0, 4).map((item, i) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.href}
                                ref={(el) => { buttonRefs.current[i] = el; }}
                                onClick={() => { handleNav(item.href); setStatsOpen(false); }}
                                className="relative flex items-center justify-center flex-1 h-full z-10 transition-transform active:scale-[0.92]"
                            >
                                <div className="flex flex-col items-center justify-center gap-[3px]">
                                    <Icon className={`transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                        active
                                            ? 'w-[18px] h-[18px] stroke-[2.5px] text-white'
                                            : 'w-[20px] h-[20px] stroke-[2px] text-slate-400'
                                    }`} />
                                    <span className={`tracking-tight leading-none transition-all duration-300 overflow-hidden ${
                                        active
                                            ? 'text-[0px] max-h-0 opacity-0 font-bold'
                                            : 'text-[9px] max-h-3 opacity-100 font-medium text-slate-400'
                                    }`}>
                                        {item.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}

                    {/* 통계 버튼 + 서브메뉴 */}
                    <div
                        ref={(el) => { buttonRefs.current[4] = el; }}
                        className="relative flex items-center justify-center flex-1 h-full"
                        onMouseEnter={() => setStatsOpen(true)}
                        onMouseLeave={() => setStatsOpen(false)}
                    >
                        {/* 서브메뉴 패널 */}
                        <div className={`absolute bottom-full right-0 mb-2 w-36 transition-all duration-300 ease-out origin-bottom-right z-30 ${
                            statsOpen
                                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                                : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                        }`}>
                            <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                <div className="p-1 flex flex-col gap-0.5">
                                    {statsSubItems.map((sub, si) => {
                                        const subActive = isActive(sub.href);
                                        const SubIcon = sub.icon;
                                        return (
                                            <button
                                                key={sub.href}
                                                onClick={() => { handleNav(sub.href); setStatsOpen(false); }}
                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 w-full text-left ${
                                                    statsOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                                                } ${subActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                                style={{ transitionDelay: statsOpen ? `${si * 50 + 40}ms` : '0ms' }}
                                            >
                                                <SubIcon className={`w-3.5 h-3.5 stroke-[2px] shrink-0 ${subActive ? 'text-blue-500' : 'text-slate-400'}`} />
                                                <span className={`text-xs ${subActive ? 'font-semibold' : 'font-medium'}`}>{sub.label}</span>
                                                {subActive && <span className="ml-auto w-1 h-1 rounded-full bg-blue-500 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 통계 버튼 */}
                        <button
                            onClick={() => {
                                setActiveHref('/statistics');
                                setBlobX(getTargetX(4));
                                setStatsOpen(true);
                            }}
                            className="relative flex items-center justify-center w-full h-full z-10 transition-transform active:scale-[0.92]"
                        >
                            <div className="flex flex-col items-center justify-center gap-[3px]">
                                <Activity className={`transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                    isStatsActive || statsOpen
                                        ? 'w-[18px] h-[18px] stroke-[2.5px] text-white'
                                        : 'w-[20px] h-[20px] stroke-[2px] text-slate-400'
                                }`} />
                                <span className={`tracking-tight leading-none transition-all duration-300 overflow-hidden ${
                                    isStatsActive || statsOpen
                                        ? 'text-[0px] max-h-0 opacity-0 font-bold'
                                        : 'text-[9px] max-h-3 opacity-100 font-medium text-slate-400'
                                }`}>
                                    통계
                                </span>
                            </div>
                        </button>
                    </div>
                </nav>
            </div>
        </>
    );
}
