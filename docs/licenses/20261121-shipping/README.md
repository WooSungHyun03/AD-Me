# 알려진 고지의 실제 배포 입력과 타깃 검사

기존 exact installed393·exact archive42의 고지를 합쳐 public/legal/third-party-notices.txt(1,602,660bytes)로 제공하고 `/licenses`와 footer에서 연결했다. 이전 notice 원본·71개 미해결 archive 목록은 변경하지 않았다. SPDX 표기만으로 빠진 고지 본문을 만들어 넣지 않는다. `.gitattributes -text`로 제공 파일 byte hash를 checkout/타깃과 무관하게 보존한다. lock/source 문서 대조는 CRLF만 정규화한다.

격리 Docker Linux Node22.23.5에서 실제 npm ci·Next production build·runtime trace·고지 HTTP SHA와 한국어 페이지를 검사했다. host 환경/키/계정/home/port를 마운트하지 않았다. 별도 Windows production trace/실제 browser HTTP 검증과 구분한다. 증거: [Linux](../../../harness/evidence/DEV-A-P0-ALL-20261121/runtime-notices-linux.json), [최종 Windows](../../../harness/evidence/DEV-A-P0-ALL-20261121/runtime-notices-win32-final.json).

Linux trace17개 패키지의 버전은 exact lock과 일치하지만 다음4개는 현재 inventory에서 고지 본문 미확인이다: @img/sharp-libvips-linux-x641.3.4, @img/sharp-libvips-linuxmusl-x641.3.4, @next/env16.4.6, client-only0.0.1. Windows trace는12개/누락2개다. 각 타깃 inventory의 `INVENTORY_VERIFIED_WITH_NOTICE_GAPS`를 전체 라이선스 승인 PASS로 바꾸지 않는다.

남음: 해당 실제 배포 대상/상위 exact source의 필요한 고지·조건 근거, 전체 optional71개 기록, 제공 로고·외부 콘텐츠 재배포 권리, 최종 호스팅/Edge 산출물 검토. 로컬 Linux Next runtime 추적은 실제 Vercel 배포 산출물/법률 승인과 동일하지 않다. 기존 Edge lock9/9 증거는 Edge 소스를 바꾸지 않아 재사용했다. D007 BLOCKED_EXTERNAL 유지.
