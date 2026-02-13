'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createStockRelease } from '@/app/actions/release'
import { triggerDataUpdate } from '@/components/last-updated'
import { toast } from 'sonner'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ko } from 'date-fns/locale'

interface Props {
    selectedIds: Set<number>
    onOpenChange: (open: boolean) => void
    open: boolean
    onSuccess: () => void
}

export function ReleaseStockDialog({ selectedIds, onOpenChange, open, onSuccess }: Props) {
    const [date, setDate] = useState<Date>(new Date())
    const [destination, setDestination] = useState('')
    const [purpose, setPurpose] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!destination.trim()) {
            toast.warning('출고처를 입력해주세요.')
            return
        }

        if (selectedIds.size === 0) return

        setIsSubmitting(true)
        const result = await createStockRelease(
            Array.from(selectedIds),
            date,
            destination,
            purpose
        )
        setIsSubmitting(false)

        if (result.success) {
            triggerDataUpdate()
            onOpenChange(false)
            onSuccess() // clear selection
            // Reset form
            setDestination('')
            setPurpose('')
            setDate(new Date())
            toast.success('출고 처리되었습니다.')
        } else {
            toast.error(result.error || '출고 처리에 실패했습니다.')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>재고 출고 처리</DialogTitle>
                    <DialogDescription>
                        선택한 {selectedIds.size}개의 톤백을 출고 처리합니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">출고일</Label>
                        <div className="col-span-3">
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
                                        {date ? format(date, "PPP", { locale: ko }) : <span>날짜 선택</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="destination" className="text-right">
                            출고처
                        </Label>
                        <Input
                            id="destination"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="예: 탑라이스센터, 수매처 등"
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="purpose" className="text-right">
                            비고/목적
                        </Label>
                        <Textarea
                            id="purpose"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="예: 판매, 이관 등"
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? '처리 중...' : '출고하기'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
