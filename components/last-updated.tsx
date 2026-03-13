'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getLatestUpdateForPath } from '@/app/actions/audit';

export function LastUpdated() {
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const pathname = usePathname();

    const fetchLatestTime = useCallback(async () => {
        if (!pathname) return;
        
        const result = await getLatestUpdateForPath(pathname);
        if (result.success && result.timestamp) {
            const date = new Date(result.timestamp);
            setLastUpdated(date.toLocaleTimeString('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }));
        } else if (result.success && result.timestamp === null) {
            setLastUpdated('기록 없음');
        }
    }, [pathname]);

    useEffect(() => {
        // Initial load
        fetchLatestTime();

        // Custom event for same-tab updates (when user mutates data)
        const handleDataUpdated = () => {
            fetchLatestTime();
        };

        window.addEventListener('data-updated', handleDataUpdated);

        // Listen for storage changes (works across tabs)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'last-updated-trigger') {
                fetchLatestTime();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('data-updated', handleDataUpdated);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [fetchLatestTime]);

    return (
        <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-medium font-mono">
                {lastUpdated ? (lastUpdated === '기록 없음' ? '최근 업데이트 기록 없음' : `최근 업데이트: ${lastUpdated}`) : '시간을 불러오는 중...'}
            </span>
        </div>
    );
}

// Utility function to trigger update
export function triggerDataUpdate() {
    // Write to localStorage to trigger 'storage' event in other tabs
    localStorage.setItem('last-updated-trigger', new Date().toISOString());
    // Dispatch local event for current tab
    window.dispatchEvent(new Event('data-updated'));
}
