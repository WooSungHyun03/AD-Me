# AD Me — Figma 디자인 브리프

작성일 2026-11-23 · 근거: `docs/youtube-harness/SCREENS_UX.md`, `PRODUCT_SPEC.md`, `ADMIN.md`, `CHAT_APPLICATIONS.md`, `docs/DESIGN_SYSTEM.md`, `src/app/globals.css`, `src/app/**/page.tsx`

> 목적: Figma에서 무엇을 그려야 하는지, 이미 코드에 어떤 설계(규칙·상태·권한)가 박혀 있는지 한 곳에 정리.

---

## 1. 제품 한 줄 요약

**YouTube 전용 브랜드 × 크리에이터 광고 매칭 마켓플레이스.**
브랜드는 AI로 맞는 유튜버를 찾거나 공고를 올리고, 유튜버는 채널 소유를 인증한 뒤 공고에 지원하거나 상단 스폰서 노출을 산다. 결제는 전부 **Toss TEST**(실제 돈 없음).

### 역할 4종 (화면이 역할별로 갈림)
| 역할 | 핵심 행동 |
|---|---|
| 비회원 | 홈·가격·공고 목록·공개 채널 열람 (연락처·채팅·유료 분석 불가) |
| 브랜드 | 캠페인/상품 등록 → AI 검색(유료) → 비교·후보 그룹 → 공고 게시(유료) → 지원자 검토 → 채팅 |
| 크리에이터 | YouTube OAuth 채널 인증 → 프로필·연락처 공개 범위 설정 → 공고 지원(유료) → 스폰서 30일(유료) |
| 관리자 | 6개 세부 권한(super_admin, creator_reviewer, campaign_moderator, billing_operator, data_ops, support) |

### 4가지 수익 경로 (홈·가격 화면에 정확히 이 4개)
| 상품 | 지불 | TEST 가격(가설) | 차감 시점 |
|---|---|---|---|
| AI 검색 1회 | 브랜드 | 3,000원 | 추천 결과 저장 성공 후 (같은 조건 재열람 무료) |
| 공고 게시 1건 | 브랜드 | 5,000원 | `published` 확정 시 (초안 무료) |
| 공고 지원 1건 | 크리에이터 | 1,000원 | `submitted` 확정 시 (중복 지원 불가) |
| 스폰서 30일 | 크리에이터 | 9,900원 | 결제 승인 후 30일 |

---

## 2. 디자인 시스템 (Figma Variables/Styles로 먼저 만들 것)

### 2.1 컬러 토큰 — 현재 코드 값(`globals.css`)
| 토큰 | 값 | 용도 |
|---|---|---|
| `canvas` | `#F5F5F0` | 페이지 배경 (warm off-white) |
| `surface` | `#FFFFFF` | 카드·패널 |
| `ink` | `#111312` | 본문 텍스트, 다크 섹션 배경 |
| `muted` | `#667064` | 보조 텍스트 |
| `line` | `#DADDD3` | 구분선·테두리 |
| `lime` | `#D7FF45` | **CTA·하이라이트만.** 흰 배경 위 작은 lime 텍스트 금지 |
| focus | `#659000` | 포커스 링 3px, offset 4px |
| hover link | `#547000` | 링크 hover |
| danger / warning | `#B8453D` / `#AA6A21` | 오류·경고 (DESIGN_SYSTEM.md) |

> ⚠️ 문서들끼리 미세하게 다름 (`#F6F6F0` vs `#F5F5F0`, muted `#737971`/`#67706A`/`#667064`). **Figma에서 하나로 확정**하고 코드 토큰을 맞추는 게 이번 작업의 첫 결정 포인트.

### 2.2 타이포그래피
- 현재 폰트: `Arial, "Noto Sans KR"`, letter-spacing `-0.035em`. → Figma에서 **Pretendard / Noto Sans KR** 중 확정 권장.
- 현재 사이즈: Hero `clamp(40–78px)`, page-title `clamp(28–43px)`, 30 / 21 / 17 / 14 / 12px. 본문 14–16px.
- 정리할 스케일: Display / H1 / H2 / H3 / Body L / Body / Caption / Label.

### 2.3 레이아웃·간격
- 8px 그리드. 좌우 패딩 5%, 섹션 패딩 64px.
- 헤더 높이 94px, 로고 최대 ~48px.
- 프레임: **Desktop 1440 / Tablet 768 / Mobile 390** — 모든 화면 3종 (최소 1440+390).
- 모서리: 기본 6–8px, 시그니처 비대칭 모양 `8 8 100 8` / `100 100 8 8` (hero art·portrait에 사용 중).
- 모션 ≤200ms, reduced-motion 대응.

