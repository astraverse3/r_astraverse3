export interface CheckResult {
    row: number
    reason: string
    data?: any
}

export interface ExcelImportResult {
    success: boolean
    counts: {
        total: number
        success: number
        skipped: number
        failed: number
    }
    errors: CheckResult[] // List of skipped/failed rows with reasons
    message?: string // Optional summary message
}

export function formatImportResult(result: ExcelImportResult): string {
    const { total, success, skipped, failed } = result.counts
    let message = `총 ${total}건 처리 완료\n` +
        `- 성공: ${success}건\n` +
        `- 건너뜀(필수값 누락 등): ${skipped}건\n` +
        `- 실패(오류): ${failed}건`

    if (result.errors.length > 0) {
        message += '\n\n[상세 내역 (상위 20건)]'
        result.errors.slice(0, 20).forEach(err => {
            message += `\n- ${err.row}행: ${err.reason}`
        })
        if (result.errors.length > 20) {
            message += `\n... 외 ${result.errors.length - 20}건`
        }
    }

    return message
}
