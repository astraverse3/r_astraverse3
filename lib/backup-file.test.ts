import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'
import { backupFilename, isBackupFilename, pgEnvFromUrl, resolveBackupPath } from './backup-file'

const DIR = path.resolve('backups')

// ------------------------------------------------------
// 파일명 · 경로 — 백로그 §84 (경로 탈출·셸 주입)
// ------------------------------------------------------
test('isBackupFilename: 화면이 만드는 이름과 복원 직전 자동 백업만 통과', () => {
  assert.equal(isBackupFilename('backup_2026-09-30T01-02-03.sql'), true)
  assert.equal(isBackupFilename('backup_2026-09-30T01-02-03_before-restore.sql'), true)
  assert.equal(isBackupFilename('backup_2026-09-30.sql'), false)
  assert.equal(isBackupFilename('backup_2026-09-30T01-02-03.sql.gz'), false)
  assert.equal(isBackupFilename('merge-barley-2026-09-01.json'), false)
})

test('backupFilename: 만든 이름은 검증을 통과한다', () => {
  const now = new Date('2026-09-30T01:02:03.456Z')
  assert.equal(backupFilename(now), 'backup_2026-09-30T01-02-03.sql')
  assert.equal(backupFilename(now, '_before-restore'), 'backup_2026-09-30T01-02-03_before-restore.sql')
  assert.equal(isBackupFilename(backupFilename(now, '_before-restore')), true)
})

test('resolveBackupPath: 정상 파일은 백업 폴더 안 절대 경로', () => {
  assert.equal(resolveBackupPath(DIR, 'backup_2026-09-30T01-02-03.sql'), path.join(DIR, 'backup_2026-09-30T01-02-03.sql'))
})

test('resolveBackupPath: 폴더 탈출·셸 문자·빈 이름은 거부', () => {
  for (const bad of ['../.env', '..\\.env', 'a" & calc & "', 'backup_2026-09-30T01-02-03.sql" & calc', '', '/etc/passwd']) {
    assert.throws(() => resolveBackupPath(DIR, bad), /잘못된 파일명/, bad)
  }
})

// ------------------------------------------------------
// 접속 정보 — URL을 명령줄에 싣지 않는다
// ------------------------------------------------------
test('pgEnvFromUrl: 비밀번호는 환경변수로, 퍼센트 인코딩은 풀어서', () => {
  const env = pgEnvFromUrl('postgresql://app%40user:p%40ss%3Aw0rd@ep-x-pooler.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
  assert.deepEqual(env, {
    PGHOST: 'ep-x-pooler.aws.neon.tech',
    PGPORT: '5432',
    PGUSER: 'app@user',
    PGPASSWORD: 'p@ss:w0rd',
    PGDATABASE: 'neondb',
    PGSSLMODE: 'require',
    PGCHANNELBINDING: 'require',
  })
})

test('pgEnvFromUrl: 포트·쿼리 없는 URL', () => {
  const env = pgEnvFromUrl('postgresql://u:p@localhost:6543/db')
  assert.equal(env.PGPORT, '6543')
  assert.equal(env.PGSSLMODE, undefined)
})
