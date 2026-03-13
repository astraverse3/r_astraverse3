import { BackupManager } from "@/components/admin/BackupManager"

export default function AdminBackupPage() {
    return (
        <div className="space-y-3 px-1.5 sm:px-0 pb-8 sm:pb-0">
            {/* Backup Manager: Only available in local environment */}
            {!process.env.VERCEL ? (
                <BackupManager />
            ) : (
                <div className="p-4 border rounded-lg bg-slate-50 text-slate-500 text-sm">
                    시스템 백업 및 복구 기능은 로컬 환경에서만 사용할 수 있습니다.
                </div>
            )}
        </div>
    )
}
