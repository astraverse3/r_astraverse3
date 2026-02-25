'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateStockRelease } from '@/app/actions/release'
import { triggerDataUpdate } from '@/components/last-updated'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from 'sonner'

interface EditReleaseDialogProps {
    release: any | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditReleaseDialog({ release, open, onOpenChange }: EditReleaseDialogProps) {
    const [date, setDate] = useState<Date | undefined>(undefined)
    const [destination, setDestination] = useState('')
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (release) {
            setDate(new Date(release.date))
            setDestination(release.destination)
            setPurpose(release.purpose || '')
        }
    }, [release])

    const handleSave = async () => {
        if (!release || !date || !destination.trim()) return

        setLoading(true)
        try {
            const result = await updateStockRelease(release.id, {
                date,
                destination: destination.trim(),
                purpose: purpose.trim()
            })

            if (result.success) {
                toast.success('출고 정보가 수정되었습니다.')
                triggerDataUpdate()
                onOpenChange(false)
            } else {
                toast.error(result.error || '수정 중 오류가 발생했습니다.')
            }
        } catch (error) {
            toast.error('수정 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>출고 정보 수정</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>출고일자</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "yyyy-MM-dd") : <span>날짜 선택</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>출고처</Label>
                        <Input
                            placeholder="출고처 입력"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>비고</Label>
                        <Input
                            placeholder="비고 입력 (선택사항)"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSave} disabled={loading || !date || !destination.trim()} className="bg-[#8dc540] hover:bg-[#7db037] text-white">
                        {loading ? '저장 중...' : '저장하기'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
