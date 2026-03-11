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
    const [isInstalling, setIsInstalling] = useState(false);
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);

    useEffect(() => {
        // 1. Detect device/mode
        const userAgent = window.navigator.userAgent.toLowerCase();
        // Check for mobile devices (including iPad which often requests desktop site by default)
        const mobile = /iphone|ipad|ipod|android/.test(userAgent) ||
            (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent)); // iPadOS 13+

        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        const inApp = /kakao|naver|instagram|fb_iab|line|twitter/i.test(userAgent);

        setIsMobile(mobile);
        setIsStandalone(standalone);
        setIsInAppBrowser(inApp);

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
        setIsInstalling(true); // Hide manual guide immediately
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        } else {
            setIsInstalling(false); // Show manual guide again if rejected
        }
    };

    // While checking or before mounting, show a completely blank white screen
    if (!isMounted) return <div className="fixed inset-0 bg-white z-[99999]" />;

    // Desktop -> render children
    if (!isMobile) return <>{children}</>;

    // Installed PWA -> render children
    if (isStandalone) return <>{children}</>;

    // In-App Browser Guide
    if (isInAppBrowser) {
        return (
            <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
                <div className="max-w-sm w-full h-full flex flex-col items-center justify-center -mt-10">
                    <div className="mb-8 relative">
                        <div className="p-5 rounded-[32px] bg-red-50 shadow-inner border border-red-100">
                            <Share className="w-12 h-12 text-red-500" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-black text-stone-900 mb-4 tracking-tighter leading-tight">
                        현재 브라우저에서는<br />앱 설치가 불가능합니다
                    </h1>

                    <p className="text-stone-500 text-sm font-medium mb-10 leading-relaxed">
                        카카오톡, 네이버, 인스타그램 등의 앱에서는<br />
                        보안상 <strong className="text-stone-800">홈 화면에 추가</strong> 기능을 지원하지 않습니다.
                    </p>

                    <div className="w-full bg-stone-50 p-6 rounded-2xl border border-stone-100 mb-8 space-y-5 text-left shadow-sm">
                        <div className="text-sm font-bold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <span>💡</span> 이렇게 해결해보세요
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 text-xs font-black mt-0.5">
                                1
                            </div>
                            <div className="text-sm font-medium text-stone-600 leading-relaxed pt-0.5">
                                화면 하단 또는 상단의 <span className="font-bold text-stone-900">[⋮] 메뉴</span> 혹은 <span className="font-bold text-stone-900">공유</span> 버튼을 누르세요.
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 text-xs font-black mt-0.5">
                                2
                            </div>
                            <div className="text-sm font-medium text-stone-600 leading-relaxed pt-0.5">
                                <span className="font-bold text-stone-900 text-blue-600 tracking-tight">Safari로 열기</span> (iOS) 또는 <span className="font-bold text-stone-900 text-blue-600 tracking-tight">다른 브라우저로 열기</span> (Android)를 선택해주세요.
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            if (navigator.clipboard) {
                                navigator.clipboard.writeText(window.location.href);
                                alert("링크가 복사되었습니다.\nSafari 또는 Chrome 브라우저에서 붙여넣기 해주세요.");
                            } else {
                                // Fallback
                                const el = document.createElement('textarea');
                                el.value = window.location.href;
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand('copy');
                                document.body.removeChild(el);
                                alert("링크가 복사되었습니다.\nSafari 또는 Chrome 브라우저에서 붙여넣기 해주세요.");
                            }
                        }}
                        className="w-full bg-stone-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-stone-900/20 flex items-center justify-center gap-2 hover:bg-stone-800 transition-all active:scale-[0.98]"
                    >
                        현재 주소 링크 복사하기
                    </button>

                    <button
                        onClick={() => setIsInAppBrowser(false)}
                        className="mt-6 text-sm font-bold text-stone-400 underline underline-offset-4 decoration-stone-300 hover:text-stone-600 transition-colors"
                    >
                        일단 웹으로 계속 볼게요
                    </button>
                </div>
            </div>
        );
    }

    // Not installed Mobile -> Show Guide
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
        (navigator.maxTouchPoints > 1 && /macintosh/.test(window.navigator.userAgent.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
            <div className="max-w-sm w-full h-full flex flex-col items-center justify-center">
                {/* Brand Logo */}
                <div className="mb-12 relative">
                    <div className="p-8 rounded-[48px] bg-stone-50 shadow-inner">
                        <img src="/logo-full.png" alt="App Logo" className="w-56 h-auto object-contain" />
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

                {!isIOS && !deferredPrompt && !isInstalling && (
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

                {/* Local Development Bypass Button */}
                {process.env.NODE_ENV === 'development' && (
                    <button
                        onClick={() => setIsStandalone(true)}
                        className="mt-4 text-xs font-bold text-stone-400 underline underline-offset-4 decoration-stone-300 hover:text-stone-600 transition-colors"
                    >
                        개발 모드 강제 진입하기 🚀
                    </button>
                )}
            </div>

            {/* iOS Floating Helper */}
            {isIOS && (
                <div
                    onClick={() => alert("현재 누르신 말풍선이 아니라, 스마트폰 화면 맨 아래에 있는 'Safari 브라우저의 실제 공유 버튼(네모 박스 위로 화살표 모양)'을 눌러주세요!")}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100000] animate-in slide-in-from-bottom-20 duration-1000 w-max cursor-pointer"
                >
                    <div className="bg-stone-900 text-white px-5 py-3 rounded-full text-sm font-bold flex flex-col items-center gap-1 shadow-2xl animate-bounce border border-stone-700">
                        <span>화면 맨 아래 공유 버튼을 누르세요</span>
                        <div className="text-blue-400 text-lg font-black leading-none">↓</div>
                    </div>
                </div>
            )}

            {/* Debug Info Footer Removed */}
        </div>
    );
}
