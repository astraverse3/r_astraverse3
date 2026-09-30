'use server'

import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-guard'
import { backupFilename, pgBin, pgEnvFromUrl } from '@/lib/backup-file'

const execFileAsync = promisify(execFile)

const BACKUP_DIR = path.join(process.cwd(), 'backups')

// Ensure backup directory exists (Safe check for Vercel/ReadOnly env)
try {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }
} catch (error) {
    console.warn('Backup directory creation failed (likely read-only fs):', error)
}

export interface BackupFile {
    name: string
    size: number
    createdAt: Date
}

export async function getBackups(): Promise<{ success: boolean; data?: BackupFile[]; error?: string }> {
    try {
        await requireAdmin()

        const files = fs.readdirSync(BACKUP_DIR)
            .filter(file => file.endsWith('.sql'))
            .map(file => {
                const filePath = path.join(BACKUP_DIR, file)
                const stats = fs.statSync(filePath)
                return {
                    name: file,
                    size: stats.size,
                    createdAt: stats.birthtime
                }
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        return { success: true, data: files }
    } catch (error) {
        console.error('Failed to list backups:', error)
        return { success: false, error: 'Failed to list backups' }
    }
}

export async function createBackup(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        await requireAdmin()

        const dbUrl = process.env.DATABASE_URL
        if (!dbUrl) return { success: false, error: 'DATABASE_URL not configured' }

        const filename = backupFilename(new Date())
        const filePath = path.join(BACKUP_DIR, filename)

        // 셸을 거치지 않고(execFile) 접속 정보는 환경변수로 넘긴다 — URL(비밀번호 포함)이
        // 명령줄 인자·에러 메시지에 찍히지 않게 (백로그 §84)
        // --clean --if-exists: 복원 때 기존 객체를 지우고 다시 만드는 덤프
        await execFileAsync(pgBin('pg_dump'), ['--clean', '--if-exists', '-f', filePath], {
            env: { ...process.env, ...pgEnvFromUrl(dbUrl) },
        })
        revalidatePath('/admin')
        return { success: true, message: `Backup created: ${filename}` }
    } catch (error) {
        console.error('Backup failed:', error instanceof Error ? error.message : error)
        return { success: false, error: '백업 작업에 실패했습니다.' }
    }
}

// 복원은 화면에 두지 않는다 — `scripts/restore-backup.ts`로만 (사용자 결정 2026-09-30, 백로그 §84).
// 로컬 개발 서버가 운영 DB에 붙어 있어 버튼 한 번이 운영 DB를 통째로 되돌렸다.
