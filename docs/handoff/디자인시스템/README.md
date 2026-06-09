# 땅끝황토친환경 재고관리 시스템 — 디자인 핸드오프

> **Claude Code 전달용**. 이 문서만 열어 요약을 파악하고, 세부는 `handoff.md`와 `design-system.html`을 참조하세요.

## 스택
- **Next.js 16.1.3** (App Router)
- **React 19.2.3**
- **Tailwind CSS v4**
- **shadcn/ui** (Radix UI + tw-animate-css)
- **lucide-react** (아이콘 고정)
- **TypeScript**

## 브랜드 컬러
- **Primary**: `#2563eb` (Blue-600) ← 레거시 `#00a2e8`은 사용하지 않음
- **Neutral**: Tailwind `slate` 스케일
- shadcn 시맨틱 토큰(`bg-primary`, `text-muted-foreground` 등) 준수
- 다크모드(`.dark` 스코프) 지원

## 전달 범위
| 영역 | 설명 |
|---|---|
| Foundations | 색상·타이포·스페이싱·radius·shadow·motion |
| Iconography | 핵심 5 메뉴 **Set C 듀오톤** / 시스템은 lucide 라인 |
| Navigation | PC 사이드바, 모바일 하단 네비(Goo blob) |
| Header | 1줄 브레드크럼 + 액션 버튼 세트 |
| Components | Tabs(F), 테이블 품종 그룹 펼침, 모바일 품종 카드 |
| Patterns | 목록 페이지 헤더, 검색 다이얼로그 |

## 변환 원칙 (시안 → 실제 코드)
1. **인라인 JSX 데모 코드를 그대로 복붙하지 말고** shadcn 컴포넌트로 치환
   - `<button className="...bg-[#00a2e8]...">` → `<Button variant="default">` + Primary 토큰
2. **Tailwind 임의 값 (`text-[12.5px]`, `bg-[#00a2e8]`) 을 시맨틱 토큰으로**
   - `bg-[#00a2e8]` → `bg-primary`
   - `text-slate-500` → `text-muted-foreground`
3. **Set C 듀오톤 아이콘은 `components/icons/` 로 분리**해 lucide-react 스타일의 컴포넌트로 이식
4. **다크모드 토큰을 반드시 CSS 변수로 정의** — shadcn의 `--primary`, `--muted-foreground` 등 활용

자세한 내용 → `handoff.md`
