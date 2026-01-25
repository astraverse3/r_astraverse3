import type { Metadata } from "next";
import "./globals.css";

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

import Link from "next/link"
import { PWAInstallGuard } from "@/components/pwa-install-guard"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen flex flex-col bg-background selection:bg-primary/10 font-sans"
      >
        <PWAInstallGuard>
          <div className="fixed top-3 md:top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-3 md:px-4">
            <header className="glass rounded-xl md:rounded-2xl h-12 md:h-16 flex items-center px-4 md:px-8 border border-white/40">
              <div className="mr-auto font-black text-lg md:text-2xl tracking-tighter italic text-stone-900 flex items-center gap-2">
                <Link href="/" className="flex items-center gap-2">
                  <img src="/logo-symbol.svg" alt="Logo" className="h-6 md:h-8 w-auto object-contain" />
                  <span className="text-gradient font-black">도정일지</span>
                </Link>
              </div>
              <nav className="flex items-center space-x-4 md:space-x-8 text-[11px] md:text-sm font-bold uppercase tracking-widest text-stone-500">
                <Link href="/stocks" className="transition-all hover:text-primary relative group">
                  입고 관리
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
                </Link>
                <Link href="/milling" className="transition-all hover:text-primary relative group">
                  도정 내역
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full"></span>
                </Link>
              </nav>
            </header>
          </div>

          <main className="flex-1 pt-20 md:pt-32 pb-8 md:pb-12">
            {children}
          </main>

          <footer className="py-8 border-t border-stone-100 mt-20">
            <div className="container mx-auto px-4 text-center text-xs text-stone-400 font-medium">
              © 2026 MILLING LOG SYSTEM • PREMIUM RICE MANAGEMENT
            </div>
          </footer>
        </PWAInstallGuard>
      </body>
    </html>
  );
}
