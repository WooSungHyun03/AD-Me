# D003·D004 사용자 적용·인계

main `d79235d` 이후 설정/API 호환성 변경입니다. SQL·DB 자료 변경이 없으며 기존 적용 패킷은 유지합니다. 이 문서만으로 운영 배포나 환경 적용이 완료됐다는 뜻이 아닙니다.

| 항목 | 적용 기준 |
|---|---|
| 무료 베타 | 기존 `ADME_SERVICE_MODE=free_beta` 유지. 새 키가 필요하지 않습니다. |
| 이전 `SERVICE_MODE` | 웹 서버 호환 alias입니다. 새로 등록할 필요가 없습니다. 두 모드가 충돌하거나 하나가 잘못되면 무료 안전 모드를 선택하고 관리자 진단에는 설정명만 표시합니다. |
| 격리 TEST | 명시적 test_demo와 TEST billing flag 및 기존 TEST API 개별 연동 키가 모두 필요합니다. alias가 남아 있다면 같은 모드여야 합니다. Edge Function은 기존 `ADME_SERVICE_MODE`/feature flag 계약을 계속 사용합니다. |
| 선택 기능 | 꺼 둔 TEST 기능의 키를 누락으로 안내하지 않습니다. 입력된 잘못된 키는 계속 진단합니다. 실제 공급자 승인/결제 검증은 별도입니다. |
| API | 일반 JSON과 legacy API body는1MiB, 기존 파일 업로드는5MiB+64KiB envelope, 삭제 원장 복원은4MiB입니다. CSV100KB의 JSON escape도 기본 한도에 포함됩니다. 초과 시413/code/requestId, 오류 응답은 원문을 노출하지 않습니다. |

USER는 조율된 배포 시 기존 콘솔 설정에서 이름과 모드만 대조하고, 배포 뒤 허용된 QA 계정으로 로그인·일반 요청·파일 전송·413·읽기 전용 health를 확인합니다. 소스 수정·터미널·패키지 설치는 필요 없습니다. 비밀값을 채팅이나 증거에 복사하지 않습니다. 설정 진단 CLI와 관리자 health는 같은 계산 결과를 사용하며 공개 health 응답에는 설정 상세가 없습니다.

main/A Git 자동배포 hold는 유지합니다. 실제 배포·키 등록·환경 변경은 USER가 수행하고, DB41/저장소105의 기존 호환성·복원·권한 출시 게이트는 별도 D085/D087 작업입니다. 이상이 생기면 USER가 이전 승인 배포로 되돌리고, 개발자는 source forward fix를 준비합니다. 검증된 티켓별 변경·명령·범위는 `harness/evidence/D003/CONFIG_20261123.md`, `harness/evidence/D004/API_20261123.md`와 최종 batch receipt에 있습니다. 운영 수용 전 VERIFIED/DONE으로 승격하지 않습니다.
