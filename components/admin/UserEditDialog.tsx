'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateUserInfo } from '@/app/actions/user'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface UserEditDialogProps {
    user: {
        id: string
        name: string | null
        department: string | null
        position: string | null
        phone: string | null
    }
    open: boolean
    onClose: () => void
}

export function UserEditDialog({ user, open, onClose }: UserEditDialogProps) {
    const [department, setDepartment] = useState(user.department || '')
    const [position, setPosition] = useState(user.position || '')
    const [phone, setPhone] = useState(user.phone || '')
    const [loading, setLoading] = useState(false)

    if (!open) return null

    const handleSave = async () => {
        setLoading(true)
        try {
            const result = await updateUserInfo(user.id, {
                department: department || null,
                position: position || null,
                phone: phone || null,
            })
            if (result.success) {
                toast.success('사용자 정보가 수정되었습니다.')
                onClose()
            }
        } catch {
            toast.error('수정 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-lg font-bold text-slate-900">
                    {user.name || '이름 없음'} 정보 수정
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">부서</label>
                        <input
                            type="text"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder="예: 도정팀"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">직책</label>
                        <input
                            type="text"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            placeholder="예: 팀장"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">연락처</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="예: 010-1234-5678"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                        취소
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={loading}>
                        {loading ? '저장 중...' : '저장'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
