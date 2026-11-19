# be-celeb.org — AD Me 연결 기록

기준일: 2026-11-19. 사용자가 기존 웹 연결 해제 및 AD Me 연결을 명시적으로 승인했다. 도메인 구매/이전·유료 상품 가입은 하지 않았다.

## 결과

- 기본 서비스 주소: **https://be-celeb.org**.
- https://www.be-celeb.org 는 기본 주소로 **308 redirect**. 경로와 query 보존 확인.
- Vercel project: `ad-me` / `prj_BzLpbB8hBOXmjzbg9iJI2kp3Zu7C`, team `team_DZjzOMGaSURMH3q0KktVzcUJ`.
- Production deployment: `dpl_3up1TmKNaQd66CvfzCoEKRWGwHnR`, READY. 소스 기준은 기존 구현 및 운영자 연락처 유지보수 코드이며, 전체 실제 데이터 베타 기능 완성을 뜻하지 않는다.
- Supabase Auth Site URL: `https://be-celeb.org`. exact redirect 루트/대시보드 등록. 기존 `ad-me-topaz.vercel.app` 루트/대시보드는 호환용으로 유지했다.
- Vercel Production `NEXT_PUBLIC_APP_URL=https://be-celeb.org` 등록 후 재배포. 현재 앱에서는 선언만 된 변수이며 이 값 자체가 인증·링크 동작을 바꾼다고 주장하지 않는다. 실제 인증 주소는 Supabase에서 별도로 변경했다.

## 기존 연결 조사·처리

- 등록기관/권한 DNS는 Cloudflare. NS `buck.ns.cloudflare.com`, `ligia.ns.cloudflare.com`.
- 기존 공개 DNS는 Vercel을 가리켰으며 요청 시 HTTPS404. 대상 Vercel 팀의 프로젝트 목록에서 해당 도메인 연결은 발견되지 않았다. 다른 Cloudflare 내부 설정 전체를 열람했다는 의미는 아니다.
- 기존 Vercel 팀이 도메인을 소유하고 있어 `be-celeb.org`/`www.be-celeb.org`를 AD Me에 직접 연결할 수 있었다. 두 도메인 모두 verified=true, misconfigured=false를 확인했다.
- Cloudflare DNS 변경 요청/네임서버 변경/기존 서비스 프로젝트 삭제는 수행하지 않았다. 다른 Cloudflare 계정·Workers·Pages 자원을 전부 삭제한 것으로 보고하지 않는다. 웹 도메인 연결만 AD Me로 설정했다.
- 전후 관측에서 Vercel A 주소 응답은 달라졌다. 첫 “전체 DNS 응답 동일” 비교 실패를 원본으로 보존하고, 실제 유지해야 하는 NS·메일 MX/TXT·www CNAME과 Vercel 구성 유효성으로 검사했다. IP 변화의 원인을 추측해 기록하지 않는다.
- Cloudflare 메일 라우팅 MX 및 SPF TXT는 전후 동일했다. 이를 보존했으며 메일 수신 전달 자체를 테스트한 것은 아니다.

## 검증

- HTTPS 인증서 검증을 끄지 않은 실제 요청으로 `/`, `/login`, `/signup`, `/creators`, `/campaigns`, `/privacy`, `/pricing` 모두 HTTP200 및 AD Me 응답 확인.
- `www.be-celeb.org/creators?platform=youtube` → `be-celeb.org/creators?platform=youtube` 308 확인.
- Supabase auth config 재비교: 선언된 변경 0개(적용 완료). 메일 확인/MFA 등 다른 원격 설정은 보존했다.
- 실제 브라우저에서 새 도메인 홈페이지 확인. 캡처 `output/playwright/be-celeb-home.png`.
- 새 도메인 desktop/mobile E2E **6/6 PASS (1.2m)**. 실행 결과를 `harness/evidence/domain-20261119/e2e-summary.json`에 기록한다. 외부 신규 이메일 가입·Toss 공급자 결제는 이 테스트가 검증하지 않는다.

## 복구

1. 앱 문제 시 이전 검증 deployment `dpl_FqrtgkPAXTM7EXs1eRNCHKCjieEf`로 롤백한다. DB/Auth 설정은 앱 rollback과 별도다.
2. 도메인 연결을 되돌려야 하면 현재 Vercel project-domain 설정을 기록한 뒤 해당 두 연결/redirect만 수정한다. 기존 프로젝트 연결은 조사 결과 없었으므로 임의 복구 대상을 만들지 않는다.
3. 인증 URL 복구가 필요하면 Site URL을 `https://ad-me-topaz.vercel.app`로 바꾸고 그 origin 루트/대시보드만 필요한 allowlist에 유지한다. 확인되지 않은 wildcard는 추가하지 않는다.
4. Cloudflare NS/MX/SPF는 건드리지 않았으므로 도메인 복구를 이유로 임의 삭제/재생성하지 않는다.

비밀값 없는 원본 증거: `harness/evidence/domain-20261119/`. 이 연결 작업에 필요한 사용자 추가 조치는 없다. 기존 실서비스 미완료·SMTP/Toss/수집 차단 항목은 별도로 남아 있다.