### 2.4 브랜드 에셋 (`public/brand/`)
`ad-me-logo.png`(원본 1254²), `ad-me-logo-trimmed.png`, `ad-me-symbol.png`, `ad-me-wordmark.png`
- **원본 그대로 사용, 재해석·이모지·마스코트 금지.**
- 워드마크가 검정이라 **검은 헤더 위에 두지 말 것** — 밝은 배경 위에.

### 2.5 비주얼 방향
- 에디토리얼 B2B SaaS. 절제된 위계, 넉넉한 여백.
- 금지: 파란 그라데이션, 반복되는 거대한 둥근 카드, 글래스모피즘 과다, 스톡 인물 사진, 과장된 수치.
- Hero = 짧은 헤드라인 + **실제 검색 컨트롤** + 매칭을 암시하는 기하 도형.

---

## 3. 컴포넌트 목록 (Figma 컴포넌트로 만들 것)

현재 CSS 클래스 기준으로 추출. ✅ = 코드에 있음, 🆕 = 스펙엔 있는데 아직 없음.

| 그룹 | 컴포넌트 | 상태 |
|---|---|---|
| 기본 | Button (primary=lime / dark / outline / ghost / small / icon-button) | ✅ |
| 기본 | Badge, Tag chip, Eyebrow, Notice(info/success/error), Empty, Loading skeleton | ✅ |
| 폼 | Field, form-grid/form-stack, Filters 패널, Toolbar, Search bar | ✅ |
| 데이터 | Data table(+가로 스크롤), Metric row, Score breakdown | ✅ |
| 크리에이터 | Creator card (썸네일·핸들·플랫폼·바이브 칩 3개·출처 있는 추정치·액션) | ✅ |
| YouTube | 채널 hero(배너·아바타·핸들), 지표 묶음, 최근 영상 그리드, 토픽 리스트, 광고 이력 | ✅ |
| 매칭 | 번호 매긴 결과 카드 + 근거/불확실성 + 점수 분해 | ✅ |
| 비교 | Compare bar(하단 고정), 비교 테이블 | ✅ |
| 결제 | Plan 카드, Checkout, **TEST 배지**, 수수료 시뮬레이터 | ✅ |
| 광고 | **스폰서 카드/캐러셀** (organic과 분리, "스폰서" 라벨 필수) | ✅ |
| 운영 | ops-nav, ops-section, ops-row, ops-form | ✅ (단순형) |
| 메시징 | 대화 목록, 말풍선, 안읽음 배지, 차단/신고 메뉴 | 🆕 (live-chat 일부만) |
| 운영 | 사이드바 + 고밀도 테이블 + **상세 드로어** + 위험 작업 확인 모달(사유 입력) | 🆕 |
| 공통 | 데이터 출처·수집 시각 라벨, 데모/샘플 라벨, 소유 인증 배지(자동 발견 vs 인증) | ✅ 일부 → 컴포넌트화 필요 |
| 공통 | 상태 칩 (공고·지원·결제·인증 상태 — §5 참고) | 🆕 통일 필요 |

---

## 4. 화면 목록

✅ 구현됨 · 🟡 구현됐지만 스펙과 차이 · 🆕 스펙에만 있음(디자인 먼저 하면 좋은 곳)

### 4.1 공개 영역
| URL | 상태 | 꼭 들어갈 것 |
|---|---|---|
| `/` 홈 | ✅ | 서비스 소개, 작동 방식, **수익 경로 4개**, 데모 고지, 주목할 채널, CTA(검색/공고 보기/채널 인증) |
| `/pricing` | ✅ | 항목별 TEST 가격, 크레딧·30일 패스, 환불·만료 규칙 |
| `/about`, `/help`, `/privacy` | ✅ | 데이터 출처·점수 설명·문의 폼 |
| `/terms` | 🆕 | 약관 |
| `/login`, `/signup`, `/auth/*`, 비번 찾기/재설정 | ✅ | 역할(브랜드/크리에이터) 선택 가입, 이메일 인증, 오류 |

### 4.2 탐색·검색 (브랜드 핵심)
| URL | 상태 | 꼭 들어갈 것 |
|---|---|---|
| `/creators` | ✅ | 등록 프로필 + 자동 발견 채널 구분 |
| `/creators/youtube`, `/creators/youtube/[id]` | ✅ | 채널 개요·콘텐츠 분석·최근 영상·광고/협업, **수집 날짜**, 인증 여부 |
| `/creators/[id]` | ✅ | 크리에이터 상세 + 제안/채팅/인증 CTA |
| `/explore` | 🟡 | 고급 필터, **AI 자연어 검색창**, 스폰서 띠, 검색권 사용/구매 |
| `/matches` | ✅ | 번호 결과, 근거, 불확실성 |
| `/search/sessions/[id]` | 🆕 | 저장된 검색 결과 재열람(무료), 조건, 출처 배지 → 후보/비교/메시지 |
| `/compare`, `/lists` | ✅ | 비교표, 비공개 메모, 후보 그룹 |

