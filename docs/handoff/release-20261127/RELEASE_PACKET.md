# 사용자 외부 적용용 릴리스 패킷 — 2026-11-27 (D085)

`docs/handoff/RELEASE_PACKET_TEMPLATE.md` 양식을 채운 것이다. **DEV-B는 이 패킷의 어떤 단계도 운영 환경에 실행하지 않았다.**
- 운영 DB 적용(U004), 환경값 등록(U006), 배포·지문 등록(U005), 출시 결정(U020)은 사용자가 승인하고 실행한다.
- 사용자에게 SQL이나 코드 수정을 요구하지 않는다.
- 아래 SQL은 이 폴더의 파일을 SQL 편집기에 붙여 넣어 실행하는 읽기 전용 조회다.

## 1. 개요

| 항목 | 내용 |
|---|---|
| Release ID | `release-20261127` |
| 코드 기준 | main에서 이 패킷을 담은 커밋. 마이그레이션 141개는 `20261127110000`까지이며 이후 앱 전용 커밋도 같은 지문을 쓴다. |
| 작성·검토 | DEV-B(김태권) 작성. 교차 검토 DEV-A. 기준일 2026-11-27 |
| 운영 대상 | Vercel `ad-me` 프로젝트 Production(main), Supabase `ivtdfioypmzknlhinstg`, 공개 origin `https://be-celeb.org` |
| 현재 → 목표 | 운영 앱 `14980c8` → main. 운영 DB는 `20261123100029`까지 기록됨([D088 대응표](../../../harness/evidence/D088/README.md)) → `20261127110000`까지 37개 추가 |
| 하위 호환 | 37개 모두 expand/switch, contract 없음. 롤백은 forward fix. 기존 앱은 expand/switch 객체 위에서 계속 동작한다(예외는 §5 주의 1). |
| 목적 | 운영 앱을 main으로 맞춘다. `/terms` 약관 페이지(D073), D024·D058 등 11-23 이후 DEV-A·DEV-B 변경을 반영한다. |
| 의도적으로 끄는 기능 | TEST 결제(운영은 무료 베타; `ADME_FEATURE_TEST_BILLING=off`), 수집(U001 전 `ADME_FEATURE_INGESTION=off`), LLM(`off`), 앱 알림 메일(Resend 키 등록 전 자동 비활성) |
| 호스팅 플랜 | 무료 플랜 유지. 유료 전환·추가 리소스 없음. PITR 없음 → 수동 백업, RPO ≤ 24h(D087) |

## 2. 사전 증거

| 항목 | 결과 · 위치 |
|---|---|
| 빈 DB 전체 검증(`tests/ci-db.sh`, CI `migrations` 잡과 동일) | `4aff8b0` 기준. 마이그레이션 141 PASS, E2E 136/142(실패 retention 2건, 건너뜀 4), DB 권한 스위트 29/29, 복구 드릴 PASS(데이터 RTO 0.92초) — [D085 4차](../../../harness/evidence/D085/20261127/README.md) |
| 원격 CI | DEV-A 기록 run 45853997118 2차 시도 136/2/4와 같음. `checks` 잡 통과 |
| 이후 커밋 `8ddcb58`·`5a6397a`·이 패킷 | DB 변경 없음. 단위 테스트 전체(101개 파일), typecheck, eslint, `npm run build` 통과 |
| 권한(RLS/RPC) | DB 스위트 29개. 익명·브랜드·크리에이터·관리자·제3자 거부를 포함한다. |
| 정적 마이그레이션 검사 | `harness/migration_check.py` 141 PASS: 이름·순서, RLS, definer search_path, phase, 매니페스트 |
| 시연·실데이터 분리 | 운영은 `free_beta`. 데모 픽스처는 격리 정책(`ISOLATED QA ONLY`)으로 표시하고 공개 목록에 올리지 않는다(D024). |
| 백업·복구 | 격리 복구 드릴로 삭제 요청 재적용을 확인했다(D079/D087). 운영 백업 복원·업그레이드 리허설은 §4 1단계의 선행 조건이다. |
| 알려진 실패 | ① retention E2E 2건: U001 승인 후 보존 기간 표를 복원하면 해소된다(사용자 결정 2026-11-26).<br>② CI에서 `service.spec.ts:25` "더 불러오기"가 간헐적으로 실패한다(DEV-A 조사 중).<br>③ 운영 `/terms`가 307→`/about`으로 넘어간다. 운영 앱이 main보다 뒤처져서이며, 이 패킷 적용으로 해소된다. |

