'use client';

import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, ArrowBigDown } from 'lucide-react';

interface PWAInstallGuardProps {
    children: React.ReactNode;
}

export function PWAInstallGuard({ children }: PWAInstallGuardProps) {
    const [isStandalone, setIsStandalone] = useState<boolean>(true);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        // Check if running on mobile
        const checkMobile = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            return /iphone|ipad|ipod|android/.test(userAgent);
        };

        // Check if running in standalone mode (installed PWA)
        const checkStandalone = () => {
            return (
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
            );
        };

        setIsMobile(checkMobile());
        setIsStandalone(checkStandalone());

        // Listen for changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // SSR prevention
    if (!isMounted) return null;

    // On desktop or already installed, show the app normally
    if (!isMobile || isStandalone) {
        return <>{children}</>;
    }

    // Not installed on mobile - show the installation guide
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="max-w-md w-full animate-in fade-in zoom-in duration-700">
                <div className="flex justify-center mb-8">
                    <div className="p-5 rounded-[40px] bg-primary/5 shadow-inner">
                        <img src="/logo-symbol.svg" alt="Company Logo" className="w-20 h-20 object-contain shadow-2xl rounded-2xl" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-stone-900 mb-2 leading-tight">
                    땅끝황토친환경 <br />
                    <span className="text-gradient">도정일지 앱 설치</span>
                </h1>

                <p className="text-stone-500 mb-10 font-medium">
                    이 서비스는 보안과 원활한 사용을 위해 <br />
                    정식 앱 설치가 필수입니다.
                </p>

                <div className="space-y-4 mb-10">
                    <div className="glass p-6 rounded-[32px] border border-stone-100 flex flex-col items-center gap-4 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                            <Download className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-stone-900 mb-1">앱 설치 방법</div>
                            {isIOS ? (
                                <div className="text-sm text-stone-500 leading-relaxed font-medium">
                                    하단의 <span className="text-blue-500 font-bold inline-flex items-center gap-1"><Share className="w-4 h-4" /> [공유]</span> 버튼을 누르고<br />
                                    <span className="text-stone-900 font-bold"> [홈 화면에 추가]</span>를 선택해 주세요.
                                </div>
                            ) : (
                                <div className="text-sm text-stone-500 leading-relaxed font-medium">
                                    브라우저 상단 또는 하단의<br />
                                    <span className="text-stone-900 font-bold">[홈 화면에 추가]</span> 팝업을 선택하거나,<br />
                                    메뉴에서 <span className="text-stone-900 font-bold">[앱 설치]</span>를 눌러주세요.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center animate-bounce text-stone-300">
                    <span className="text-xs font-black uppercase tracking-widest mb-2">설치 안내 따라하기</span>
                    <ArrowBigDown className="w-6 h-6" />
                </div>
            </div>

            {/* Visual Guide Overlay for iOS */}
            {isIOS && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none animate-in slide-in-from-bottom-10 duration-1000">
                    <div className="bg-stone-900 text-white px-5 py-3 rounded-full text-sm font-bold flex items-center gap-3 shadow-2xl">
                        <Share className="w-5 h-5 text-blue-400" />
                        <span>[공유] → [홈 화면에 추가] 클릭</span>
                    </div>
                </div>
            )}
        </div>
    );
}
