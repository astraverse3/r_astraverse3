'use client';

import Link from "next/link"
import { Settings, Users, Wheat, Tractor, LogOut, MoreVertical, Building, BadgeCheck } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function MobileHeader() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === 'ADMIN'
    const { name, image, department, position } = session?.user as any || {}

    return (
        <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-4 h-11 flex items-center justify-between z-40 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
                <img src="/logo-full.png" alt="MILL LOG" className="h-[22px] w-auto object-contain" />
            </Link>

            <div className="flex items-center gap-2">
                {/* 1. Profile & Logout (항상 표시) */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center focus:outline-none">
                        {image ? (
                            <img src={image} alt={name || "User"} className="w-7 h-7 rounded-full border border-slate-200 object-cover" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {name?.[0] || "U"}
                            </div>
                        )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2">
                        <div className="px-2 py-2 border-b border-slate-100 mb-2">
                            <p className="font-semibold text-sm text-slate-800">{name}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                                <Building className="w-3.5 h-3.5" />
                                <span>{department || "소속 없음"}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                <BadgeCheck className="w-3.5 h-3.5" />
                                <span>{position || "직책 없음"}</span>
                            </div>
                        </div>

                        <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 justify-start"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                        >
                            <LogOut className="w-4 h-4" />
                            <span>로그아웃</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* 2. Admin Settings (관리자 전용 혹은 안내 메시지) */}
                <DropdownMenu>
                    <DropdownMenuTrigger className="p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                        <MoreVertical className="w-5 h-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {isAdmin ? (
                            <>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
                                        <Users className="w-4 h-4 text-slate-500" />
                                        <span>사용자 관리</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/farmers" className="flex items-center gap-2 cursor-pointer">
                                        <Tractor className="w-4 h-4 text-slate-500" />
                                        <span>농가 관리</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/varieties" className="flex items-center gap-2 cursor-pointer">
                                        <Wheat className="w-4 h-4 text-slate-500" />
                                        <span>품종 관리</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        ) : (
                            <div className="px-2 py-1.5 text-xs text-slate-500 text-center">
                                일반 사용자<br />(설정 권한 없음)
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
