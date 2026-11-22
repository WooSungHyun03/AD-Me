# D044 — 추천 하드 조건·결측·점수 계약 (2026-11-20)

상태: 구현·단위/브라우저 검증 완료. DB 변경 없음(정책은 캠페인 brief JSON의 선택 필드 `policy`).

## 계약 (`src/lib/catalog.ts`, scorer `adme-1.1`)
1. **게이트 먼저, 점수는 나중.** `gate()`가 비공개·협업 불가/의사 미확인·플랫폼 불일치를 제외하고, 정책상 필수인 분야·예산을 검사한다. 제외(`excluded`)된 크리에이터는 점수를 계산하지 않는다(`score: null`, breakdown 없음).
2. **정책 입력 `Policy`** (기본값 `DEFAULT_POLICY` = 분야 선호, 예산 선호, 정보 없음 보류):
   - `category: hard|soft` — hard면 불일치 제외, soft면 25% 가중치로 점수 반영.
   - `budget: hard|soft` — hard면 최소 견적 > 예산 제외(경계 포함: 같으면 통과), soft면 15% 가중치로 반영.
   - `unknown: exclude|hold` — 필수 조건의 크리에이터 데이터가 없으면 제외 또는 보류(`hold`). 보류는 확정 후보 뒤에 정렬되고 사유를 표시한다.
3. **초기 가중치** `WEIGHTS` 분위기 28 · 분야 25 · 타깃 20 · 예산 15 · 형식 12 = 100.
4. **결측 재정규화**: 값이 없는 요인을 빼고 남은 가중치로 정규화. `coverage`(데이터 충실도) = 알려진 가중치 합(%). 결측 요인은 `missing`에 표시. 견적 미확인은 결측이지 0원 매칭이 아니다.
5. **0분모**: 0원 견적 = 예산 적합 1, 예산 0 = 결측, coverage 0 → 점수 0.
6. **정렬**: 확정 → 보류, 점수 내림차순, creatorId 오름차순(입력 순서 무관).

## UI
- 캠페인 폼: 분야 조건·예산 조건(선호/필수), 필수 조건 정보 없음 처리(보류/제외). `campaignSchema.policy` Zod.
- 캠페인 상세: 적용 정책 문구, 보류 후보 배지·사유, "미확보: 없음" 표시.

## 검증
- vitest 61/61 — D044 9건: 가중치 합 100, 게이트 선행(제외 시 점수 없음), 분야 soft/hard, 예산 경계(같음 통과·1원 초과 제외·soft는 통과), 결측+hard → hold/exclude, 보류 후순위, 0분모, 재정규화 coverage, 고정 데이터셋 상위 5 스냅샷(`tests/__snapshots__/matching.test.ts.snap`)·입력 역순 동일. 기존 테스트 2건은 "제외 시 점수 없음" 계약에 맞게 갱신.
- `tests/e2e/matching-policy.spec.ts` desktop·mobile PASS: 폼에서 필수/제외 저장 → 상세 정책 문구 → 표시된 모든 추천의 분야 100점(하드 게이트 확인, 결과 1건 이상 보장) → 편집 화면 값 유지.
- 회귀: lint·typecheck·build·secret_scan PASS. 첫 전체 E2E에서 로컬 Auth 로그인 rate limit(5분 30회) 초과로 3건 실패 → 로컬 스택 전용 `supabase/config.toml` `sign_in_sign_ups=500`(운영 설정 아님) 상향 후 **전체 E2E 20/20 PASS**, 직접 DB 테스트 security/claims/profile-fields/search/recruiting/lists PASS.

## 상대 담당 인터페이스
- D045(DEV-A): scorer 버전 `adme-1.1`, 결과 필드 `status/reasons/policy` 추가, 제외 항목 `score: null`. 피드백 데이터셋은 이 계약을 기준으로 고정.
- D041(DEV-A): 캠페인 brief JSON에 선택 필드 `policy` 추가(`valid_campaign_dto`는 추가 키 허용).
