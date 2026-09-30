# 계획서: 백업 복원을 스크립트로만 (백로그 §84)

- 작성: 2026-09-30
- 상태: **승인(2026-09-30) · 완료**

> **진행 중 바뀐 것**
> - 화면 파일은 `components/admin/BackupManager.tsx`(복구 버튼·작업 칸 제거) + `app/(dashboard)/admin/backup/page.tsx`(문구)였다
> - 파일명 검증·접속 정보 변환은 `lib/backup-file.ts`로 빼서 화면 백업과 스크립트가 같이 쓴다(테스트 6개)
> - 🔴 스크립트의 DB 주소는 `.env.local`을 **직접** 읽는다 — `@prisma/client`가 import 순간 `.env`를 먼저 넣는데 `.env`의 `DIRECT_URL`이 불완전한 값이라 `Invalid URL`로 멈췄다. Prisma(행 수·감사로그)도 `datasourceUrl`로 같은 주소에 붙인다
> - 복원 직전 자동 백업 이름은 `backup_…_before-restore.sql`(화이트리스트에 포함)
- 발단: 사용자 「스크립트로만 하게 해줘. 잘못 누를 수도 있는 거니까」

## 1. 목표

관리자 화면(`/admin/backup`)의 **「복원」을 없앤다.** 로컬 개발 서버가 운영 Neon DB에 붙어 있어서, 버튼 한 번이 **운영 DB를 `DROP SCHEMA public CASCADE` 한 뒤 백업 시점으로 되돌린다.** 복원은 터미널에서 일부러 치는 스크립트로만 한다.
백업 **만들기**는 화면에 그대로 둔다(되돌릴 수 없는 동작이 아니다).

## 2. 변경 범위

| 파일 | 변경 |
|---|---|
| `app/actions/backup.ts` | `restoreBackup` **삭제**(export된 서버 액션 = 엔드포인트라 버튼만 숨기면 안 된다 — §56 교훈). `createBackup`은 유지하되 S2 처방 적용: `exec` 문자열 → `execFile`, `DATABASE_URL`을 명령줄에 안 싣고 `PGPASSWORD` 환경변수로, 에러 로그 sanitize |
| `/admin/backup` 화면 컴포넌트 | 복원 버튼·확인 다이얼로그 제거. 목록에 「복원은 터미널에서: `npx tsx scripts/restore-backup.ts <파일명>`」 안내 한 줄 — ⚠️ 파일 목록은 착수 때 확인(이번 조회는 막혔다) |
| `scripts/restore-backup.ts` **신설** | 아래 3장 |
| `docs/permission-matrix.md` | `restoreBackup` 제거 |
| `docs/리팩토링-백로그.md` §84 | 결정·처리 기록 |

## 3. 복원 스크립트 설계

```
npx tsx scripts/restore-backup.ts backup_2026-09-30T01-02-03.sql            # 확인만 (dry-run)
npx tsx scripts/restore-backup.ts backup_2026-09-30T01-02-03.sql --apply    # 실제 복원
```

- **파일명 화이트리스트** `/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.sql$/` + `path.resolve` 뒤 `backups/` 안인지 이중 확인 → `../.env` · `a" & calc & "` 거부
- **dry-run 기본** — 대상 DB **호스트 이름**(비밀번호 빼고), 파일 크기·만든 시각, 「지금 DB의 주요 테이블 행 수 → 이 파일로 되돌아간다」를 보여 주고 끝낸다
- `--apply`여도 **복원 직전에 현재 DB를 자동 백업**(`backup_…_before-restore.sql`) — 잘못 복원해도 되돌릴 길을 남긴다
- `execFile(psql, [args])` · `PGPASSWORD` 환경변수 · URL은 `new URL()`로 파싱해 `-h -p -U -d`로
- 끝나면 감사로그 1건(`userName='script'`) · ⚠️ 화면 캐시는 브라우저 새로고침(스크립트는 캐시를 못 턴다)

## 4. 범위 밖

- S6 백업 폴더를 저장소(= OneDrive) 밖으로 옮기기 — 기존 15개를 어디로 옮길지 사용자 결정이 먼저라 §84에 남긴다
- §83 가입 승인제 — 사용자 「잠깐만」

## 5. 검증

- tsc · `eslint .` · test(파일명 검증은 순수 함수로 빼서 테스트: 정상 1 · 탈출 · 주입 · 확장자)
- 스크립트 dry-run 1회(운영 DB 읽기만) — 🔴 **배포가 도는 동안은 돌리지 않는다**
- `--apply`는 돌리지 않는다(검증 목적으로 운영 DB를 복원할 수는 없다)
- 화면: 복원 버튼이 없어졌는지 사용자 브라우저 확인

## 6. 단계

1. 백업 화면 파일 확인 → 복원 UI 제거 + 안내 한 줄
2. `backup.ts` — `restoreBackup` 삭제 · `createBackup` execFile/PGPASSWORD
3. `scripts/restore-backup.ts` + 파일명 검증 테스트
4. 문서(permission-matrix · 백로그 §84) → 커밋 → worklog
