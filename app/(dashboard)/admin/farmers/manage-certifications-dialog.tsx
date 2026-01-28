'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createCertification, updateCertification, deleteCertification, type CertificationFormData } from '@/app/actions/admin'
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react'

interface Farmer {
    id: number
    name: string
    certifications: {
        id: number
        certType: string
        certNo: string
        personalNo: string | null
    }[]
}

interface Props {
    farmer: Farmer
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ManageCertificationsDialog({ farmer, open, onOpenChange }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [isAdding, setIsAdding] = useState(false)

    // Form states for adding/editing
    const [formData, setFormData] = useState<CertificationFormData>({
        farmerId: farmer.id,
        certType: '친환경',
        certNo: '',
        personalNo: ''
    })

    const resetForm = () => {
        setFormData({
            farmerId: farmer.id,
            certType: '친환경', // Default or select first option
            certNo: '',
            personalNo: ''
        })
        setEditingId(null)
        setIsAdding(false)
    }

    const handleSave = async () => {
        if (!formData.certType || !formData.certNo) {
            alert('인증 구분과 번호를 입력해주세요.')
            return
        }

        setIsLoading(true)
        let result
        if (editingId) {
            result = await updateCertification(editingId, formData)
        } else {
            result = await createCertification(formData)
        }
        setIsLoading(false)

        if (result.success) {
            resetForm()
            // Router refresh is handled in action, but we might need to handle UI updates if not using router.refresh() in parent
            // Since this is a client component dialog, we rely on parent's revalidation or we can force router.refresh() here if needed.
            // But action calls revalidatePath, so Next.js should auto-update the props passed to this dialog if parent re-renders?
            // Wait, this dialog props come from parent `FarmerList`. When `revalidatePath` happens, `AdminFarmersPage` re-renders, updates `farmers` prop, passing new data to `FarmerList`, which updates this dialog props.
        } else {
            alert(result.error || '저장 실패')
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('정말 삭제하시겠습니까?')) return
        setIsLoading(true)
        const result = await deleteCertification(id)
        setIsLoading(false)
        if (!result.success) {
            alert(result.error || '삭제 실패')
        }
    }

    const startEdit = (cert: Farmer['certifications'][0]) => {
        setEditingId(cert.id)
        setFormData({
            farmerId: farmer.id,
            certType: cert.certType,
            certNo: cert.certNo,
            personalNo: cert.personalNo || ''
        })
        setIsAdding(false)
    }

    const startAdd = () => {
        setEditingId(null)
        setFormData({
            farmerId: farmer.id,
            certType: '유기농',
            certNo: '',
            personalNo: ''
        })
        setIsAdding(true)
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetForm()
            onOpenChange(val)
        }}>
            <DialogContent className="sm:max-w-[600px] bg-slate-50">
                <DialogHeader>
                    <DialogTitle>인증 정보 관리 - <span className="text-blue-600">{farmer.name}</span></DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* List */}
                    <div className="space-y-2">
                        {farmer.certifications.length === 0 && !isAdding && (
                            <div className="text-center py-4 text-slate-500 bg-white rounded border border-slate-200 border-dashed">
                                등록된 인증 정보가 없습니다.
                            </div>
                        )}
                        {farmer.certifications.map(cert => (
                            <div key={cert.id} className="flex items-center justify-between p-3 bg-white rounded border border-slate-200">
                                {editingId === cert.id ? (
                                    <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-3">
                                            <Select value={formData.certType} onValueChange={(val) => setFormData(p => ({ ...p, certType: val }))}>
                                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="유기농">유기농</SelectItem>
                                                    <SelectItem value="무농약">무농약</SelectItem>
                                                    <SelectItem value="GAP">GAP</SelectItem>
                                                    <SelectItem value="일반">일반</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-4">
                                            <Input className="h-8" value={formData.certNo} onChange={e => setFormData(p => ({ ...p, certNo: e.target.value }))} placeholder="인증번호" />
                                        </div>
                                        <div className="col-span-3">
                                            <Input className="h-8" value={formData.personalNo || ''} onChange={e => setFormData(p => ({ ...p, personalNo: e.target.value }))} placeholder="개인번호" />
                                        </div>
                                        <div className="col-span-2 flex justify-end gap-1">
                                            <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={handleSave} disabled={isLoading}><Check className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={resetForm}><X className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-3 items-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cert.certType === '유기농' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    cert.certType === '무농약' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                {cert.certType}
                                            </span>
                                            <span className="font-mono font-medium text-slate-700">{cert.certNo}</span>
                                            {cert.personalNo && <span className="text-xs text-slate-400">({cert.personalNo})</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => startEdit(cert)} disabled={!!editingId || isAdding}>
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(cert.id)} disabled={!!editingId || isAdding}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Add Form */}
                    {isAdding ? (
                        <div className="p-3 bg-blue-50/50 rounded border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-blue-700">새 인증 정보 추가</span>
                            </div>
                            <div className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-3">
                                    <Select value={formData.certType} onValueChange={(val) => setFormData(p => ({ ...p, certType: val }))}>
                                        <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="유기농">유기농</SelectItem>
                                            <SelectItem value="무농약">무농약</SelectItem>
                                            <SelectItem value="GAP">GAP</SelectItem>
                                            <SelectItem value="일반">일반</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-4">
                                    <Input className="h-8 bg-white" value={formData.certNo} onChange={e => setFormData(p => ({ ...p, certNo: e.target.value }))} placeholder="인증번호" />
                                </div>
                                <div className="col-span-3">
                                    <Input className="h-8 bg-white" value={formData.personalNo || ''} onChange={e => setFormData(p => ({ ...p, personalNo: e.target.value }))} placeholder="개인번호 (선택)" />
                                </div>
                                <div className="col-span-2 flex justify-end gap-1">
                                    <Button size="icon" className="h-8 w-8 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isLoading}><Check className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={resetForm}><X className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" className="w-full border-dashed text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50" onClick={startAdd} disabled={!!editingId}>
                            <Plus className="mr-2 h-4 w-4" /> 인증 정보 추가
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
