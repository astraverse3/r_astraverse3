import type { Metadata } from "next";
import "./globals.css";
import { PWAInstallGuard } from "@/components/pwa-install-guard"
import { SWRegister } from "@/components/sw-register"
import { Toaster } from "sonner"
import { Providers } from "@/components/providers/session-provider"
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/auth"

export const metadata: Metadata = {
  title: "땅끝황토친환경 - 도정 일지",
  description: "영농조합법인 땅끝황토친환경 도정 관리 시스템",
  manifest: "/manifest.json",
  icons: {
    apple: [
      { url: '/icon-192.png' },
      { url: '/icon-512.png', sizes: '512x512' }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "땅끝황토",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 초기 세션을 서버에서 받아 Providers로 내린다 — 이게 없으면 첫 렌더에서
  // useSession()이 undefined라 권한 있는 사용자도 「권한 없음」 화면을 먼저 본다.
  const session = await getServerSession(authOptions)

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 font-sans text-slate-900 selection:bg-blue-100">
        <SWRegister />
        <Providers session={session}>
          <PWAInstallGuard>
            {children}
          </PWAInstallGuard>
        </Providers>
        <ConfirmDialogHost />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