## 3. 적용 대상 마이그레이션 (37개)

- 목록·phase·담당·내용·롤백은 [RELEASE_MANIFEST.md](../RELEASE_MANIFEST.md)의 #1–#37이 정본이다.
- 파일별 SHA-256(CRLF→LF 정규화, 지문과 같은 방식)은 [checksums.txt](checksums.txt)에 있다. 적용 전에 운영자 체크아웃의 파일과 대조한다.
- STOP 가드가 있는 마이그레이션은 운영 함수 본문이 main과 다르면 스스로 중단한다:
  - `20261123110001`, `20261124022829`, `20261124080724`
  - `20261125120000`, `20261125220000`, `20261125240000`
  - `20261126100000`, `20261126110000`, `20261127110000`
  - **중단은 재시도 대상이 아니라 "멈추고 DEV에 알릴 것"이다.**
- 확장 의존: `pg_cron`(`20261124020115`, `20261125150000`, `20261125170000`), `pgcrypto`의 `extensions.digest`(`20261126130000`, `20261127100000`), Storage 버킷(`20261123121526`).

## 4. 적용 순서 — 매 단계 성공 후 다음 단계

| 순서 | USER 티켓 | 정확한 대상 | 사전 상태 | 기대 결과·검증 | 실패 시 중단·복구 |
|---|---|---|---|---|---|
| 1 | U003/U004 | 운영 DB 백업 다운로드(대시보드 백업 또는 운영자 `pg_dump`), 시각·크기 기록 | 앱 `14980c8`, DB `20261123100029` | 백업 파일이 있고 크기가 0이 아님. 가능하면 격리 프로젝트 복원 + 37개 업그레이드 리허설 | 백업이 없으면 **진행하지 않음** |
| 2 | U004 | 사전 점검 SQL(§6-A) | — | `pg_cron`·`pgcrypto` 존재. `verify.sql` 1번 쿼리가 **37행**(전부 미적용)을 반환. Auth → MFA → TOTP 등록·검증 켜짐(관리자 RPC는 aal2 필요) | 37행이 아니면 운영 기록이 대응표와 다르다는 뜻이므로 중단하고 DEV에 공유 |
| 3 | U004 | 마이그레이션 37개를 버전 순서대로. 그룹은 11-23 / 11-24 / 11-25 / 11-26~27 | checksums.txt 일치 | 각 파일 오류 없음. 마지막에 [verify.sql](verify.sql) 4개 쿼리 **모두 0행** | 실패한 파일에서 멈춘다. 이미 적용된 expand/switch는 기존 앱과 호환되므로 되돌리지 않고 DEV forward fix를 기다린다. 데이터 손상이 의심되면 1단계 백업으로 복원 |
| 4 | U004 | Edge Function `payment-confirm` 재배포(main의 `supabase/functions/payment-confirm`) | 운영은 `14980c8` 버전 | 운영 secret `ADME_SERVICE_MODE=free_beta`, `ADME_FEATURE_TEST_BILLING`은 미설정 또는 `off` → 결제 요청이 404 "TEST 결제를 제공하지 않습니다" | 이전 버전으로 재배포. 결제는 원래 꺼져 있어 사용자 영향 없음 |
| 5 | U006 | Vercel Production 서버 환경값(§6-B). 값은 문서에 적지 않는다. | — | 이름과 범위만 대조 | 잘못 넣으면 앱이 해당 기능을 끈다(fail closed) |
| 6 | U005 | `ADME_PRODUCTION_SCHEMA_SHA256` 등록 → 같은 커밋 재배포 | 지문이 없거나 달라 운영 빌드가 막힌 상태 | 배포 READY, 커밋 = 패킷 커밋. 지문은 3단계 검증을 통과한 체크아웃에서 `node scripts/production-schema.mjs --fingerprint`로 직접 산출(참고값 §6-C) | 이전 READY 배포로 즉시 롤백(DB는 expand/switch라 이전 앱과 호환) |
| 7 | U019/D088 | 익명 스모크 `node scripts/release-smoke.mjs https://be-celeb.org --commit <sha>` + 역할별 실계정 확인 | 11-27 운영 13/14 | 스모크 **14/14**(`/terms` 200). 브랜드·크리에이터 핵심 흐름, 관리자 OTP, 반대 역할 거부 | 실패 시 NO-GO. 6단계 롤백 |
| 8 | U020 | 공개 판단·관측 | — | GO/NO-GO 기록, 알림 드릴 `node scripts/alert-drill.mjs`(U018 후) | 지원·사고 대응 절차대로 처리 |

