'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

export interface Stock {
    id: number
    productionYear: number
    bagNo: number
    weightKg: number
    status: string
    incomingDate: Date
    lotNo: string | null
    variety: {
        name: string
        type: string
    }
    farmer: {
        name: string
        group: {
            certType: string
            name: string
        }
    }
}

interface MillingCartContextType {
    items: Stock[]
    addToCart: (stocks: Stock[]) => { success: boolean, error?: string }
    removeFromCart: (stockId: number) => void
    clearCart: () => void
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    editingBatchId: number | null
    editingDate: Date | null
    editingRemarks: string
    editingMillingType: string
    startEditing: (batchId: number, currentStocks: Stock[], date: Date, remarks: string, millingType: string) => void
    cancelEditing: () => void
}

const MillingCartContext = createContext<MillingCartContextType | undefined>(undefined)

export function MillingCartProvider({ children }: { children: ReactNode }) {
    // Persist cart to localStorage? Maybe later. For now, memory state is enough for "within session".
    // Actually, user said persistence across search is needed. Context does that if placed high enough.
    // LocalStorage is better for browser refresh survival.

    // Check local storage on mount
    const [items, setItems] = useState<Stock[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [editingBatchId, setEditingBatchId] = useState<number | null>(null)
    const [editingDate, setEditingDate] = useState<Date | null>(null)
    const [editingRemarks, setEditingRemarks] = useState('')
    const [editingMillingType, setEditingMillingType] = useState('백미')

    useEffect(() => {
        const saved = localStorage.getItem('milling-cart')
        const savedBatchId = localStorage.getItem('milling-editing-batch-id')
        const savedDate = localStorage.getItem('milling-editing-date')
        const savedRemarks = localStorage.getItem('milling-editing-remarks')
        const savedMillingType = localStorage.getItem('milling-editing-type')

        if (savedBatchId) {
            setEditingBatchId(Number(savedBatchId))
            if (savedDate) setEditingDate(new Date(savedDate))
            if (savedRemarks) setEditingRemarks(savedRemarks)
            if (savedMillingType) setEditingMillingType(savedMillingType)
        }

        if (saved) {
            try {
                // Parse dates back to Date objects
                const parsed = JSON.parse(saved).map((s: any) => ({
                    ...s,
                    incomingDate: new Date(s.incomingDate),
                    createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
                    updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
                }))
                setItems(parsed)
            } catch (e) {
                console.error('Failed to parse cart', e)
            }
        }
    }, [])

    useEffect(() => {
        localStorage.setItem('milling-cart', JSON.stringify(items))
        if (editingBatchId) {
            localStorage.setItem('milling-editing-batch-id', editingBatchId.toString())
            if (editingDate) localStorage.setItem('milling-editing-date', editingDate.toISOString())
            localStorage.setItem('milling-editing-remarks', editingRemarks)
            localStorage.setItem('milling-editing-type', editingMillingType)
        } else {
            localStorage.removeItem('milling-editing-batch-id')
            localStorage.removeItem('milling-editing-date')
            localStorage.removeItem('milling-editing-remarks')
            localStorage.removeItem('milling-editing-type')
        }
    }, [items, editingBatchId, editingDate, editingRemarks, editingMillingType])

    // ... addToCart ...

    const addToCart = (newStocks: Stock[]) => {
        if (newStocks.length === 0) return { success: true }

        // 1. Check Grain Type Consistency with Existing Items
        const currentType = items.length > 0 ? items[0].variety.type : null

        // Find if any new stock has different type
        const conflictingStock = newStocks.find(s => currentType && s.variety.type !== currentType)

        if (conflictingStock && currentType) {
            return {
                success: false,
                error: `곡종이 다른 톤백은 함께 담을 수 없습니다.\n현재 담긴 곡종: ${getVarietyTypeName(currentType)}\n추가하려는 톤백: ${conflictingStock.variety.name} (${getVarietyTypeName(conflictingStock.variety.type)})`
            }
        }

        // Also check if newStocks mix types themselves
        const firstNewType = newStocks[0].variety.type
        if (newStocks.some(s => s.variety.type !== firstNewType)) {
            return { success: false, error: '선택한 톤백들 간에 곡종이 섞여 있어 담을 수 없습니다.' }
        }

        // Filter out duplicates
        const existingIds = new Set(items.map(s => s.id))
        const uniqueNew = newStocks.filter(s => !existingIds.has(s.id))

        if (uniqueNew.length === 0) {
            return { success: true } // Already added
        }

        setItems(prev => [...prev, ...uniqueNew])
        setIsOpen(true) // Auto open cart to show feedback
        return { success: true }
    }

    const removeFromCart = (id: number) => {
        setItems(prev => prev.filter(s => s.id !== id))
    }

    const clearCart = () => {
        setItems([])
        setIsOpen(false)
        setEditingBatchId(null)
        setEditingDate(null)
        setEditingRemarks('')
        setEditingMillingType('백미')
    }

    const startEditing = (batchId: number, currentStocks: Stock[], date: Date, remarks: string, millingType: string) => {
        setItems(currentStocks)
        setEditingBatchId(batchId)
        setEditingDate(date)
        setEditingRemarks(remarks)
        setEditingMillingType(millingType)
        setIsOpen(true)
    }

    const cancelEditing = () => {
        setEditingBatchId(null)
        setEditingDate(null)
        setEditingRemarks('')
        setEditingMillingType('백미')
        setItems([])
        setIsOpen(false)
    }

    function getVarietyTypeName(type: string) {
        if (type === 'URUCHI') return '메벼'
        if (type === 'GLUTINOUS') return '찰벼'
        if (type === 'INDICA') return '인디카'
        if (type === 'BLACK') return '흑미'
        return type
    }

    return (
        <MillingCartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            clearCart,
            isOpen,
            setIsOpen,
            editingBatchId,
            editingDate,
            editingRemarks,
            editingMillingType,
            startEditing,
            cancelEditing
        }}>
            {children}
        </MillingCartContext.Provider>
    )
}

export function useMillingCart() {
    const context = useContext(MillingCartContext)
    if (!context) {
        throw new Error('useMillingCart must be used within a MillingCartProvider')
    }
    return context
}
