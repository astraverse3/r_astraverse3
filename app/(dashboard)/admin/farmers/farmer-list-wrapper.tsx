'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteFarmers } from '@/app/actions/admin'
import { FarmerList } from './farmer-list'

interface Farmer {
    id: number
    name: string
    farmerNo: string
    items: string | null
    phone: string | null
    groupId: number
    group: {
        id: number
        code: string
        name: string
        certNo: string
        certType: string
        cropYear: number
    }
}

export function FarmerListWrapper({ farmers }: { farmers: Farmer[] }) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleBulkDelete = async () => {
        setIsDeleting(true)
        const result = await deleteFarmers(Array.from(selectedIds))
        setIsDeleting(false)
        setShowDeleteDialog(false)

        if (result.success && result.data) {
            const { success, failed } = result.data
            let message = `${success.length}개 생산자가 삭제되었습니다.`
            if (failed.length > 0) {
                message += `\n\n삭제 실패 (${failed.length}개):\n${failed.map(f => f.reason).join('\n')}`
            }
            alert(message)
            setSelectedIds(new Set())
        } else {
            alert(result.error || '삭제 실패')
        }
    }

    return (
        <>
            {selectedIds.size > 0 && (
                <div className="mb-4">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        선택 삭제 ({selectedIds.size}개)
                    </Button>
                </div>
            )}

            <FarmerList
                farmers={farmers}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
            />

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>생산자 일괄 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                            선택한 {selectedIds.size}개의 생산자를 삭제하시겠습니까?
                            <br /><br />
                            <span className="text-amber-600 font-medium">
                                ⚠️ 재고가 등록된 생산자는 삭제되지 않습니다.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? '삭제 중...' : '삭제'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
