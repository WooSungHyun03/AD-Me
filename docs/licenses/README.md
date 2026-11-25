# 배포 의존성·자산 출처 검토

## 패키지

[dependencies.csv](dependencies.csv)는 잠금 파일의 직접·간접·플랫폼별 항목 506개를 포함한다. 같은 패키지의 다른 버전과 설치 경로를 별도로 기록한다.

- `python -X utf8 scripts/inventory-licenses.py`로 잠금 파일과 정확한 설치 버전을 대조했다. `EXACT_INSTALLED_NOTICES` 393개와 패키지 내부 고지 파일 533개의 원문·SHA-256을 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 보존했다. [기계 판독 요약](inventory-summary.json)
- `NOTICE_UNVERIFIED`, `TARGET_ARTIFACT_UNVERIFIED` 113개는 출시 전 확인 대상이다. 현재 Windows 설치에 없는 Linux·다른 플랫폼 바이너리의 권리를 확인했다고 표시하지 않았다. 다른 버전의 라이선스를 누락 항목에 대입하지 않았다.
- npm 모듈을 저장소에 직접 반입하거나 수정한 기록은 없다. 아카이브에서 찾은 파일명과 별도로, 최종 배포 번들에 필요한 라이선스와 고지 본문이 포함되는지 확인해야 한다.
- MIT·ISC·BSD 계열 항목은 재배포 시 원문과 저작권 고지를 유지한다. Apache-2.0 항목은 해당 LICENSE와 제공된 NOTICE 및 수정 고지를 확인한다. MPL 항목과 LGPL 표기가 있는 libvips 계열은 실제 배포물에 포함되는 형태와 별도 의무를 확인한 뒤 반출한다.
- Supabase Edge Function의 별도 Deno import `npm:@supabase/supabase-js@2`는 이 npm 잠금 파일 범위 밖이다. Edge 배포에 들어가는 정확한 버전과 번들 고지는 별도로 확인한다.

## 자산 및 데이터

| 자산 | 출처와 변경 | 사용 및 배포 검토 |
|---|---|---|
| `assets/brand/ad-me-logo.png`, `public/brand/ad-me-logo.png` | 프로젝트 제공 원본. 두 파일의 SHA-256 동일 | 프로젝트 브랜드 표시용. 제3자의 재사용 허락 범위는 확인 필요 |
| `public/brand/ad-me-logo-trimmed.png`, `ad-me-symbol.png`, `ad-me-wordmark.png` | 제공 로고의 표시용 크롭 | 원본과 동일한 검토 범위. 별도 일반 사용 라이선스 부여 기록 없음 |
| `public/brand/figma/logo.png` | Figma 원본 로고(SHARED_CONTRACT 지정), 2026-11-24 `59306d6` 반입. 제공 원본과 별도 파일 | 프로젝트 브랜드 표시용. 일반 재사용 라이선스 부여 기록 없음 |
| `public/brand/figma/hero.png`, `public/brand/figma/editorial.png`, `public/brand/figma/creator-editorial.png` | Figma 시안에서 2026-11-24 `59306d6` 반입한 인물 사진형 이미지. 촬영·스톡·생성 여부, 저작권자, 초상권 동의 기록 없음 | RIGHTS_UNVERIFIED · 출시 차단. 권리 근거(라이선스·모델 릴리스 또는 생성 도구 약관과 실존 인물 아님 확인)를 기록하거나 교체 |
| `fixtures/*.demo.json`, `supabase/seed.sql`의 시연 자료 | 프로젝트가 만든 가상 자료 | DEMO 표시와 가상 인물·캠페인·이력 구분을 유지 |
| 아이콘과 글꼴 | Lucide 의존성, 로컬 시스템 글꼴 스택 | Lucide는 잠금 버전의 고지 확인 필요. 외부 웹폰트 파일은 번들에서 식별되지 않음 |
| 크리에이터 SNS 및 포트폴리오 | 이용자가 제출하는 원본 링크 | 동의 받은 공개 링크만 표시. 외부 콘텐츠 복사·재배포는 별도 허가 확인 |
| YouTube 삽입 재생 | 이용자가 요청한 공식 플레이어 | 재생 가능 콘텐츠 원본 링크 제공. 영상, 썸네일, 지표 사본을 저장하지 않음 |

실제 공급원 데이터를 출시 자산 목록에 추가할 때는 정확한 제공자·권리 근거·허용 필드·보존 정책을 D017 및 해당 U 증거와 함께 기록한다. 권리 근거 및 고지 본문이 확인되지 않은 신규 자산은 검토가 끝날 때까지 반출을 보류한다.

[Open Source Initiative 라이선스 목록](https://opensource.org/licenses/) · [YouTube 공식 플레이어](https://developers.google.com/youtube/player_parameters)
