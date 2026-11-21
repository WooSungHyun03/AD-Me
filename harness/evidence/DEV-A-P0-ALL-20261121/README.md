# 남은 P0 다섯 티켓 처리 범위

기존 codex/dev-a-p0-continue/aab0be9에서 D014/D007/D009/D073/D084를 모두 대조·작업했다. 정확한 티켓 SHA/최종 source는 commits.json, 명령/수량·actual/fixture 구분은 verification.json이다. 각 티켓의 VERIFY_ALL과 USER57→60 패킷에 이어진다. 전체 수용 전 DONE은0을 유지한다.

D014는 pure contract에서 실제 password/TOTP·DB request/receipt/lease·DataAPI/Storage stale-JWT 제한·Auth ban·검증 copy→원래 경로 제거·재시도·소유 collection lease 취소까지 확장했다. default intake OFF, 영구 파기/Auth 삭제/D079 shared 보존/backup replay·주기 worker/receipt 복구는 미구현이다. 앱이 waiting_retention/review를 실제로 표시하고 untracked 객체·무결성 오류를 완료로 처리하지 않음을 확인했다.

D007은 알려진 notice를 실제 제공하고 Linux build/HTTP/NFT17패키지(고지 gap4), Windows12(gap2)를 조사했다. 기존 optional71/자산권리/최종 호스팅·Edge gate는 유지했다. D009는 새 access gate가 포함된 local Mailpit 가입/증표 회귀를 재검증했지만 외부 SMTP 수신으로 보고하지 않았다. D073은 USER의 "아직 미확정—구현 계속"을 기록하고 새 처리 register만 갱신했으며 policy snapshot/hash/승인을 바꾸지 않았다.

실패/수정: Docker daemon이 중지돼 로컬 Docker Desktop을 background 시작했다.058 후속 수정이 섞인 것을 발견해 실제 적용 ledger/스냅샷과 일치하는 원본을 복구하고059에 분리했다.060은 소유 작업 취소다. 초기 unknown-object test가 존재하지 않는 legacy bucket 이름을 써 실제 private bucket의 untracked 경로로 수정했다. 첫 Linux archive는 Windows CRLF 변환으로 byte 검증에 실패해 archive LF 옵션/제공 파일 -text를 적용했고 다시 actual build/probe했다. 정확한 upstream trailing whitespace는 제공 notice 파일에만 -whitespace를 적용해 보존한다. assertion/테스트를 삭제·skip하거나 권한을 완화하지 않았다.

actual local Auth/PostgREST/Postgres/Storage·native TOTP·signed 테스트 URL·실파일 bytes를 가상 계정/정책과 함께 검사했다. checkpoint ACK 실패 주입은 실제 외부 공급자 성공이 아니다. source에 포함하지 않은 credentials/home 없이 격리 Linux build를 수행했다. 이미 다운로드/캐시된 사본·실제 CDN 즉시 회수·전역 Auth session row 삭제·전체 파기를 이 증거로 보장하지 않는다. external console/keys/deploy/메일·메시지/실제 결제 없음.
