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
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // 1. Detect device/mode
        const userAgent = window.navigator.userAgent.toLowerCase();
        // Check for mobile devices (including iPad which often requests desktop site by default)
        const mobile = /iphone|ipad|ipod|android/.test(userAgent) ||
            (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent)); // iPadOS 13+

        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        setIsMobile(mobile);
        setIsStandalone(standalone);

        // Allow bypassing the guard with ?bypass=true query param
        if (typeof window !== 'undefined' && window.location.search.includes('bypass=true')) {
            setIsStandalone(true);
        }

        setIsMounted(true);

        // 2. Listen for display-mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        // 3. Capture install prompt
        const handleInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleInstallPrompt);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // While checking or before mounting, show a completely blank white screen
    if (!isMounted) return <div className="fixed inset-0 bg-white z-[99999]" />;

    // Desktop -> render children
    if (!isMobile) return <>{children}</>;

    // Installed PWA -> render children
    if (isStandalone) return <>{children}</>;

    // Not installed Mobile -> Show Guide
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
        (navigator.maxTouchPoints > 1 && /macintosh/.test(window.navigator.userAgent.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
            <div className="max-w-sm w-full h-full flex flex-col items-center justify-center">
                {/* Brand Logo */}
                <div className="mb-12 relative">
                    <div className="p-8 rounded-[48px] bg-stone-50 shadow-inner">
                        <img src="/logo-symbol.svg" alt="App Logo" className="w-24 h-24 object-contain shadow-2xl rounded-2xl" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-stone-900 mb-8 tracking-tighter leading-tight">
                    전용 앱을 설치해주세요
                </h1>

                {/* iOS Logic: Always show Share guide, never buttons */}
                {isIOS && (
                    <div className="w-full bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-8 space-y-4">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                <Share size={20} />
                            </div>
                            <div className="text-sm font-bold text-stone-600">
                                1. 하단 <span className="text-stone-900">공유 버튼</span>을 누르세요
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 shrink-0">
                                <PlusSquare size={20} />
                            </div>
                            <div className="text-sm font-bold text-stone-600">
                                2. <span className="text-stone-900">홈 화면에 추가</span>를 선택하세요
                            </div>
                        </div>
                    </div>
                )}

                {/* Android Logic: Button ONLY if ready, else Manual Guide */}
                {!isIOS && deferredPrompt && (
                    <button
                        onClick={handleInstallClick}
                        className="mb-8 w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 animate-bounce hover:bg-blue-700 transition-colors"
                    >
                        <Download className="w-5 h-5" />
                        앱 설치하기
                    </button>
                )}

                {!isIOS && !deferredPrompt && (
                    <div className="w-full bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-8 space-y-4">
                        <div className="text-stone-500 text-sm font-bold">
                            자동 설치가 준비되지 않았습니다.<br />
                            브라우저 메뉴 <span className="bg-stone-200 px-1.5 rounded text-stone-800">[⋮]</span>에서<br />
                            <span className="text-stone-900 underline underline-offset-4 decoration-blue-500 decoration-2">앱 설치</span>를 눌러주세요.
                        </div>
                        <div className="flex flex-col items-center animate-pulse text-stone-300 mt-4">
                            <ArrowBigDown size={24} />
                        </div>
                    </div>
                )}
            </div>

            {/* iOS Floating Helper */}
            {isIOS && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100000] animate-in slide-in-from-bottom-20 duration-1000 w-max">
                    <div className="bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-2xl">
                        <Share className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-200">↓</span>
                        <span>여기를 눌러주세요</span>
                    </div>
                </div>
            )}

            {/* Debug Info Footer Removed */}
        </div>
    );
}
