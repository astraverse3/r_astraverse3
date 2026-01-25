'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, ArrowBigDown, PlusSquare } from 'lucide-react';

interface PWAInstallGuardProps {
    children: React.ReactNode;
}

export function PWAInstallGuard({ children }: PWAInstallGuardProps) {
    const [isStandalone, setIsStandalone] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        // 1. Detect device/mode
        const userAgent = window.navigator.userAgent.toLowerCase();
        const mobile = /iphone|ipad|ipod|android/.test(userAgent);

        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        setIsMobile(mobile);
        setIsStandalone(standalone);
        setIsMounted(true);

        // 2. Listen for display-mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // While checking or before mounting, show a completely blank white screen
    // This prevents any "flash" of the app content
    if (!isMounted) {
        return <div className="fixed inset-0 bg-white z-[99999]" />;
    }

    // On desktop, render children normally
    if (!isMobile) {
        return <>{children}</>;
    }

    // On mobile, if already installed as PWA, render children normally
    if (isStandalone) {
        return <>{children}</>;
    }

    // If on mobile but NOT installed, HERO guide (No children rendered)
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    return (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
            <div className="max-w-sm w-full h-full flex flex-col items-center justify-center">
                {/* Brand Logo */}
                <div className="mb-12 relative">
                    <div className="p-8 rounded-[48px] bg-stone-50 shadow-inner">
                        <img src="/logo-symbol.svg" alt="Company Logo" className="w-24 h-24 object-contain shadow-2xl rounded-2xl" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-full shadow-xl">
                        <PlusSquare size={22} strokeWidth={3} />
                    </div>
                </div>

                <h1 className="text-3xl font-black text-stone-900 mb-4 tracking-tighter leading-tight">
                    땅끝황토친환경 <br />
                    <span className="text-gradient">전용 앱 설치안내</span>
                </h1>

                <p className="text-stone-400 mb-12 font-bold text-sm leading-relaxed">
                    보안 지침에 따라 모바일에서는 <br />
                    반드시 <span className="text-stone-900 underline decoration-primary decoration-4 underline-offset-4">공식 앱</span>으로 접속해야 합니다.
                </p>

                {/* Installation Steps Card */}
                <div className="w-full glass p-8 rounded-[40px] border border-stone-100 shadow-sm mb-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-primary/20" />

                    <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 mx-auto mb-6">
                        <Download className="w-7 h-7" />
                    </div>

                    <div className="font-extrabold text-stone-900 text-lg mb-6">설치 방법</div>

                    {isIOS ? (
                        <div className="text-stone-500 leading-loose font-bold text-sm space-y-2">
                            <p>1. 하단 중앙의 <span className="text-blue-500 inline-flex items-center gap-1 bg-blue-50 px-2 rounded-md"><Share size={14} /> [공유]</span> 클릭</p>
                            <p>2. 메뉴에서 <span className="text-stone-900 bg-stone-100 px-2 rounded-md">[홈 화면에 추가]</span> 클릭</p>
                        </div>
                    ) : (
                        <div className="text-stone-500 leading-loose font-bold text-sm space-y-2">
                            <p>1. 상단 또는 메뉴의 <span className="text-stone-900 bg-stone-100 px-2 rounded-md">[⋮]</span> 버튼 클릭</p>
                            <p>2. <span className="text-stone-900 bg-stone-100 px-2 rounded-md">[앱 설치]</span> 또는 <span className="text-stone-900 bg-stone-100 px-2 rounded-md">[홈 화면 추가]</span> 클릭</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center animate-bounce text-stone-200">
                    <ArrowBigDown size={32} />
                </div>
            </div>

            {/* Floating IOS Helper */}
            {isIOS && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100000] animate-in slide-in-from-bottom-20 duration-1000">
                    <div className="bg-stone-900 text-white px-8 py-4 rounded-full text-base font-black flex items-center gap-4 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-white/10">
                        <Share className="w-6 h-6 text-blue-400 animate-pulse" />
                        <span>[공유] → [홈 화면에 추가]</span>
                    </div>
                    <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-stone-900 mx-auto -mt-1" />
                </div>
            )}
        </div>
    );
}
