import { getYieldRates } from '@/app/actions/settings';
import { MILLING_TYPES, DEFAULT_YIELD_RATES } from '@/lib/settings-constants';
import { SettingsClient } from './settings-client';
import { listShippingVendors } from '@/app/actions/shipping-vendor';
import { ShippingVendorSection } from './shipping-vendor-section';
import { SettingSection } from './setting-section';

export default async function AdminSettingsPage() {
    const [yieldRates, vendorResult] = await Promise.all([
        getYieldRates(),
        listShippingVendors(),
    ]);
    const vendors = vendorResult.success ? vendorResult.data ?? [] : [];

    return (
        <div className="px-1.5 sm:px-0 pb-24 sm:pb-8 columns-1 xl:columns-2 gap-4">

            {/* 긴 카드를 먼저 — 두 컬럼 높이가 자동으로 맞는다 */}
            <SettingSection
                title="배송업체"
                description="발주서 묶음의 배송업체 목록입니다. 순서를 바꾸면 등록 화면 드롭다운에도 같은 순서로 나옵니다."
            >
                <ShippingVendorSection vendors={vendors} />
            </SettingSection>

            {/* 수율은 자체 헤더(저장 버튼 슬롯)를 쓰므로 SettingSection을 클라이언트에서 렌더 */}
            <SettingsClient
                initialRates={yieldRates}
                millingTypes={[...MILLING_TYPES]}
                defaultRates={DEFAULT_YIELD_RATES}
            />

            {/* 새 설정 항목은 여기에 <SettingSection> 추가 — 짧은 카드는 알아서 빈 자리에 붙는다 */}

        </div>
    );
}
