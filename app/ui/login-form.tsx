'use client';

import { useFormState } from 'react-dom';
import { authenticate } from '@/app/lib/actions';
import { ArrowRight, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginForm() {
    const [errorMessage, dispatch] = useFormState(authenticate, undefined);

    return (
        <form action={dispatch} className="space-y-4">
            <div className="space-y-4">
                <div>
                    <label
                        className="mb-2 block text-xs font-medium text-slate-500 uppercase tracking-wider"
                        htmlFor="username"
                    >
                        아이디 (Username)
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-lg border border-slate-200 py-3 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            id="username"
                            type="text"
                            name="username"
                            placeholder="Enter your username"
                            required
                        />
                        <User className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-blue-500" />
                    </div>
                </div>
                <div>
                    <label
                        className="mb-2 block text-xs font-medium text-slate-500 uppercase tracking-wider"
                        htmlFor="password"
                    >
                        비밀번호 (Password)
                    </label>
                    <div className="relative">
                        <input
                            className="peer block w-full rounded-lg border border-slate-200 py-3 pl-10 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            id="password"
                            type="password"
                            name="password"
                            placeholder="Enter password"
                            required
                            minLength={4}
                        />
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 peer-focus:text-blue-500" />
                    </div>
                </div>
            </div>
            <div
                className="flex h-8 items-end space-x-1"
                aria-live="polite"
                aria-atomic="true"
            >
                {errorMessage && (
                    <>
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <p className="text-sm text-red-500">{errorMessage}</p>
                    </>
                )}
            </div>
            <button
                type="submit"
                className="mt-6 w-full flex items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-blue-700"
            >
                Sign in <ArrowRight className="ml-auto h-5 w-5 text-gray-50" />
            </button>
        </form>
    );
}
