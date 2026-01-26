'use client';

import { Bell } from 'lucide-react';

export function MobileHeader() {
    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-5 h-16 flex items-center justify-between z-40 lg:hidden">
            <div className="flex items-center gap-2">
                <img src="/logo-full.png" alt="MILL LOG" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex items-center gap-4">
                <button className="text-slate-500 relative p-1">
                    <Bell className="w-6 h-6" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs border border-blue-200">
                    AD
                </div>
            </div>
        </header>
    );
}
