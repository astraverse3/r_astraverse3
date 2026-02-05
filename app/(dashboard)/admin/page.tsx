import { BackupManager } from "@/components/admin/BackupManager"
import { ShieldAlert } from "lucide-react"

export default function AdminPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <ShieldAlert className="h-6 w-6 text-slate-600" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">시스템 관리</h1>
            </div>

            <div className="grid gap-6">
                {/* Backup Manager: Only available in local environment */}
                {!process.env.VERCEL ? (
                    <BackupManager />
                ) : (
                    <div className="p-4 border rounded-lg bg-slate-50 text-slate-500 text-sm">
                        시스템 백업 및 복구 기능은 로컬 환경에서만 사용할 수 있습니다.
                    </div>
                )}
            </div>
        </div>
    )
}