### 4.3 캠페인·공고
| URL | 상태 | 꼭 들어갈 것 |
|---|---|---|
| `/campaigns`, `/new`, `/[id]`, `/[id]/edit` | ✅ | **위저드(진행 표시)**, 비공개 초안, 예산·형식·오디언스 |
| `/brand/products` | ✅ | 광고 상품 등록 |
| `/jobs` | ✅ | 공고 피드, 카테고리·단가·마감 필터, 스폰서 고지 |
| `/jobs/new` | ✅ | 초안 → **미리보기 → 유료 게이트(중복 결제 방지 안내)** → 게시 |
| `/jobs/[id]` | ✅ | 브랜드·결과물·예산·마감·자격, 지원 상태, 지원 폼(비용·환불 불가 조건 표시) |
| `/jobs/[id]/applicants` | 🟡 (jobs/[id] 안에 섹션으로 있음) | 지원자 큐, 정렬, 메모, shortlist/accept/reject |
| `/applications` | 🆕 | 크리에이터용 내 지원 목록·단계 |

### 4.4 워크스페이스
| URL | 상태 | 꼭 들어갈 것 |
|---|---|---|
| `/dashboard` | 🟡 (하나로 통합) | 스펙은 `/dashboard/brand`·`/dashboard/creator` 분리. 다음 할 일 중심 |
| `/messages` | 🆕 | 대화 목록·실시간·안읽음·차단·신고·연락처 교환 동의 |
| `/notifications`, `/reports` | ✅ | 알림함, 내 정정 요청 |
| `/billing` | 🆕 (결제 성공/실패만 있음) | 상품, 크레딧 잔액, TEST 주문 이력, 이용권 만료 |
| `/creator/sponsor` | 🆕 | HOT 패스 TEST 결제, 만료, 노출 정책 |
| `/creator/claim`, `/creators/me` | 🟡 (`/settings/youtube`) | OAuth 인증, 충돌·심사중, 연락처 공개 범위, 포트폴리오, 단가 |
| `/settings` | ✅ | 프로필·개인정보·삭제·알림 |
| `/tools`, `/tools/local` | ✅ | AI 스튜디오 / 캠페인 초안 |

### 4.5 관리자 (현재 `/admin` 한 페이지 + `/admin/intelligence`)
스펙: **사이드바 + 고밀도 테이블 + 상세 드로어** 구조, 모바일도 사용 가능.

| 스펙 화면 | 상태 | 내용 |
|---|---|---|
| Overview | 🟡 | 오늘/7일/30일 KPI (DB 실측만, 하드코딩 금지) |
| Users / Brands | 🆕 | 역할·정지·감사 |
| Creators / Channels | 🟡 | 인증/미인증, 중복 병합 미리보기, 소유 요청 |
| YouTube 수집 | 🟡 | 수집 규칙, 동기화 상태, 쿼터, 실패 재시도 |
| AI | 🟡 | 모델 상태, 큐, 태그 제안 승인 |
| Jobs | 🟡 | 공고·지원·스팸·만료 |
| Messages | 🟡 | **신고 기반으로만** 범위 제한 열람 |
| Billing / Sponsor | 🟡 | 가격 버전, TEST 주문, 크레딧 조정(사유 필수), 스폰서 슬롯 |
| Settings / Audit | 🆕 | 기능 플래그, 감사 로그(불변) |

---

## 5. 화면에 반영해야 하는 설계 규칙 (코드·DB에 이미 들어간 것)

### 5.1 상태 기계 → 상태 칩 디자인 필요
| 대상 | 상태 |
|---|---|
| 공고 | draft → awaiting_entitlement → published → paused / closed / expired / removed |
| 지원 | draft → awaiting_entitlement → submitted → shortlisted → accepted / rejected / withdrawn → in_progress → completed / disputed |
| 대화 | open → archived / blocked |
| 결제 | created → checkout_pending → confirming → approved / failed / cancelled / refunded |
| 채널 인증 | unclaimed → pending → verified / rejected / revoked |
| 수집 작업 | queued → leased → running → succeeded / failed / retry / dead_letter |

