# 정확한 배포물의 보완 설명·구성요소 자료

기존 package-lock/고지/과거 검증은 보존한다. scripts/audit-license-supplement.py가 이전 미확인71개를 exact npm SRI와 package.json name/version으로 확인했다. 독립 URL 없는 inBundle 두 항목은 lock에 고정된 부모 @tailwindcss/oxide-wasm32-wasi@4.3.5 archive 안의 실제 package.json을 검사했다. @types/json5는 package/ 대신 json5/ root를 허용하되 identity/version이 일치해야 한다.

결과 summary.json: metadata71/71, archive review failure3→0, exact README Licensing disclosure10개 + native versions maps, full permission text 새 확보0개, 선언만 있는61개. README/metadata/SPDX를 full copyright/permission text나 재배포·source/relink 의무 충족으로 보고하지 않는다. 모든 notice_complete=false/rights_approval=false다. 전체71개에 대한 법적 승인으로 읽으면 안 된다.

public/legal/third-party-supplement-20261122.txt(58,218bytes)를 /licenses에서 제공한다. manifest는 기존 lock LF hash·공개 bytes·inventory LF hash를 고정한다. inventory의 각 archive SHA/SRI·carrier·원문 파일별 raw SHA를 대조할 수 있다. 원본README/versions bytes를 포함하며 저작권자/허가문을 임의 생성하지 않았다. 라이선스 추출 작업은 코드를 설치/실행하지 않았다. 별도 실제 Linux build는 앱의 고정 의존성 설치/빌드를 수행하고 그 범위를 증거에 명시한다.

Linux 현재 runtime의 @img/sharp-libvips-linux-x64/linuxmusl-x64@1.3.4 두 archive에는 각각 LGPL-3.0-or-later 선언·README Licensing 요약·28개 구성요소의 versions.json이 있지만 완전한 permission/source 충족 증거가 없다. source/해당 빌드·의무 검토는 계속 필요하다. @next/env@16.4.6과 client-only@0.0.1은 standalone 배포물에 authentic permission/copyright 원문이 없어 미확인 유지다. 비슷한 프로젝트의 license를 적용 근거 없이 대신 붙이지 않는다.

수집기 보안: HTTPS registry.npmjs.org/redirect 거부, strong SRI 선검사, compressed64MiB·expanded256MiB·개별text4MiB·entries100000 상한, path traversal/duplicate/symlink·특수파일 거부, 부모/자식 identity/version 검사, 기존 산출물 overwrite 거부. Python 출력 JSON은 LF 고정, archive 원문은 byte hash 보존. Windows 첫 inventory CRLF/LF hash 혼동은 canonical LF 출력과 회귀 검사로 고쳤고 첫 시도는 ignored output에 보존했다.

실제 고정 배포물은 inventory.json의 registry 원본 URL/SRI가 일차 증거다. 프로젝트 포장 방식은 [sharp-libvips 공식 저장소](https://github.com/lovell/sharp-libvips)에서 확인할 수 있다. README의 외부 license 링크는 배포물에 들어 있던 설명이며 그 링크의 최신 문서를 이 버전의 완전한 허가 원문으로 자동 채택하지 않는다. 최종 호스팅 산출물/Edge·로고·외부 자료 권리와 공급자/정책 승인 gate는 그대로다.
