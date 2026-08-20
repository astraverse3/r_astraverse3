'use client';

import { useEffect } from 'react';

/**
 * 서비스워커 등록 — 프로덕션 전용.
 *
 * next.config의 next-pwa가 `disable: NODE_ENV === 'development'`로 dev에서 sw 생성을 끄는데,
 * 예전 이 컴포넌트는 환경 구분 없이 `/sw.js`를 등록해 그 설정을 우회했다. public/sw.js가
 * 저장소에 남아 있으면 dev 서버가 그 낡은 파일을 그대로 서빙하고, 등록된 sw가 JS 청크를
 * StaleWhileRevalidate로 캐싱해 **코드를 고쳐도 화면이 안 바뀌는** 상태가 된다(2026-08-20 실제 발생).
 * dev에서는 등록하지 않고, 이미 등록돼 있으면 해제한다.
 */
export function SWRegister() {
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        if (process.env.NODE_ENV !== 'production') {
            // 과거 dev 등록분 정리 — 남아 있으면 캐시가 계속 개입한다
            navigator.serviceWorker.getRegistrations().then((regs) => {
                for (const reg of regs) void reg.unregister();
            });
            return;
        }

        const wb = (window as unknown as { workbox?: { register: () => void } }).workbox;
        if (wb !== undefined) {
            wb.register();
            return;
        }
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.error('SW Registration failed: ', error);
        });
    }, []);

    return null;
}
