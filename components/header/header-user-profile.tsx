"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LogOut, User, Building, BadgeCheck } from "lucide-react"

export function HeaderUserProfile() {
    const { data: session } = useSession()

    if (!session?.user) return null

    const { name, image, department, position } = session.user as any

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-full transition-colors focus:outline-none">
                    {image ? (
                        <img src={image} alt={name || "User"} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {name?.[0] || "U"}
                        </div>
                    )}
                    <div className="hidden md:flex flex-col items-start mr-2">
                        <span className="text-sm font-semibold text-slate-700">{name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                            {department || "부서 미지정"} {position ? `· ${position}` : ""}
                        </span>
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
                <div className="px-2 py-3 border-b border-slate-100 mb-2">
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

                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 text-sm h-9"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                </Button>
            </PopoverContent>
        </Popover>
    )
}
