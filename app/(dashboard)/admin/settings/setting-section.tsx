import type { ReactNode } from 'react';

/**
 * 설정 카드 한 장. 훅이 없어 서버·클라이언트 양쪽에서 import 가능하다.
 * `break-inside-avoid`·`mb-4` — 부모가 `columns-*` 흐름이라 세로 간격을 카드가 직접 갖는다
 * (`space-y-*`를 쓰면 컬럼 경계에서 마진이 어긋난다).
 */
export function SettingSection({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description?: string;
    /** 헤더 우측 슬롯 — 저장 버튼 등 */
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm break-inside-avoid mb-4">
            <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-slate-100">
                <div className="min-w-0">
                    <h2 className="text-[13px] font-bold text-slate-800">{title}</h2>
                    {description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            <div className="px-4 py-3">{children}</div>
        </div>
    );
}
