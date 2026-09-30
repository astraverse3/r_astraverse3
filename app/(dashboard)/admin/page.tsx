import { redirect } from 'next/navigation'

export default function AdminPage() {
    // 시스템 백업은 로컬 전용 — 실서버에선 메뉴를 숨겼으니 기본 이동도 활동 로그로
    redirect(process.env.VERCEL ? '/admin/logs' : '/admin/backup')
}
