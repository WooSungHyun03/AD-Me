# D011 — 브랜드·크리에이터 온보딩 (2026-11-26, DEV-B)

환경: 격리 로컬 Supabase만.

## 현황
- 구현:
  - `src/lib/onboarding.ts`: DB 행으로만 진행 상태를 계산하며, 권한과 무관하다.
  - 대시보드 "시작하기 n/m" 체크리스트: merge 회귀를 D085 1차에서 복원했다.
- 역할 결정: 가입 트리거 `handle_new_user`는 creator가 아니면 brand로 두고, admin은 자가 지정할 수 없다. `profiles.role`은 클라이언트가 바꿀 수 없다.
- 이전에는 단위 테스트만 있었고, 수용 기준의 "가입 중단·재로그인·직접 역할 변조" E2E가 없었다.

## 변경
- `tests/e2e/onboarding.spec.ts`(신규):
  - 브랜드:
    - 가입 직후 중단 → 첫 로그인에 "시작하기 1/2"와 이어서 하기 링크가 보인다.
    - 새 세션으로 재로그인해도 같은 진행 상태다.
    - 첫 브리프 작성 후 체크리스트가 사라진다.
  - 크리에이터:
    - 역할별 3단계(이름·프로필 작성·공개)가 보이고 캠페인 단계는 없다.
    - `profiles.role`을 admin으로 바꾸는 REST 요청이 거부된다.
    - 가입 메타데이터 role=admin은 brand로 강등된다.
    - `/admin`은 "관리자 권한이 필요합니다."로 막힌다.

## 결과
- `npx playwright test tests/e2e/onboarding.spec.ts`: desktop·mobile 4/4.
- `npx vitest run tests/onboarding.test.ts` PASS.

## 남은 것
- 운영 적용 후 실계정 확인(U004).
