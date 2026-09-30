/**
 * DB 복원 — 화면에서 뺀 「복구」를 터미널에서만 한다 (사용자 결정 2026-09-30, 백로그 §84).
 *
 * 🔴 로컬 = 운영 Neon DB다. 이 스크립트는 **운영 DB를 백업 파일 시점으로 통째로 되돌린다.**
 *    그 사이 입력된 원물·도정·포장·판매는 전부 사라진다.
 *
 * 하는 일 (--apply):
 *   ① 지금 DB를 `backup_…_before-restore.sql`로 먼저 백업 — 잘못 복원해도 되돌릴 길을 남긴다
 *   ② public 스키마를 지우고 다시 만든 뒤 ③ 백업 파일을 psql로 적용 ④ 감사로그 1건
 *
 * 사용법:
 *   npx tsx scripts/restore-backup.ts                                          # 백업 목록
 *   npx tsx scripts/restore-backup.ts backup_2026-09-30T01-02-03.sql           # 확인만 (dry-run)
 *   npx tsx scripts/restore-backup.ts backup_2026-09-30T01-02-03.sql --apply   # 실제 복원
 *
 * ⚠️ Vercel 배포가 도는 동안 실행하지 말 것 · 실행 뒤 브라우저 새로고침(스크립트는 화면 캐시를 못 턴다)
 * 접속은 DIRECT_URL(직결)을 먼저 쓴다 — 덤프의 세션 SET이 pooler(PgBouncer)에서는 이어지지 않는다.
 */
import { PrismaClient } from '@prisma/client'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv, promisify } from 'node:util'
import { backupFilename, isBackupFilename, pgBin, pgEnvFromUrl, resolveBackupPath } from '../lib/backup-file'

const run = promisify(execFile)
const BACKUP_DIR = path.join(process.cwd(), 'backups')
const APPLY = process.argv.includes('--apply')
const FILE = process.argv.slice(2).find(a => !a.startsWith('--'))
const MB = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`

function listBackups() {
    const files = fs.readdirSync(BACKUP_DIR).filter(isBackupFilename).sort().reverse()
    console.log(`백업 ${files.length}개 (최신순):`)
    for (const f of files) console.log(`  ${f}  ${MB(fs.statSync(path.join(BACKUP_DIR, f)).size)}`)
    console.log('\n복원: npx tsx scripts/restore-backup.ts <파일명>  (확인만) → 맨 끝에 --apply')
}

/**
 * 복원할 DB 주소 — Next와 같은 우선순위(`.env.local` → 그 밖)로, **파싱되는 첫 값**.
 * 🔴 `@prisma/client`는 import 순간 `.env`를 process.env에 넣는데, `.env`의 DIRECT_URL은 불완전한 값이다.
 *    그래서 process.env를 그대로 믿지 않고 `.env.local`을 직접 읽는다.
 *    psql·Prisma 둘 다 이 주소 하나로 붙는다(행 수·감사로그가 복원한 DB와 다른 곳에 찍히지 않게).
 */
function pickDbUrl(): { url: string; source: string } {
    const local = fs.existsSync('.env.local') ? parseEnv(fs.readFileSync('.env.local', 'utf8')) : {}
    const sources: Array<[string, Record<string, string | undefined>]> = [['.env.local', local], ['환경변수', process.env]]
    for (const [name, env] of sources) {
        for (const key of ['DIRECT_URL', 'DATABASE_URL']) {
            const v = env[key]
            if (v && URL.canParse(v)) return { url: v, source: `${name} ${key}` }
        }
    }
    throw new Error('쓸 수 있는 DIRECT_URL / DATABASE_URL이 없다')
}

async function counts(datasourceUrl: string) {
    const prisma = new PrismaClient({ datasourceUrl })
    try {
        const [원물, 도정배치, 제품재고, 차감, 생산자, 사용자] = await Promise.all([
            prisma.stock.count(), prisma.millingBatch.count(), prisma.millingOutputPackage.count(),
            prisma.packageMovement.count(), prisma.farmer.count(), prisma.user.count(),
        ])
        return { 원물, 도정배치, 제품재고, 차감, 생산자, 사용자 }
    } finally {
        await prisma.$disconnect()
    }
}

async function restore(filePath: string, env: NodeJS.ProcessEnv) {
    const opts = { env, maxBuffer: 64 * 1024 * 1024 }
    const pre = path.join(BACKUP_DIR, backupFilename(new Date(), '_before-restore'))
    console.log(`\n① 지금 DB 백업 → ${path.basename(pre)}`)
    await run(pgBin('pg_dump'), ['--clean', '--if-exists', '-f', pre], opts)
    console.log('② public 스키마 초기화')
    await run(pgBin('psql'), ['-q', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], opts)
    console.log('③ 백업 적용')
    const { stderr } = await run(pgBin('psql'), ['-q', '-f', filePath], opts)
    if (stderr.trim()) console.log(`  psql 경고/오류:\n${stderr.trim().split('\n').slice(0, 20).join('\n')}`)
    return path.basename(pre)
}

async function main() {
    if (!FILE) return listBackups()
    const filePath = resolveBackupPath(BACKUP_DIR, FILE)
    if (!fs.existsSync(filePath)) throw new Error(`파일 없음: ${FILE}`)
    const { url: dbUrl, source } = pickDbUrl()
    const pgEnv = pgEnvFromUrl(dbUrl)

    console.log(`대상 DB  : ${pgEnv.PGHOST} / ${pgEnv.PGDATABASE} (${source})`)
    console.log(`백업 파일: ${FILE} (${MB(fs.statSync(filePath).size)})`)
    console.log('지금 DB  :', await counts(dbUrl))

    if (!APPLY) {
        console.log('\n🔴 --apply를 붙이면 지금 DB를 지우고 이 파일 시점으로 되돌린다. dry-run이라 아무것도 안 바꿨다')
        return
    }

    const pre = await restore(filePath, { ...process.env, ...pgEnv })
    console.log('복원 후  :', await counts(dbUrl))

    const prisma = new PrismaClient({ datasourceUrl: dbUrl })
    try {
        await prisma.auditLog.create({
            data: {
                action: 'RESTORE',
                entity: 'System',
                userName: 'script',
                description: `DB 복원: ${FILE} (복원 직전 상태는 ${pre}) — scripts/restore-backup.ts`,
            },
        })
    } finally {
        await prisma.$disconnect()
    }
    console.log(`\n완료. 되돌리려면: npx tsx scripts/restore-backup.ts ${pre} --apply · 브라우저 새로고침`)
}

main().catch(e => {
    console.error(`중단: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
})
