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
        if (!deferredPrompt) {
            alert("브라우저 메뉴의 [홈 화면에 추가] 또는 [앱 설치]를 눌러주세요.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

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
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()) ||
        (navigator.maxTouchPoints > 1 && /macintosh/.test(window.navigator.userAgent.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
            <div className="max-w-sm w-full h-full flex flex-col items-center justify-center">
                {/* Brand Logo */}
                <div className="mb-12 relative">
                    <div className="p-8 rounded-[48px] bg-stone-50 shadow-inner">
                        {/* Use PNG for better compatibility */}
                        {/* Use PNG for better compatibility and fallback */}
                        <img src="/icon-512.png" alt="App Logo" className="w-24 h-24 object-contain shadow-2xl rounded-2xl" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-full shadow-xl">
                        <PlusSquare size={22} strokeWidth={3} />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-stone-900 mb-8 tracking-tighter leading-tight">
                    전용 앱을 설치해주세요
                </h1>

                {/* Simplified text removal */}{/* Simplified text removal */}

                {/* Install Button (Always Visible) */}
                <button
                    onClick={handleInstallClick}
                    className="mb-8 w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 animate-bounce hover:bg-blue-700 transition-colors"
                >
                    <Download className="w-5 h-5" />
                    앱 설치하기
                </button>

                {/* Installation Steps Removed as per request */}

                <div className="flex flex-col items-center animate-pulse text-stone-300">
                    <ArrowBigDown size={32} />
                </div>
            </div>

            {/* Floating IOS Helper */}
            {isIOS && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100000] animate-in slide-in-from-bottom-20 duration-1000 w-max max-w-[90%]">
                    <div className="bg-stone-900 text-white px-6 py-4 rounded-full text-sm font-black flex items-center gap-3 shadow-[0_30px_60px_rgba(0,0,0,0.4)] border border-white/10">
                        <Share className="w-5 h-5 text-blue-400 animate-pulse shrink-0" />
                        <span>[공유] → [홈 화면에 추가]</span>
                    </div>
                    <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-stone-900 mx-auto -mt-1" />
                </div>
            )}
        </div>
    );
}
