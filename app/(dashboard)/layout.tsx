import { MobileHeader } from "@/components/mobile-header"
import { MobileNav } from "@/components/mobile-nav"
import { DesktopSidebar } from "@/components/desktop-sidebar"
import { BreadcrumbDisplay } from "@/components/breadcrumb-display"
import { HeaderUserProfile } from "@/components/header/header-user-profile"
import { MillingCartProvider } from "./stocks/milling-cart-context"
import { LastUpdated } from "@/components/last-updated"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <MillingCartProvider>
                {/* Mobile Header (Fixed Top) */}
                <MobileHeader />

                {/* Desktop Sidebar (Hidden on Mobile) */}
                <DesktopSidebar />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-screen bg-transparent lg:pl-64 pt-[44px] pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0">

                    {/* Desktop Header (Hidden on Mobile) */}
                    <header className="hidden lg:flex h-14 bg-white border-b border-slate-200 items-center justify-between px-6 z-40">
                        <BreadcrumbDisplay />
                        <HeaderUserProfile />
                    </header>

                    {/* Scrollable Page Content */}
                    <main className="flex-1 w-full relative">
                        <div className="max-w-7xl mx-auto px-0 pt-1.5 pb-0 sm:p-6 space-y-1.5 sm:space-y-6 sm:pb-16">
                            {children}
                        </div>

                        {/* Bottom Right Update Timestamp */}
                        <div className="absolute bottom-4 right-6 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-slate-200/50 z-10 hidden md:block">
                            <LastUpdated />
                        </div>
                    </main>
                </div>

                {/* Mobile Bottom Navigation */}
                <MobileNav />
            </MillingCartProvider>
        </>
    );
}
