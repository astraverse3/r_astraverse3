import { getYieldRates } from '@/app/actions/settings';
import { MILLING_TYPES, DEFAULT_YIELD_RATES } from '@/lib/settings-constants';
import { SettingsClient } from './settings-client';

export default async function AdminSettingsPage() {
    const yieldRates = await getYieldRates();

    return (
        <div className="space-y-4 px-1.5 sm:px-0 pb-24 sm:pb-8">

            {/* 섹션: 수율 기준값 */}
            <SettingSection
                title="도정구분별 수율 기준값"
                description="도정 작업 시 기대 수율(%) 기준으로 사용됩니다. 기본값은 괄호 안 숫자입니다."
            >
                <SettingsClient
                    initialRates={yieldRates}
                    millingTypes={[...MILLING_TYPES]}
                    defaultRates={DEFAULT_YIELD_RATES}
                />
            </SettingSection>

            {/* 새 설정 섹션은 아래에 <SettingSection> 추가 */}

        </div>
    );
}

function SettingSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">{title}</h2>
                {description && (
                    <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                )}
            </div>
            <div className="px-5 py-4">
                {children}
            </div>
        </div>
    );
}
