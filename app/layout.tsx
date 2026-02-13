import type { Metadata } from "next";
import "./globals.css";
import { PWAInstallGuard } from "@/components/pwa-install-guard"
import { SWRegister } from "@/components/sw-register"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "땅끝황토친환경 - 도정 일지",
  description: "영농조합법인 땅끝황토친환경 도정 관리 시스템",
  manifest: "/manifest.json",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex bg-slate-100 font-sans text-slate-900 selection:bg-blue-100">
        <SWRegister />
        <PWAInstallGuard>
          {children}
        </PWAInstallGuard>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
