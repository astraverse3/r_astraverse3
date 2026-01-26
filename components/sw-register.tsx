'use client';

import { useEffect } from 'react';

export function SWRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator && window.workbox !== undefined) {
            const wb = window.workbox;
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
                });
        }
    }, []);

    return null;
}
