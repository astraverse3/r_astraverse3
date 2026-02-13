'use server'

import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

const execAsync = promisify(exec)

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
        const session = await auth()
        if (!session) return { success: false, error: 'Unauthorized' }

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
    } catch (error: any) {
        console.error('Failed to list backups:', error)
        return { success: false, error: 'Failed to list backups' }
    }
}

export async function createBackup(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const session = await auth()
        if (!session) return { success: false, error: 'Unauthorized' }

        const dbUrl = process.env.DATABASE_URL
        if (!dbUrl) return { success: false, error: 'DATABASE_URL not configured' }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const filename = `backup_${timestamp}.sql`
        const filePath = path.join(BACKUP_DIR, filename)

        // pg_dump command
        const pgDumpPath17 = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe';
        const pgDumpPath16 = 'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe';

        let dumpCommand = 'pg_dump';
        if (fs.existsSync(pgDumpPath17)) {
            dumpCommand = `"${pgDumpPath17}"`;
        } else if (fs.existsSync(pgDumpPath16)) {
            dumpCommand = `"${pgDumpPath16}"`;
        }

        // Output file option (-f) must come BEFORE the connection URL (positional argument)
        // Add --clean --if-exists to drop existing objects before creating them in the dump
        const command = `${dumpCommand} --clean --if-exists -f "${filePath}" "${dbUrl}"`

        await execAsync(command)
        revalidatePath('/admin')
        return { success: true, message: `Backup created: ${filename}` }
    } catch (error: any) {
        console.error('Backup failed:', error)
        return { success: false, error: `Backup failed: ${error.message}` }
    }
}

export async function restoreBackup(filename: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const session = await auth()
        if (!session) return { success: false, error: 'Unauthorized' }

        const dbUrl = process.env.DATABASE_URL
        if (!dbUrl) return { success: false, error: 'DATABASE_URL not configured' }

        const filePath = path.join(BACKUP_DIR, filename)
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'Backup file not found' }
        }

        console.log(`Restoring from ${filename}...`)

        // psql restore command: clean existing schema and restore
        // -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" might be needed if not contained in dump
        // But standard pg_dump usually creates objects if we use --clean or we can rely on standard restore.
        // Let's assume standard psql execution. 
        // Warning: This appends/overwrites. Ideally we should drop schema first.
        // Let's try simple execution first.

        const psqlPath17 = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
        const psqlPath16 = 'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe';

        let restoreCommand = 'psql';
        if (fs.existsSync(psqlPath17)) {
            restoreCommand = `"${psqlPath17}"`;
        } else if (fs.existsSync(psqlPath16)) {
            restoreCommand = `"${psqlPath16}"`;
        }

        // 1. Reset Schema (Drop & Recreate public schema to ensure clean slate)
        const resetCommand = `${restoreCommand} "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`;
        await execAsync(resetCommand);

        // 2. Restore Data
        // Input file option (-f) must come BEFORE the connection URL
        const command = `${restoreCommand} -f "${filePath}" "${dbUrl}"`

        await execAsync(command)
        revalidatePath('/admin')
        return { success: true, message: `Database restored from ${filename}` }
    } catch (error: any) {
        console.error('Restore failed:', error)
        return { success: false, error: `Restore failed: ${error.message}` }
    }
}
