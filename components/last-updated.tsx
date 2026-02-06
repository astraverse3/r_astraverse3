'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export function LastUpdated() {
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        // Function to update state from localStorage
        const updateTimestamp = () => {
            const stored = localStorage.getItem('last-updated');
            if (stored) {
                const date = new Date(stored);
                setLastUpdated(date.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }));
            }
        };

        // Initial load
        updateTimestamp();

        // Listen for storage changes (works across tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'last-updated') {
                updateTimestamp();
            }
        });

        // Custom event for same-tab updates
        window.addEventListener('data-updated', updateTimestamp);

        return () => {
            window.removeEventListener('storage', updateTimestamp);
            window.removeEventListener('data-updated', updateTimestamp);
        };
    }, []);

    return (
        <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw className="w-3 h-3 animate-pulse" />
            <span className="text-[10px] font-medium font-mono">
                {lastUpdated ? `최근 업데이트: ${lastUpdated}` : '업데이트 정보 없음'}
            </span>
        </div>
    );
}

// Utility function to trigger update
export function triggerDataUpdate() {
    const now = new Date().toISOString();
    localStorage.setItem('last-updated', now);
    window.dispatchEvent(new Event('data-updated'));
}
