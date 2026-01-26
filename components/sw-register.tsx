'use client';

import { useEffect } from 'react';

export function SWRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator && (window as any).workbox !== undefined) {
            const wb = (window as any).workbox;
            // Force registration
            wb.register();
        } else if ('serviceWorker' in navigator) {
            // Fallback manual registration
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    console.log('SW Registered manually: ', registration);
                })
                .catch((error) => {
                    console.error('SW Registration failed: ', error);
                    alert(`SW Error: ${error.message}`);
                });
        }
    }, []);

    return null;
}
