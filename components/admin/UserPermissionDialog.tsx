'use client'

import { useState } from 'react'
import { ALL_PERMISSIONS, BUSINESS_PERMISSIONS, ADMIN_PERMISSIONS, type PermissionCode } from '@/lib/permissions'
import { updateUserPermissions } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, Shield } from 'lucide-react'

interface UserPermissionDialogProps {
    user: {
        id: string
        name: string | null
        role: string
        permissions: string[]
    }
    open: boolean
    onClose: () => void
}

export function UserPermissionDialog({ user, open, onClose }: UserPermissionDialogProps) {
    const [selected, setSelected] = useState<string[]>(user.permissions || [])
    const [loading, setLoading] = useState(false)

    if (!open) return null

    const toggle = (code: string) => {
        setSelected(prev =>
            prev.includes(code)
                ? prev.filter(p => p !== code)
                : [...prev, code]
        )
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const result = await updateUserPermissions(user.id, selected)
            if (result.success) {
                toast.success('권한이 저장되었습니다.')
                onClose()
            } else {
                toast.error('error' in result ? (result as any).error : '권한 저장에 실패했습니다.')
            }
        } catch {
            toast.error('권한 저장 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    const isAdmin = user.role === 'ADMIN'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-bold text-slate-900">
                        {user.name || '이름 없음'} 권한 설정
                    </h2>
                </div>

                {isAdmin && (
                    <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                        ⚡ ADMIN은 모든 권한이 자동 부여됩니다.
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">업무 권한</p>
                        <p className="text-[11px] text-slate-400 mb-3">페이지 조회는 모두 가능, 등록/수정/삭제만 제어</p>
                        <div className="space-y-2">
                            {Object.values(BUSINESS_PERMISSIONS).map(perm => (
                                <label key={perm.code} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${isAdmin ? 'bg-blue-50/50 border-blue-200' :
                                    selected.includes(perm.code) ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:bg-slate-50'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={isAdmin || selected.includes(perm.code)}
                                        onChange={() => toggle(perm.code)}
                                        disabled={isAdmin}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-slate-800">{perm.label}</span>
                                        <p className="text-[11px] text-slate-400">{perm.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">관리 권한</p>
                        <p className="text-[11px] text-slate-400 mb-3">페이지 접근 자체를 제어</p>
                        <div className="space-y-2">
                            {Object.values(ADMIN_PERMISSIONS).map(perm => (
                                <label key={perm.code} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${isAdmin ? 'bg-blue-50/50 border-blue-200' :
                                    selected.includes(perm.code) ? 'bg-blue-50 border-blue-300' : 'border-slate-200 hover:bg-slate-50'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={isAdmin || selected.includes(perm.code)}
                                        onChange={() => toggle(perm.code)}
                                        disabled={isAdmin}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <span className="text-sm font-medium text-slate-800">{perm.label}</span>
                                        <p className="text-[11px] text-slate-400">{perm.description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                        취소
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={loading || isAdmin}>
                        {loading ? '저장 중...' : '저장'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
