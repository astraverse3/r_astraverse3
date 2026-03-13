'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Clipboard, Compass, Activity, ArrowRightLeft } from 'lucide-react';

export function MobileNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    const navItems = [
        { href: '/', icon: Compass, label: '홈' },
        { href: '/stocks', icon: Box, label: '재고' },
        { href: '/milling', icon: Clipboard, label: '도정관리' },
        { href: '/releases', icon: ArrowRightLeft, label: '출고관리' },
        { href: '/statistics', icon: Activity, label: '통계' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-[env(safe-area-inset-bottom)] px-4 mb-4 pointer-events-none">
            <nav className="bg-white/90 backdrop-blur-md border border-slate-200/50 shadow-2xl flex items-center justify-between h-[68px] px-2 rounded-2xl pointer-events-auto mx-auto max-w-md">
                {navItems.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 group relative -webkit-tap-highlight-color-transparent transition-transform active:scale-[0.95]`}
                        >
                            <div className="relative flex flex-col items-center justify-center w-full">
                                {/* 호버 시에만 아이콘 뒤로 살짝 겹치는 아주 연한 회파란색 원 (버블 효과 모티브) */}
                                {!active && (
                                    <div className="absolute top-1/2 left-1/2 -translate-x-[70%] -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 opacity-0 group-hover:opacity-100 group-hover:-translate-x-1/2 transition-all duration-300 pointer-events-none" />
                                )}
                                
                                {/* 아이콘 영역 */}
                                <div className={`flex flex-col items-center justify-center w-12 h-8 rounded-xl transition-colors duration-300 relative z-10 ${
                                    active ? 'text-blue-600 bg-blue-50/80 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]' : 'text-slate-400 group-hover:text-slate-700'
                                }`}>
                                    <Icon className={`w-[22px] h-[22px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                        active ? 'stroke-[2.5px] scale-110' : 'stroke-[2px] group-hover:scale-[1.15]'
                                    }`} />
                                </div>
                                
                                {/* 텍스트 라벨 (위치 고정, 색상만 부드럽게 변환) */}
                                <span className={`text-[10px] tracking-tight transition-colors duration-300 mt-[1px] ${
                                    active ? 'font-bold text-blue-700' : 'font-medium text-slate-500 group-hover:text-slate-700'
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