## 5. 주의

1. **3단계부터 6단계 사이에는 기존 앱의 관리자 운영 검색 `reports` 범위가 503을 돌려준다.**
   - 원인은 `20261127110000`(D058)이 결과에 접수번호·유형 필드를 추가하기 때문이다. 기존 앱의 엄격한 DTO가 이 필드를 거부한다.
   - 다른 검색 범위와 공개 화면에는 영향이 없다. 새 앱이 배포되면 해소된다.
   - 운영 빌드는 지문이 맞아야 시작되므로 앱을 DB보다 먼저 배포할 수 없다. 3단계에서 6단계까지 바로 이어서 진행한다.
2. 로컬에서 산출한 지문은 승인이 아니다. 3단계 검증 결과를 확인한 뒤에만 등록한다.
3. `payment-confirm`을 재배포하기 전에 3단계가 끝나 있어야 한다. 새 함수는 `test_billing_available` RPC를 확인한다. 이 RPC가 없어도 404로 닫히므로 위험하지는 않다.
4. 운영 DB에 새 계정·테스트 데이터를 만들지 않는다. 7단계의 역할 확인은 U019 실계정으로만 한다.

## 6. 부록

### A. 사전 점검 SQL (읽기 전용)
```sql
select extname, extnamespace::regnamespace as schema from pg_extension where extname in ('pg_cron', 'pgcrypto');
select max(version) as last_version, count(*) as rows from supabase_migrations.schema_migrations;
-- 이어서 verify.sql의 1번 쿼리를 실행한다: 적용 전에는 37행이어야 한다.
```

### B. 환경값 이름 (값 제외)
| 위치 | 이름 | 운영 값의 방향 |
|---|---|---|
| Vercel Production | `ADME_SERVICE_MODE` | `free_beta`. 과거 이름 `SERVICE_MODE`가 남아 있으면 같은 값이거나 삭제(충돌 시 fail closed) |
| Vercel Production | `ADME_FEATURE_TEST_BILLING`, `ADME_FEATURE_INGESTION`, `ADME_FEATURE_LLM` | `off` 또는 미설정 |
| Vercel Production | `ADME_FEATURE_MAIL` | 현재 운영값 유지(가입·재발송 진입점) |
| Vercel Production | `ADME_PRODUCTION_SCHEMA_SHA256` | 6단계에서 등록 |
| Vercel Production(선택) | `ALERT_WEBHOOK_URL` | U018 후 등록. 드릴로 수신 확인 |
| Vercel Production(선택) | `RESEND_API_KEY`, `ADME_MAIL_FROM` | U007/U006 후 등록. 없으면 앱 알림 메일은 발송 0 |
| Supabase Edge secrets | `ADME_SERVICE_MODE`, `ADME_FEATURE_TEST_BILLING` | `free_beta`, `off`(또는 미설정). `TOSS_SECRET_KEY`는 격리 TEST 프로젝트에만 둔다 |

### C. 참고 지문
- 지문: `567c210219def75a4fe9ee4cc374d0a65f42bdbc6ff73004b2ffce479b645dc2`
  - 마이그레이션 141개(`20261127110000`까지) 기준이며, 2026-11-27 Windows 체크아웃에서 산출했다.
  - 6단계에서 직접 산출한 값이 이와 다르면 등록하지 말고 DEV에 알린다.

### D. 검증 SQL 생성·자체 검증
- 생성: `node scripts/release-verify-sql.mjs 20261123100029 > docs/handoff/release-20261127/verify.sql`
  - 37개 마이그레이션, 객체 검사 145개(함수 100, 테이블 12, 컬럼 10, 트리거 8, 정책 8, 인덱스 7).
  - 그 밖에 definer search_path 검사와 RLS 미적용 테이블 검사를 포함한다.
- 로컬 전체 적용 DB에서 읽기 전용 트랜잭션으로 실행: 4개 쿼리 모두 0행.
- 음성 검사(롤백 트랜잭션):
  - 함수 1개 삭제, 원장 1행 삭제, `reports` RLS 해제를 넣었다.
  - 각각 해당 쿼리가 잡아냈다: 누락 버전 1행, 누락 함수 2행(그 함수를 만드는 두 마이그레이션), RLS 미적용 1행.
  - 롤백 후 원상태를 확인했다.
- `tests/release-verify-sql.test.ts`: 모든 대기 버전 포함, SELECT만 포함, 잘못된 인자 거부. 3/3 PASS.
