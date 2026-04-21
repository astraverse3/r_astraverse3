# 공지사항 목록 페이지 추가 계획

## 목표
일반 사용자도 대시보드 마키에서 클릭한 팝업에서 "전체 목록 보기" 링크를 통해 **공지사항 전체 목록 페이지**로 이동해 과거 공지까지 훑어볼 수 있게 한다.

## 배경
- 현재 대시보드 상단 마키(`NoticeMarquee`)에서 공지 클릭 → `NoticeViewDialog` 팝업으로 한 건씩 확인만 가능
- 관리자 전용 `/admin/notices`는 있지만 NOTICE_MANAGE 권한 필요
- 일반 사용자가 지난 공지를 찾아보거나, 현재 활성 공지 여러 건을 한눈에 볼 방법이 없음

## 설계

### 라우트
- `/notices` (dashboard layout 하위)
- 로그인만 되어있으면 누구나 접근 가능 (`requireSession`)
- 비활성화(`isActive: false`) 공지도 같이 보여줄지 → **활성 공지만** 노출 (현재 `getActiveNotices` 그대로 활용)
  - 근거: 비활성은 관리자가 "숨김" 처리한 것이므로 일반 사용자 목록에 나타나면 안 됨
  - 관리자는 `/admin/notices`에서 모두 확인 가능

### 목록 UI
- 카드 형식으로 세로 나열 (대시보드 톤 매칭)
- 각 카드:
  - 제목 (bold)
  - 작성자 + 등록일
  - 내용 앞 2~3줄 미리보기 (`line-clamp-2`)
  - 클릭 시 기존 `NoticeViewDialog`로 전체 내용 모달 표시
- 빈 상태: "현재 등록된 공지사항이 없습니다"
- 검색/필터는 이번 범위에서 제외 (공지 건수가 많지 않음)
- 모바일 반응형 (카드 그대로 세로 스크롤)

### 팝업 내 "목록으로 가기" 링크
- `NoticeViewDialog` 푸터에 "전체 목록 보기 →" 링크 추가
- 닫기 버튼 왼쪽 또는 작성자 정보 영역 근처
- 클릭 시 `/notices`로 이동 + 팝업은 Next.js 페이지 이동으로 자연스럽게 닫힘

## 변경 파일 (총 4개)

### 1. 새 페이지
- [app/(dashboard)/notices/page.tsx](app/(dashboard)/notices/page.tsx) — 신규
  - Server component, `getActiveNotices()` 호출 후 클라이언트 컴포넌트에 전달

### 2. 새 클라이언트 컴포넌트
- [app/(dashboard)/notices/notice-list-client.tsx](app/(dashboard)/notices/notice-list-client.tsx) — 신규
  - 카드 목록 렌더링 + 클릭 시 `NoticeViewDialog` 열기
  - 이미 존재하는 `NoticeViewDialog` 재사용

### 3. 팝업 수정
- [components/admin/NoticeViewDialog.tsx](components/admin/NoticeViewDialog.tsx)
  - 푸터에 "전체 목록 보기" Link 추가
  - 현재 라우트가 `/notices`인 경우 표시하지 않도록 조건부 렌더 (`usePathname`) — 같은 페이지 내 루프 방지

### 4. 사이드바 메뉴 (선택)
- [components/desktop-sidebar.tsx](components/desktop-sidebar.tsx) / [components/mobile-header.tsx](components/mobile-header.tsx)
  - "공지사항" 메뉴를 상시 메뉴에 추가할지 여부 → **이번에는 추가하지 않음**
  - 근거: 팝업 링크로 접근 가능 + 메뉴 늘어나는 부담. 필요 시 추후 별도 요청

## 레이아웃 톤
- 페이지 제목: "공지사항" (Breadcrumb은 기존 규칙 따름)
- 카드 스타일: 재고 목록(`stocks`)의 모바일 카드 톤과 유사하게 `border-slate-200 bg-white rounded-xl`
- 주황 계열 포인트(확성기 아이콘) — 마키/팝업과 색감 통일

## 제외 항목
- 공지 검색/필터 (건수 적어 불필요)
- 비활성 공지 노출 (관리자 전용)
- 페이지네이션 (건수 적으면 무한 스크롤도 불필요)
- 사이드바 메뉴 추가

## 확인 필요 사항
1. 일반 사용자 라우트 `/notices`로 OK? 아니면 `/announcements` 등 다른 이름 선호?
2. 사이드바에 "공지사항" 메뉴를 상시 노출할지 여부
3. 비활성 공지는 완전히 숨기는 게 맞는지
