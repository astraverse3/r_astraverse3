
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
