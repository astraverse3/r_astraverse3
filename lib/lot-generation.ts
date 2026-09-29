import { toKstDate } from './kst-date'


/**
 * 도정유형별 기대수율 반환.
 * 향후 관리자 설정 페이지에서 DB 값으로 교체 예정.
 */
export function getYieldRate(millingType: string): number {
    if (millingType.includes('현미'))   return 0.70
    if (millingType.includes('인디카')) return 0.65
    if (millingType === '칠분도미' || millingType === '오분도미') return 0.69
    if (millingType.includes('백미'))   return 0.68
    return 0.68 // 기타
}

/**
 * Helper to determine product code based on Variety Type and Milling Type.
 * This logic is shared between Milling and potential future Japgok management.
 */
export function getProductCode(varietyType: string, varietyName: string, millingType: string): string {
    // 1. Check for Japgok (Category 2) based on Variety Name
    // Mapping based on user provided table
    if (varietyName.includes('보리')) {
        if (varietyName.includes('검정')) return '215'; // 검정보리
        return '21'; // 보리
    }
    if (varietyName.includes('통밀')) return '22';
    if (varietyName.includes('수수')) return '23';
    if (varietyName.includes('기장')) return '24';
    if (varietyName.includes('차조')) return '25';
    if (varietyName.includes('백태') || (varietyName.includes('콩') && !varietyName.includes('서리') && !varietyName.includes('쥐눈'))) return '26'; // 콩(백태)
    if (varietyName.includes('귀리')) return '27';
    if (varietyName.includes('참깨')) return '28';
    if (varietyName.includes('아마란스')) return '29';
    if (varietyName.includes('율무')) return '210';
    if (varietyName.includes('녹두')) return '211';
    if (varietyName.includes('팥') || varietyName.includes('적두')) return '212';
    if (varietyName.includes('서목태') || varietyName.includes('쥐눈이')) return '213';
    if (varietyName.includes('서리태')) return '214';

    // 2. Check for Rice (Category 1)

    // Special Rice Varieties
    if (varietyName.includes('발아현미')) return '131'; // 발아현미
    if (varietyType === 'BLACK' || varietyName.includes('흑미')) return '15'; // 흑미
    if (varietyName.includes('녹미')) return '16'; // 녹미
    if (varietyName.includes('홍미')) return '17'; // 홍미

    // Standard Rice
    const isBrown = millingType.includes('현미');

    if (varietyType === 'URUCHI') {
        return isBrown ? '13' : '11'; // 13: 현미, 11: 백미/분도미
    }
    if (varietyType === 'GLUTINOUS') {
        return isBrown ? '14' : '12'; // 14: 현미(찹쌀), 12: 백미(찹쌀)
    }
    if (varietyType === 'INDICA') {
        return isBrown ? '19' : '18'; // 19: 현미(인디카), 18: 백미(인디카) - Changed order? verification: user agreed to '백미(18) / 현미(19)'
    }

    // Default Fallback
    return '00';
}

export interface LotGenerationParams {
    incomingDate: Date
    varietyType: string
    varietyName: string
    millingType: string
    certNo: string
    farmerGroupCode: string
    farmerNo: string
}

export function generateLotNo({
    incomingDate,
    varietyType,
    varietyName,
    millingType,
    certNo,
    farmerGroupCode,
    farmerNo
}: LotGenerationParams): string {
    // 1. Date: YYMMDD
    const yymmdd = toKstDate(incomingDate).slice(2).replace(/-/g, ''); // KST — UTC로 자르면 KST 00~09시가 전날(§39)

    // 2. Product Code
    const productCode = getProductCode(varietyType, varietyName, millingType);

    // 3. Personal No
    const personalNo = `${farmerGroupCode}${farmerNo}`;

    // Final Lot No
    return `${yymmdd}-${productCode}-${certNo}-${personalNo}`;
}

// ------------------------------------------------------
// 첫 로트 재사용 (plan-로트재사용경고.md)
//
// 같은 농가·품종·인증이면 로트는 앞 6자리(입고일)만 다르다 → 사흘에 나눠 들어오면 로트가 셋.
// 등록 때 입고일을 첫 로트 날짜로 맞춰 한 로트로 모은다(입고일자 칸 = 「Lot 기준」, 입력 시각은 createdAt).
// ------------------------------------------------------

/** 로트 뒷자리(품목코드-인증번호-개인번호). 같은 농가·품종·인증이면 같다 */
export function lotTail(lotNo: string): string {
    return lotNo.slice(lotNo.indexOf('-') + 1)
}

export type LotCandidate = { lotNo: string; incomingDate: Date }

/** 첫 로트 — date는 KST 'yyyy-mm-dd', count는 그 로트에 이미 묶인 원물 수 */
export type FirstLot = { date: string; lotNo: string; count: number }

/**
 * 뒷자리가 같은 후보 중 입고일이 가장 이른 로트. 없으면 null.
 * 🔴 뒷자리로 거르는 이유: 작목반(인증)이 바뀌었거나 옛 규칙으로 저장된 로트(품목코드가 다른 것)는 같은 로트가 아니다.
 */
export function pickFirstLot(candidates: readonly LotCandidate[], tail: string): FirstLot | null {
    const same = candidates.filter(c => lotTail(c.lotNo) === tail)
    if (same.length === 0) return null
    const first = same.reduce((a, b) => (toKstDate(b.incomingDate) < toKstDate(a.incomingDate) ? b : a))
    return {
        date: toKstDate(first.incomingDate),
        lotNo: first.lotNo,
        count: same.filter(c => c.lotNo === first.lotNo).length,
    }
}

/** 새 입고일(KST 'yyyy-mm-dd')을 첫 로트에 맞춰야 하나 — 첫 로트보다 늦을 때만. 같은 날이면 이미 같은 로트, 이르면(소급) 새 로트 */
export function shouldAlignToFirstLot(first: FirstLot | null, ymd: string): first is FirstLot {
    return first !== null && ymd > first.date
}
