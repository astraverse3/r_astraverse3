const MAX_EXCEL_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_EXCEL_MIME = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/octet-stream', // 일부 브라우저는 빈 MIME을 보낼 수 있음
])

const ALLOWED_EXCEL_EXT = ['.xlsx', '.xls']

export function validateExcelUpload(file: File): void {
    if (!file) throw new Error('파일이 없습니다.')

    if (file.size === 0) {
        throw new Error('빈 파일입니다.')
    }
    if (file.size > MAX_EXCEL_SIZE) {
        throw new Error(`파일 크기가 너무 큽니다. 최대 ${MAX_EXCEL_SIZE / 1024 / 1024}MB까지 업로드 가능합니다.`)
    }

    const name = (file.name || '').toLowerCase()
    const hasValidExt = ALLOWED_EXCEL_EXT.some(ext => name.endsWith(ext))
    if (!hasValidExt) {
        throw new Error('엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다.')
    }

    if (file.type && !ALLOWED_EXCEL_MIME.has(file.type)) {
        throw new Error('허용되지 않은 파일 형식입니다.')
    }
}
