'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getBackups, createBackup, restoreBackup, type BackupFile } from '@/app/actions/backup'
import { Loader2, RefreshCw, ArchiveRestore, Save } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function BackupManager() {
    const [backups, setBackups] = useState<BackupFile[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    const loadBackups = async () => {
        setLoading(true)
        try {
            const result = await getBackups()
            if (result.success && result.data) {
                setBackups(result.data)
            } else {
                console.error(result.error)
            }
        } catch (error) {
            console.error('Failed to load backups:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadBackups()
    }, [])

    const handleCreateBackup = async () => {
        if (!confirm('현재 데이터베이스 상태를 백업하시겠습니까?')) return

        setActionLoading(true)
        setStatus(null)
        const result = await createBackup()

        if (result.success) {
            setStatus({ type: 'success', message: result.message || '백업 완료' })
            loadBackups()
        } else {
            setStatus({ type: 'error', message: result.error || '백업 실패' })
        }
        setActionLoading(false)
    }

    const handleRestore = async (filename: string) => {
        const password = prompt(`[경고] 데이터 복구 시 현재 데이터가 모두 덮어씌워집니다.\n계속하려면 "restore"라고 입력하세요.`)
        if (password !== 'restore') return

        setActionLoading(true)
        setStatus(null)

        const result = await restoreBackup(filename)

        if (result.success) {
            setStatus({ type: 'success', message: result.message || '복구 완료' })
        } else {
            setStatus({ type: 'error', message: result.error || '복구 실패' })
        }
        setActionLoading(false)
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>데이터베이스 백업 및 복구</CardTitle>
                    <CardDescription>시스템 데이터를 안전하게 백업하거나 이전 시점으로 되돌립니다.</CardDescription>
                </div>
                <Button onClick={handleCreateBackup} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    백업 생성
                </Button>
            </CardHeader>
            <CardContent>
                {status && (
                    <div className={`p-3 mb-4 rounded-md text-sm ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status.message}
                    </div>
                )}

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>파일명</TableHead>
                                <TableHead>크기</TableHead>
                                <TableHead>생성일시</TableHead>
                                <TableHead className="text-right">작업</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                                    </TableCell>
                                </TableRow>
                            ) : backups.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                        생성된 백업 파일이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                backups.map((file) => (
                                    <TableRow key={file.name}>
                                        <TableCell className="font-mono text-sm">{file.name}</TableCell>
                                        <TableCell>{formatBytes(file.size)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{new Date(file.createdAt).toLocaleString()}</span>
                                                <span className="text-xs text-slate-500">
                                                    {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true, locale: ko })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRestore(file.name)}
                                                disabled={actionLoading}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                                복구
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
