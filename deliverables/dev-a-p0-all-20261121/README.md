# 남은 P0 사용자 적용 패킷 — 57 → 60

기존 publication54→57 패킷 다음에 적용하는 단일 증분이다. 기존 SQL/증빙/패킷은 불변이다. source SHA와3개 SQL hash는 MANIFEST.json, 기술 증거는 harness/evidence/DEV-A-P0-ALL-20261121에 있다. 외부 콘솔/키/배포·실제 외부 SMTP 발송은 실행하지 않았다.

1. USER가 대상 Supabase SQL Editor에서 `00_preflight.sql`을 실행한다. 정확한57 이력·기존 파일 접근 함수·custom DataAPI hook 충돌을 확인한다. STOP이면 이력을 지우거나 강제로 맞추지 말고 개발자가 실제 상태에 맞는 패킷을 준비한다. 기존 외부 hook 설정이 있으면 먼저 review한다.
2. 통과한 대상에 `01_apply_current_57.sql` 전체를 한 번 실행한다.058/059/060과 이력은 하나의 트랜잭션이며 중간 오류는 역할 설정까지 롤백한다. 기존 사용자 데이터·정책 승인을 변경하지 않는다. 요청이 없을 때 새 접근 제한은 기존 흐름을 차단하지 않는다.
3. `02_verify.sql`: 이력60, intake=false, 새 requests0, quarantine bucket public=false, DataAPI hook=adme_privacy.enforce_actor, arbitrary actor probe=false를 확인한다. 실제 대상 URL은 USER 배포 조율 후 개발자가 검증한다. 기존 TEST billing/정책/수집 승인 상태를 이 패킷이 대신 변경하지 않는다.

**온라인 접수는 기본 OFF, 영구 파기 엔진/실제 Auth 삭제는 미구현이다.** USER가 정책 미확정이라고 답했으므로 활성화·정책 승인 SQL을 넣지 않았다. 로컬 FICTIONAL 승인·intake 설정을 운영에 복사하지 않는다. `03_release-gates.json`은 승인 문서가 아닌 미확정 사실 목록이다. 다음 단계는 USER가 사실을 제공하면 개발자가 새로운 정책 고지/version/hash·실행 계약·검증/활성화 패킷을 준비하는 것이다. USER에게 코드 수정·터미널·설치를 요구하지 않는다.

새 코드의 receipt/actor/단계·재인증 시각·private 보관 bytes는 실제 개인정보 처리 흐름이다. 보존 기간/근거/예외·위탁·국외이전·권리 처리·shared 기록/backup replay를 확정해야 한다. 접수·공개 중단·JWT 제한·원래 파일 경로 제거·전체 영구 파기를 구분한다. 이미 내려받은 사본/CDN 캐시까지 즉시 없앴다고 하지 않는다. 화면 분실/receipt 복구·주기 worker·전체 파기 어댑터는 후속 계약 대상이다.

소프트웨어 고지는 public/legal/third-party-notices.txt와 `/licenses`로 실제 제공한다. Windows 및 격리 Linux production build/trace·HTTP 검증을 구분했다. Linux runtime notice gap4개, 전체 optional archive 고지71개와 로고/외부 콘텐츠 권리·최종 호스팅/Edge 산출물 검토가 남으므로 라이선스 전체 승인으로 보고하지 않는다. 기존 Edge lock9/9 증거는 코드 변경이 없어 재사용한다.

외부 SMTP의 이번 소스 가입/재발송/인증은 U007/U008 검증이 남는다. 로컬 Mailpit 성공을 외부 수신 성공으로 대신하지 않는다. D014/D079 전체 삭제 및 실제 공급자·배포 대상 회귀가 남아 D084 전체 출시 기준도 미완료다. rollback은 원장/데이터 삭제나 hook 임의 해제가 아니라 개발자의 forward fix 및 USER의 검토된 릴리스로 처리한다.
