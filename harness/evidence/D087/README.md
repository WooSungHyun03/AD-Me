# D087 — 백업·복원·성능·용량 (2026-11-22)

상태: 격리 환경 복원 모의·부하·용량 검증 완료. **호스트 프로젝트의 실제 요금제·PITR 꺼짐 확인과 사용자 첫 백업 실행은 사용자 담당(U003)**. 실서비스 복원은 하지 않았다.

## 무료 플랜 백업 한계 (Supabase 문서, 2026-11-22 확인)
- Free: 자동 백업 없음, 다운로드 불가. PITR은 유료 add-on.
- Storage 파일은 어떤 요금제에서도 DB 백업에 포함되지 않는다.
- Auth 세션, Edge Function secret, Auth 설정, Vercel env는 백업 밖이다.
- 정책: 사용자가 CLI dump와 Storage 파일을 저장소 밖 개인 폴더에 직접 백업한다. RPO 24시간 이하(매일 또는 배포 전). 절차는 `docs/operations/BACKUP_RESTORE.md`.
- 비용: dump와 파일 다운로드만 사용하므로 유료 add-on이 생기지 않는다. PITR이 꺼져 있는지 콘솔 확인은 사용자 몫.

## 복원 모의 `harness/restore_drill.mjs` (로컬 격리 DB만, 호스트 URL 거부)
절차: 표식과 비공개 업로드 생성 → 백업(public, auth.users·identities, storage 메타데이터, Storage 파일) → 백업 후 쓰기 → 파일 삭제와 DB 초기화(`db reset`) → 복원(replica 모드 데이터, MIME 유지 재업로드, tombstone 재적용, 헬스 probe) → 검증.

검증 항목:
- 모든 public 테이블 행 수가 일치한다.
- 백업 전 표식은 있고 백업 후 쓰기는 없다(**RPO 실측**).
- 기존 계정으로 로그인된다.
- 소유자가 비공개 파일을 signed URL로 열 수 있고 바이트가 일치한다.
- 재적용 결과는 0(일관됨).

최근 결과(`restore-drill.json`, 전체 회귀 직후, 791행, 파일 3개):
- 백업 1.9초, dump 약 275KB.
- **RTO**: 스키마 재생성 약 29초(로컬 `db reset`) + 데이터·파일·재적용 0.3초 미만.
- 호스트에서는 새 프로젝트 생성과 `db push` 시간이 더해진다. 추정 RTO는 30분 이내이고 실측은 하지 않았다.
- **RPO**: 백업 이후 쓰기 1건이 의도대로 손실됐다. 운영 정책은 24시간 이하.

**모의 중 발견해 고친 실제 결함 2건**:
1. `pg_dump -n public`에 `-t`를 함께 쓰면 public이 **조용히 빠진다**. 백업이 비어도 성공처럼 보였다. `-t 'public.*'`로 바꾸고 "모든 public 테이블이 dump에 있음" 단언을 추가했다.
2. Storage 재업로드 때 MIME을 넘기지 않으면 private 버킷이 `InvalidMimeType`으로 거부한다. 원본 MIME을 보존하도록 고쳤고 절차 문서에도 넣었다.
- `tests/ci-db.sh` 마지막 단계에 복원 모의를 넣었다(CI migrations job).

## 부하·용량 `tests/load/load.mjs` (프로덕션 build + 로컬 Supabase, `load-report.json`)
예산: p95 페이지 1000ms 이하, 검색 RPC 300ms 이하, 오류 0. 전 항목 PASS.

| 시나리오 | 동시 | p50 | p95 | 오류 |
|---|---|---|---|---|
| GET / | 10 | 4ms | 8ms | 0 |
| GET /creators | 10 | 40ms | 82ms | 0 |
| GET /creators?q=뷰티 | 10 | 37ms | 67ms | 0 |
| GET /campaigns | 10 | 28ms | 72ms | 0 |
| GET /api/health | 20 | 17ms | 22ms | 0 |
| RPC search (name) | 20 | 5ms | 13ms | 0 |
| RPC search name @10,057행 | 20 | 4ms | 6ms | 0 |
| RPC search followers @10,057행 | 20 | 7ms | 8ms | 0 |
| RPC search q @10,057행 | 20 | 9ms | 16ms | 0 |
| GET /creators @10,057행 | 10 | 35ms | 50ms | 0 |

- 용량: 크리에이터 1행 약 2.26KB(인덱스 포함). 500MB 무료 DB의 절반을 프로필에 쓰면 **약 11.6만 명**까지 수용한다고 추정.
- 텍스트 검색은 trigram 인덱스(`creators_pub_search`)를 사용한다.
- 합성 1만 행은 데모 라벨 복제본이며 측정 후 삭제했다.
- 수집 용량: YouTube는 1 unit 엔드포인트만 쓴다(채널 50개/호출). 기본 일일 쿼터 10,000 unit이면 채널 메타데이터 갱신은 하루 수만 채널 규모로 쿼터 여유가 크다. 수집은 정책 승인 전이라 미가동.
- 한계: 로컬에는 네트워크 지연이 없다. 운영 수치는 D088에서 공개 URL에 가벼운 부하로 재측정한다(대량 부하는 공개 URL에 걸지 않는다).

## 사용자 작업 (U003)
1. Supabase Billing에서 플랜과 PITR 꺼짐을 확인한다.
2. 배포 전 첫 백업(`BACKUP_RESTORE.md` 1–3단계)을 개인 저장소에 보관한다.
3. 백업 파일은 30일 뒤 삭제한다.
