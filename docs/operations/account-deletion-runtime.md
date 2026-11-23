# D014 온라인 접수·격리 구현 범위

현재 구현은 실제 재인증→DB 접수→데이터 접근 제한→Auth 제한→검증된 파일 격리→보존 검토 대기다. **영구 파기·Auth 삭제·D079 보존/백업 복구 처리는 구현하지 않았다.** 기존 순수 `account-deletion.ts`의 전체 파기 인터페이스와 이번 `deletion-runtime.ts` 접수·격리 런타임을 구분한다. 접수 intake는 기본 OFF이며 USER의 "아직 미확정 — 구현 계속" 답변을 승인으로 바꾸지 않는다.

- `/api/account/deletion`: 현재 사용자의 비밀번호를 격리된 Auth 세션으로 확인한다. 등록된 MFA가 있으면 TOTP를 추가 검증한다. 클라이언트 UID/재인증 시각을 받지 않는다. receipt256비트·요청 UUID를 검증하고 시도 한도를 먼저 예약한다. 같은 접수의 ACK 유실은 상태 receipt로 복구한다.
- DataAPI `db_pre_request`는 호출자별 shared advisory lock과 active 상태를 검사한다. 접수는 같은 actor의 exclusive lock을 잡아 먼저 시작된 DataAPI 작업 종료를 기다린다. public 테이블 restrictive RLS·Storage 정책/쓰기 trigger는 별도다. 현재 노출 RPC와 Storage의 오래된 JWT 거부를 실제 로컬 검사했다. 새 private/Realtime 테이블을 추가하는 steward는 동일 제한 정책을 유지해야 한다.
- 접수 시 creator/brand/캠페인 공개와 channel consent를 중단하고 이미 queued/running인 사용자 소유 수집 lease를 취소한다. 승인된 전역 수집과 영구 삭제 tombstone/보존 계약은 별도다. 전체 재수집 차단 완료로 보고하지 않는다.
- `/process`는 receipt가 일치하는 이미 접수된 요청만 처리한다. service-only SQL claim/lease/checkpoint, 최대3회 실패·backoff와 호출당 최대5파일/각5MiB 경계를 둔다. Auth ban을 검증해 `authRestricted`를 기록한다. 이 값은 Auth session row가 모두 삭제됐다는 뜻이 아니다.
- 원본 PNG의 저장 hash/bytes와 같은 보관 복사본을 재검증한 후에만 원래 경로를 제거한다. 새 `adme-privacy-quarantine` 버킷은 다른 허용 정책이 있어도 anon/authenticated 접근을 restrictive policy로 거부한다. 실패/응답 유실 후 copy/remove 단계를 멱등 재개한다. 미확인 원본·보관 무결성 실패·알 수 없는 Storage 항목은 완료 처리하지 않는다.
- UI는 최초 한 batch를 처리하고 남은 batch는 접수 receipt로 계속 처리한다. 이 런타임은 상시 daemon/배포된 cron이 아니다. 화면을 잃어도 DB 접수·lease는 남지만, receipt 분실 시 본인 확인을 포함한 운영자 복구 절차와 주기 worker 연결은 후속 작업이다. receipt 원문은 브라우저 메모리에만 남고 주소·DB에는 넣지 않는다.

JWT는 Auth 세션을 종료해도 만료 전까지 유효할 수 있다([Supabase 사용자 관리](https://supabase.com/docs/guides/auth/managing-user-data)). DataAPI hook만으로 Storage/Realtime을 보호하지 못하므로 제품별 RLS를 별도 적용한다([공식 API 보안 문서](https://supabase.com/docs/guides/api/securing-your-api)). 앱은 현재 signed URL을 배포하지 않고 권한을 재확인하는 no-store 이미지 프록시를 사용한다. 로컬 검증은 별도 발급한 테스트 signed URL의 원래 경로가 격리 후 거부됨을 확인했다. 이미 다운로드/캐시된 사본·호스팅 CDN의 즉시 회수까지 증명한 것은 아니다.

USER 적용은 새57→60 패킷의 preflight/apply/verify만 제공한다. 기존 custom DataAPI hook은 자동 대체하지 않는다. 온라인 intake 활성화 SQL·정책 승인 SQL은 포함하지 않는다. U001의 항목별 근거/기간/예외·위탁/국외이전·권리 절차와 DEV-B D079의 shared 기록·파일·backup replay 계약을 받은 뒤 개발자가 다음 정책 snapshot/hash 및 전체 실행 어댑터/주기 처리·검증을 준비한다. USER에게 소스 편집·터미널·설치를 맡기지 않는다.
