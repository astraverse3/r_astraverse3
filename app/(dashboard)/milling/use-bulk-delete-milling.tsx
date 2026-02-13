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
import { deleteMillingBatches } from '@/app/actions/milling'
import { toast } from 'sonner'

export function useBulkDeleteMilling() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleBulkDelete = async () => {
        setIsDeleting(true)
        const result = await deleteMillingBatches(Array.from(selectedIds))
        setIsDeleting(false)
        setShowDeleteDialog(false)

        if (result.success && result.data) {
            const { success, failed } = result.data
            let message = `${success.length}개 작업이 삭제되었습니다.`
            if (failed.length > 0) {
                message += `\n\n삭제 실패 (${failed.length}개):\n${failed.map(f => f.reason).join('\n')}`
            }
            toast.success(message)
            setSelectedIds(new Set())
        } else {
            toast.error(result.error || '삭제 실패')
        }
    }

    const DeleteDialog = () => (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>도정 작업 일괄 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                        선택한 {selectedIds.size}개의 작업을 삭제하시겠습니까?
                        <br /><br />
                        <span className="text-amber-600 font-medium">
                            ⚠️ 포장이 진행된 작업은 삭제되지 않습니다.
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
    )

    return {
        selectedIds,
        setSelectedIds,
        showDeleteDialog: () => setShowDeleteDialog(true),
        DeleteDialog
    }
}
