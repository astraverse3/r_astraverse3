'use client'

import { useState } from 'react'
import { updateUserRole, deleteUser } from '@/app/actions/user'
import { UserEditDialog } from './UserEditDialog'
import { UserPermissionDialog } from './UserPermissionDialog'
import { toast } from 'sonner'
import { Shield, ShieldOff, Pencil, Trash2, KeyRound } from 'lucide-react'
import { ALL_PERMISSIONS } from '@/lib/permissions'

interface User {
    id: string
    name: string | null
    email: string | null
    image: string | null
    role: string
    department: string | null
    position: string | null
    phone: string | null
    permissions: string[]
    createdAt: Date
}

export function UserTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [permUser, setPermUser] = useState<User | null>(null)

    const handleRoleToggle = async (user: User) => {
        const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
        const confirmMsg = newRole === 'ADMIN'
            ? `${user.name}님을 관리자로 지정하시겠습니까?`
            : `${user.name}님의 관리자 권한을 해제하시겠습니까?`

        if (!confirm(confirmMsg)) return

        const result = await updateUserRole(user.id, newRole)
        if (result.success) {
            toast.success(`${user.name}님의 역할이 ${newRole}로 변경되었습니다.`)
        } else {
            toast.error(result.error || '역할 변경에 실패했습니다.')
        }
    }

    const handleDelete = async (user: User) => {
        if (!confirm(`정말로 ${user.name}님의 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return

        const result = await deleteUser(user.id)
        if (result.success) {
            toast.success(`${user.name}님의 계정이 삭제되었습니다.`)
        } else {
            toast.error(result.error || '삭제에 실패했습니다.')
        }
    }

    return (
        <>
            {/* 모바일 카드 뷰 */}
            <div className="block lg:hidden space-y-3">
                {users.map((user) => (
                    <div key={user.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Row 1: Profile, Name, Role, Actions */}
                        <div className="flex items-center px-3 py-2.5 gap-2.5">
                            {user.image ? (
                                <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                    {user.name?.[0] || '?'}
                                </div>
                            )}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[13px] text-slate-900 truncate">{user.name || '이름 없음'}</span>
                                    <span className={`inline-flex px-1.5 py-0 text-[9px] font-bold rounded ${user.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {user.role}
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400 truncate">{user.email || '이메일 없음'}</span>
                            </div>

                            <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                {user.id !== currentUserId && (
                                    <button onClick={() => handleRoleToggle(user)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                                        {user.role === 'ADMIN' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                                <button onClick={() => setEditingUser(user)} className="p-1.5 text-slate-400 hover:text-[#00a2e8] transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {user.id !== currentUserId && (
                                    <button onClick={() => setPermUser(user)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors">
                                        <KeyRound className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {user.id !== currentUserId && (
                                    <button onClick={() => handleDelete(user)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Details */}
                        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                <div className="flex items-center justify-between bg-white rounded-md px-2 py-1 border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400">부서</span>
                                    <span className="text-[11px] font-medium text-slate-700">{user.department || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between bg-white rounded-md px-2 py-1 border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400">직책</span>
                                    <span className="text-[11px] font-medium text-slate-700">{user.position || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between col-span-2 bg-white rounded-md px-2 py-1 border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400">연락처</span>
                                    <span className="text-[11px] font-medium text-slate-700">{user.phone || '-'}</span>
                                </div>
                            </div>

                            {/* Row 3: Permissions */}
                            {user.role !== 'ADMIN' && (user.permissions?.length ?? 0) > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-1">
                                    {(user.permissions || []).map(p => (
                                        <span key={p} className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 rounded">
                                            {ALL_PERMISSIONS[p as keyof typeof ALL_PERMISSIONS]?.label || p}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* 데스크톱 테이블 뷰 */}
            <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="text-left px-5 py-3">사용자</th>
                            <th className="text-left px-5 py-3">역할</th>
                            <th className="text-left px-5 py-3">부서</th>
                            <th className="text-left px-5 py-3">직책</th>
                            <th className="text-left px-5 py-3">연락처</th>
                            <th className="text-left px-5 py-3">가입일</th>
                            <th className="text-center px-5 py-3">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                        {user.image ? (
                                            <img src={user.image} alt="" className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                                {user.name?.[0] || '?'}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{user.name || '이름 없음'}</p>
                                            <p className="text-xs text-slate-400">{user.email || '이메일 없음'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full ${user.role === 'ADMIN'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {user.role}
                                    </span>
                                    {user.role !== 'ADMIN' && (user.permissions?.length ?? 0) > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {(user.permissions || []).map(p => (
                                                <span key={p} className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-600 rounded">
                                                    {ALL_PERMISSIONS[p as keyof typeof ALL_PERMISSIONS]?.label || p}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-5 py-3.5 text-sm text-slate-600">{user.department || '-'}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-600">{user.position || '-'}</td>
                                <td className="px-5 py-3.5 text-sm text-slate-600">{user.phone || '-'}</td>
                                <td className="px-5 py-3.5 text-xs text-slate-400">
                                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                                </td>
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center justify-center gap-1">
                                        {user.id !== currentUserId && (
                                            <button
                                                onClick={() => handleRoleToggle(user)}
                                                title={user.role === 'ADMIN' ? '권한 해제' : '관리자 지정'}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                {user.role === 'ADMIN' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setEditingUser(user)}
                                            title={user.id === currentUserId ? '내 정보 수정' : '정보 수정'}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {user.id !== currentUserId && (
                                            <button
                                                onClick={() => setPermUser(user)}
                                                title="권한 설정"
                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                                            >
                                                <KeyRound className="w-4 h-4" />
                                            </button>
                                        )}
                                        {user.id !== currentUserId && (
                                            <button
                                                onClick={() => handleDelete(user)}
                                                title="삭제"
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingUser && (
                <UserEditDialog
                    user={editingUser}
                    open={!!editingUser}
                    onClose={() => setEditingUser(null)}
                />
            )}

            {permUser && (
                <UserPermissionDialog
                    user={permUser}
                    open={!!permUser}
                    onClose={() => setPermUser(null)}
                />
            )}
        </>
    )
}
