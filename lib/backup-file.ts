/**
 * DB 백업 파일·접속 정보 — 화면의 「백업 생성」(`app/actions/backup.ts`)과
 * 복원 스크립트(`scripts/restore-backup.ts`)가 같이 쓴다 (백로그 §84).
 *
 * 🔴 복원은 화면에 두지 않는다(사용자 2026-09-30). 로컬 개발 서버가 운영 DB에 붙어 있어서
 *    버튼 한 번이 운영 DB를 `DROP SCHEMA` 한 뒤 백업 시점으로 되돌렸다.
 */
import fs from 'fs'
import path from 'path'

/** `backup_2026-09-30T01-02-03.sql` · 복원 직전 자동 백업은 `_before-restore`가 붙는다 */
export const BACKUP_FILENAME = /^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(_before-restore)?\.sql$/

export function isBackupFilename(name: string): boolean {
    return BACKUP_FILENAME.test(name)
}

/** 새 백업 파일명 — UTC 기준(기존 파일들과 같은 규칙) */
export function backupFilename(now: Date, suffix = ''): string {
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    return `backup_${stamp}${suffix}.sql`
}

/**
 * 파일명을 검증하고 백업 폴더 안의 절대 경로를 돌려준다.
 * 이름 규칙(화이트리스트)과 경로 접두(이중 방어) 둘 다 통과해야 한다 — `../.env`·셸 문자 차단.
 */
export function resolveBackupPath(dir: string, name: string): string {
    if (!isBackupFilename(name)) throw new Error(`잘못된 파일명: ${name}`)
    const base = path.resolve(dir)
    const full = path.resolve(base, name)
    if (!full.startsWith(base + path.sep)) throw new Error(`잘못된 파일명: ${name}`)
    return full
}

/**
 * `DATABASE_URL` → libpq 환경변수. URL(비밀번호 포함)을 **명령줄 인자로 넘기지 않기 위해** 쓴다 —
 * 인자는 프로세스 목록·에러 메시지(`Command failed: …`)에 그대로 찍힌다.
 */
export function pgEnvFromUrl(databaseUrl: string): Record<string, string> {
    const url = new URL(databaseUrl)
    const env: Record<string, string> = {
        PGHOST: url.hostname,
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    }
    const sslmode = url.searchParams.get('sslmode')
    if (sslmode) env.PGSSLMODE = sslmode
    const channelBinding = url.searchParams.get('channel_binding')
    if (channelBinding) env.PGCHANNELBINDING = channelBinding
    return env
}

/** 로컬에 설치된 PostgreSQL 도구 경로(없으면 PATH에 맡긴다) */
export function pgBin(tool: 'pg_dump' | 'psql'): string {
    const candidates = [17, 16].map(v => `C:\\Program Files\\PostgreSQL\\${v}\\bin\\${tool}.exe`)
    return candidates.find(p => fs.existsSync(p)) ?? tool
}
