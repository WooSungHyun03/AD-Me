# D084 — DEV-B CI 실패 원인 분석 (2026-11-26, DEV-A)

격리 스택 `ci-e2e`(project_id ci-e2e, 포트 573xx, 가상 데이터)에서 재현했다. DEV-B 코드는 수정하지 않았다. 운영 DB·결제는 건드리지 않았다.

## 1. CI `55a6e2f` (e2e 14건 실패, DB suite 14개 실패)

| 묶음 | suite | 첫 실패 | 원인 |
|---|---|---|---|
| A | claims, recruiting, proposals, safety | `42501 versioned publication transaction required` | D073 `publication_guard`(202611210055)가 service_role REST로 `published=true`를 쓰는 fixture를 막는다. `postgres` 세션 SQL fixture나 정식 공개 RPC만 통과한다. |
| B | reports, retention, ops, feedback, email-outbox, usage-ledger | `forbidden` (P0001/42501) | 관리자 RPC가 `is_admin()` = provisioned + `admin_mfa_recent()`(aal2)를 요구하는데 suite가 비밀번호 로그인만 한다. |
| B 파생 | ops-metrics:208, privacy:156, promotions:114, test-cancel:287 | `null`/0건 | B의 관리자 호출이 거부된 뒤 이어지는 값이 비어 있다. |

조치: DEV-B가 `c631b14`, `0af7194`(D085)에서 suite를 현재 공개·관리자 계약으로 옮겼다. CI `252dfdd`에서 **DB suite 실패 0**이다. e2e claims/similar/selection-review/match-feedback/reports/safety는 `da35226`, `b481a19`, `023fbe3`, `baa9e05`, `2665cb4`, `42db7fd`, `8315cad` 이후 사라졌다.

## 2. CI `252dfdd`의 남은 실패 — retention (desktop·mobile 2건)

- `tests/e2e/retention.spec.ts:26`은 `/privacy`에서 `getByTestId('retention-table')`을 기대한다.
- 표는 `2486932`에서 추가됐다. `50f6aa7` 병합(DEV-A·DEV-B privacy 경계 조정)에서 페이지가 `policyDocument` 기반으로 바뀌며 빠졌다. 두 부모 모두 이미 표가 없다. `551e03f`→`14980c8` 경로에서 먼저 사라졌다.
- `5f8a66f`(D079)에서 DEV-B가 "미승인 보존 기간을 사실처럼 표시하지 않음, U001/D073 승인 대기"로 기록했다. 즉 화면은 의도대로이고 **spec 계약만 옛 상태**다.
- 결정은 DEV-B 몫이다. 둘 중 하나: (a) 승인 전에는 spec이 `policyDocument.content.retention`의 확정 전 문구와 가로 스크롤 없음만 확인한다. (b) U001 승인 뒤 `RETENTION_RULES` 표를 복원한다. DEV-A는 수정하지 않았다.

## 3. 격리 재현 메모

- 전체 순서 실행(`252dfdd`, 새 DB): 10 failed / 4 skipped.
  - retention ×2: CI와 같다.
  - notifications:29·133, pipeline:33 ×2 (desktop·mobile): 로그인 후 `/login`에 머무른다. CI에는 없다. 로컬 스택의 인증 요청 한도나 세션 문제로 보이며 원인은 확정하지 못했다.
  - service:93 ×2: 로컬에 Toss TEST 시크릿이 없어 "승인 서버 응답을 확인하지 못했습니다"가 나온다. 환경 차이다.
- 단독 실행: similar, match-feedback, reports, safety 통과.
  - selection-review는 단독 실행 시 `creators.owner_id = accounts.creator.id` 행이 없어 FK 오류가 난다. 앞선 spec이 만든 행에 의존하는 **순서 의존성**이다. 전체 실행과 CI에서는 통과한다. DEV-B에 fixture 자립화를 권고한다.

## 명령

```
supabase db reset --local (ci-e2e) → prepare-ci-consent → provision → provision-admin → setup-isolated-youtube.sql
CI=true BASE_URL=http://localhost:3300 npx playwright test            # 전체
$S/e2e1.sh tests/e2e/<spec> desktop                                   # 단독
gh run view 45633142856 / 45695968387 --log                           # CI 대조
```
