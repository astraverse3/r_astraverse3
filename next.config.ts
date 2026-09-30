import type { NextConfig } from "next";
// next-pwa는 CommonJS 전용이라 require로 불러온다
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // 기본값(true)은 네트워크가 돌아올 때 페이지를 통째로 새로고침한다 — 창고에서 신호가 끊겼다
  // 붙으면 입력 중이던 포장 내역이 날아간다(백로그 §58). 연결 복구는 각 화면의 재시도에 맡긴다.
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development', // Disable PWA in dev
});

const cspPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https: http://k.kakaocdn.net http://*.kakaocdn.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: cspPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    return [
      { source: '/stocks', destination: '/raw-stocks', permanent: true },
      { source: '/stocks/:path*', destination: '/raw-stocks/:path*', permanent: true },
      { source: '/releases', destination: '/sales', permanent: true },
      { source: '/releases/:path*', destination: '/sales', permanent: true },
    ]
  },
};

export default withPWA(nextConfig);
