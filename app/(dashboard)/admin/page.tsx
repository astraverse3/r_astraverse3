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
                <BackupManager />
            </div>
        </div>
    )
}
