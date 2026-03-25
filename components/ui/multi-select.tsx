'use client'

import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'

interface MultiSelectOption {
    label: string
    value: string
}

interface MultiSelectProps {
    options: MultiSelectOption[]
    value: string[]
    onValueChange: (value: string[]) => void
    placeholder?: string
    className?: string
}

export function MultiSelect({
    options,
    value,
    onValueChange,
    placeholder = '전체',
    className,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false)

    const toggle = (optionValue: string) => {
        if (value.includes(optionValue)) {
            onValueChange(value.filter((v) => v !== optionValue))
        } else {
            onValueChange([...value, optionValue])
        }
    }

    const displayLabel = () => {
        if (value.length === 0) return placeholder
        if (value.length === 1) {
            return options.find((o) => o.value === value[0])?.label ?? value[0]
        }
        return `${value.length}개 선택`
    }

    const isSelected = value.length > 0

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        'w-full justify-between font-normal h-9 px-3',
                        !isSelected && 'text-muted-foreground',
                        className
                    )}
                >
                    <span className="truncate">{displayLabel()}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[180px] p-1" align="start">
                <div className="max-h-[220px] overflow-y-auto">
                {options.map((option) => (
                    <div
                        key={option.value}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm"
                        onClick={() => toggle(option.value)}
                    >
                        <div className={cn(
                            'h-4 w-4 rounded border border-primary flex items-center justify-center shrink-0',
                            value.includes(option.value) ? 'bg-primary' : 'bg-background'
                        )}>
                            {value.includes(option.value) && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                        </div>
                        <span>{option.label}</span>
                    </div>
                ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
