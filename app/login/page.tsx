"use client"

import { KakaoLoginButton } from "@/components/kakao-login-button"
import { useSearchParams } from "next/navigation"

export default function LoginPage() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error")

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg space-y-8">
                <div className="text-center flex flex-col items-center">
                    <img
                        src="/logo-full.png"
                        alt="땅끝황토친환경 도정 일지 시스템"
                        className="h-16 w-auto mb-2"
                    />
                    <p className="mt-4 text-sm text-gray-600">
                        카카오 계정으로 간편하게 로그인하세요
                    </p>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-center border border-red-100">
                        로그인 중 오류가 발생했습니다: {error}
                    </div>
                )}

                <div className="mt-8">
                    <KakaoLoginButton />
                </div>
            </div>
        </div>
    )
}
