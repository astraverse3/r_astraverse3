/**
 * recharts 커스텀 툴팁이 받는 값 중 여기서 읽는 것만 적은 구조 타입.
 * `content={<X />}` 요소 형태로 넘기면 recharts가 런타임에 채워 넣으므로 전부 선택적이다.
 */
export type ChartTooltipEntry = {
    dataKey?: string | number
    name?: string
    value: number
    fill?: string
    /** 그 막대/조각의 원본 데이터 행 — 차트마다 모양이 달라 읽는 쪽에서 좁힌다 */
    payload?: unknown
}

export type ChartTooltipProps = {
    active?: boolean
    label?: string | number
    payload?: ReadonlyArray<ChartTooltipEntry>
}