### 5.2 신뢰·정직성 규칙 (디자인으로 표현해야 함)
- **스폰서 = 별도 카드/캐러셀 + "스폰서" 라벨 항상 표시.** 검색 결과 상단 최대 2개. organic 순위에 섞지 않음.
- **자동 발견 채널 ≠ 가입 회원.** 인증 전엔 "자동 발견 채널" 표시.
- 공개 채널 데이터엔 **출처 + 수집 시각** 라벨. 데모/샘플 데이터는 눈에 띄게 라벨.
- 결제 화면엔 **TEST 표시**, 자동 갱신 아님을 명시.
- 추천은 "완벽 매칭" 같은 블랙박스 금지 → **점수 분해 + 근거 + 불확실성**.
- 최근 평균 조회수 필터는 **정책 승인 전 비활성** → disabled 상태 + 사유 툴팁 디자인 필요. 표본 0이면 "0"이 아니라 "—".
- 없는 데이터(성별 비율, ROI, 전환율) 만들어 넣지 않기.
- 연락처 공개 범위: `hidden`(기본) / `after_accept` / `verified_brands` / `public` — 설정 UI 필요.
- 딜 보드에서 실제 합의 없이 "계약 체결" 표기 금지.

### 5.3 권한
- 비회원은 연락처·채팅·유료 결과 잠금 → **잠금 상태 UI**.
- 반대 역할 접근 시 거부 화면 (예: 크리에이터가 `/jobs/new` → "브랜드 계정으로 공고를 작성할 수 있습니다").
- 관리자 위험 작업은 **사유 입력 + 확인 모달**.

---

## 6. 모든 화면에 그려야 할 상태 (체크리스트)

각 주요 화면마다 아래 variant 프레임:
- [ ] 기본 / 로딩(스켈레톤) / 빈 상태 / 오류(API 다운) / 성공
- [ ] 미로그인 / 권한 부족 / 미인증 채널
- [ ] 폼 검증 오류
- [ ] 결제 취소·실패·중복 승인
- [ ] YouTube API 쿼터 소진 / AI 서버 중단
- [ ] 평균 조회수 승인 대기
- [ ] 신고·정지 계정, 차단된 채팅 상대
- [ ] 페이지네이션, 날짜는 Asia/Seoul 기준
- [ ] 키보드 포커스 상태, WCAG AA 대비

---

## 7. 추천 Figma 파일 구조

```
📄 00 Cover & Changelog
📄 01 Foundations     — 컬러·타이포·간격·라운드·그림자·아이콘(Lucide)·로고 사용 규칙
📄 02 Components      — §3 목록, 각 variant(상태·크기·역할)
📄 03 Flows           — 아래 핵심 플로우 4개 (프로토타입 연결)
📄 04 Public          — 홈·가격·공고·채널
📄 05 Brand           — 탐색·검색·매칭·비교·캠페인·공고 작성·지원자 검토
📄 06 Creator         — 채널 인증·프로필·지원·스폰서
📄 07 Shared          — 메시지·알림·결제·설정
📄 08 Admin           — 사이드바 셸 + 모듈별
📄 09 States          — §6 상태 모음
```

### 핵심 플로우 (우선순위 순)
1. **브랜드 골드 패스**: 가입 → 캠페인 작성 → AI 검색(검색권 결제) → 결과 → 비교 → 후보 저장 → 메시지
2. **공고 패스**: 공고 초안 → 미리보기 → TEST 결제 → 게시 → 지원자 검토 → 수락 → 채팅 오픈
3. **크리에이터 패스**: 가입 → YouTube 채널 인증 → 프로필·연락처 범위 → 공고 지원(지원권) → 상태 확인
4. **스폰서 패스**: 스폰서 구매 → 검색 결과 상단 노출(라벨) → 만료

---

## 8. 추천 작업 순서

1. **Foundations 확정** (토큰 불일치 정리, 폰트 결정) — 코드 반영이 가장 쉬운 단계
2. **컴포넌트**: Button, Creator card, 상태 칩, 출처/TEST/스폰서 라벨, Field
3. **브랜드 골드 패스 화면** (데스크톱 → 모바일)
4. 🆕 화면 중 비즈니스 핵심: `/messages`, `/billing`, `/applications`, `/search/sessions/[id]`
5. 관리자 셸 (사이드바+테이블+드로어) 한 번 만들고 모듈 반복

---

## 부록: 참고 문서
- 화면 계약: `docs/youtube-harness/SCREENS_UX.md`
- 제품 규칙·가격·상태: `docs/youtube-harness/PRODUCT_SPEC.md`
- 관리자: `docs/youtube-harness/ADMIN.md`
- 지원·채팅: `docs/youtube-harness/CHAT_APPLICATIONS.md`
- 브랜드 시스템: `docs/DESIGN_SYSTEM.md`
- 현재 토큰/스타일: `src/app/globals.css`
