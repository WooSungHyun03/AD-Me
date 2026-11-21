# USER 증분 적용 — 공개 저장/동의 원장 (54 → 57)

기존 `dev-a-p0-next-20261121`의46→54 패킷 다음에 적용하는 증분이다. 이전 SQL·패킷을 수정하지 않았다. 대상 source SHA/SQL hash는 MANIFEST.json, 검증 근거는 `harness/evidence/DEV-A-P0-PUBLICATION-20261121/`에 있다. 외부 SQL 적용·콘솔 변경·배포·키 등록은 수행하지 않았다.

1. USER가 정확한 대상의 Supabase SQL Editor에서 `00_preflight.sql`을 실행한다. 이력54/기존 함수와 다르거나 일부만 적용돼 있으면 STOP이다. 이력을 수정해 통과시키지 말고 개발자가 실제 상태용 패킷을 만든다. 백업·복구 준비는 기존 릴리스 gate다.
2. 통과한 대상에 `01_apply_current_54.sql` 전체를 한 번 실행한다. 055+056+057과 이력은 한 트랜잭션이며 중간 오류는 전체 롤백한다. 기존 공개 설정·내용·private 연락처·동의 event의 원래 필드를 보존한다. 새 scope의 global 기본값은 기존 이벤트 의미이며 새로운 동의를 소급 생성하지 않는다.
3. `02_verify.sql`: 이력57, publication_boundary=false, 새 requests=0, consent schema RLS 누락0. 기존 정책 승인/TEST billing 값은 이 패킷이 변경하지 않는다. 대상의 실제 값이 무료 릴리스 정책과 맞는지는 USER/개발자가 검토한다.
4. USER가 MANIFEST의 소스 적용 시점을 조율하고 실제 URL·DEV-B review 후 `03_activate_after_source_review.sql`을 실행한다. 단방향 strict 활성화는 기존 direct REST/legacy brand RPC의 공개 갱신을 거부한다. 원래 유효한 비공개/삭제 경로는 남고 새 저장 RPC는 정책 버전/hash와 요청 키를 검증한다. 최초 source/time은 재실행으로 바뀌지 않는다. 구 브라우저 탭은 새 화면으로 다시 열어야 한다. 정책·공급자 승인을 수행하는 SQL은 아니다.

스테이징에서는 기존 공개 저장을 유지하며 그 동작에 새 동의를 만들어 넣지 않는다. 이 임시 호환 상태를 D073 동의 통합 완료 또는 공개 릴리스 완료로 승인하지 않는다. 원본055를 그대로 적용하면 strict가 기본이다. 원본과 패킷을 중복 실행하지 않는다. 이미57이라면 재적용하지 않는다.

새 소스는 프로필/브랜드 저장과 scope별 동의 event 및 idempotent receipt를 원자적으로 처리한다. 동일 요청 키의 payload 변경은 거부하고, 성공했던 저장의 재전송은 receipt만 반환하여 이후 철회를 되돌리지 않는다. 새 키의 서로 다른 사용자 동작은 서버 처리 순서로 적용한다. 클라이언트 클릭 시각 기준 전체 수정 충돌 해결/CAS를 구현했다고 주장하지 않는다. 직접 비공개 전환은 정책이 만료돼도 가능하며 본인 철회만 기록한다. 프로필 삭제는 Auth/Storage/협업 기록 전체 파기가 아니다.

requests에는 actor/key/scope/비공개 payload hash·결과 ID/시각을 저장한다. hash를 무조건 익명이라고 부르지 않는다. 원장·receipt의 최종 보존/예외/백업 재삭제는 D079와 U001 검토가 필요하다. Auth 파기 시 관련 행은 cascade 정리된다. 실제 계정 삭제 D014의 실행 어댑터/API는 아직 없다.

U001 최종 보존·근거·위탁/국외이전·권리 절차 확정, 실제 SMTP/공급자·실제 대상 URL·DEV-B 리뷰는 남는다. 가상 QA 승인을 운영에 복사하지 않는다. 새 환경변수·키·유료 설정은 없으며 USER에게 터미널·설치·코드 수정을 요구하지 않는다. 복구는 destructive down migration/원장 삭제가 아닌 개발자의 추가 forward fix와 USER 승인 릴리스로 처리한다.
