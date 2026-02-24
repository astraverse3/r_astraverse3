"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"

export function KakaoLoginButton() {
    return (
        <Button
            className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#000000] font-semibold h-12 flex items-center justify-center gap-2"
            onClick={() => signIn("kakao", { callbackUrl: "/dashboard" })}
        >
            <MessageCircle className="w-5 h-5 fill-current" />
            카카오톡으로 로그인
        </Button>
    )
}
