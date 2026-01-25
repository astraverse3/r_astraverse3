import LoginForm from '@/app/ui/login-form';
import { Server } from 'lucide-react';

export default function LoginPage() {
    return (
        <main className="flex items-center justify-center md:h-screen bg-slate-100">
            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
                <div className="flex h-32 w-full items-end rounded-lg bg-slate-900 p-3 md:h-48 mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Server className="w-32 h-32 text-white" />
                    </div>
                    <div className="text-white z-10 w-full mb-4 px-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
                                <Server className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">IMS <span className="text-blue-400 text-sm font-normal">v2.4</span></span>
                        </div>
                        <div className="text-lg font-bold">땅끝황토친환경<br />도정 통합 관리 시스템</div>
                    </div>
                </div>

                <div className="bg-white px-6 pb-8 pt-8 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">관리자 로그인</h2>
                    <LoginForm />
                </div>

                <div className="text-center text-[10px] text-slate-400 mt-8 font-medium">
                    AUTHORIZED PERSONNEL ONLY<br />
                    시스템 접근 권한이 없는 경우 로그인이 제한됩니다.
                </div>
            </div>
        </main>
    );
}
