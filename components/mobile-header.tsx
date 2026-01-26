'use client';

export function MobileHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-5 h-16 flex items-center justify-between z-40 lg:hidden">
            <div className="flex items-center gap-2">
                <img src="/logo-full.png" alt="MILL LOG" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-4">
                {/* Right side elements removed as requested */}
            </div>
        </header>
    );
}
