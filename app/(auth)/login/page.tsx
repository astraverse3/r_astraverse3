import LoginForm from '@/app/ui/login-form';

export default function LoginPage() {
    return (
        <main className="flex items-center justify-center h-screen bg-slate-100">
            <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4">
                <div className="bg-white px-6 pb-8 pt-8 rounded-xl shadow-sm border border-slate-200">
                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold text-slate-900">땅끝황토친환경</h1>
                        <p className="text-sm text-slate-500 mt-1">도정 통합 관리 시스템</p>
                    </div>
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
