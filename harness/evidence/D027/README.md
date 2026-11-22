# D027 — 비공개 파일 업로드 (2026-11-22)

상태: 구현·**격리 로컬 Supabase 검증 완료**(`db reset`으로 0001~0013 적용) / 운영 DB 미적용(마이그레이션 0013).
**배포 시 사용자 작업 필요**: Vercel 서버 환경변수 `SUPABASE_SERVICE_ROLE_KEY` 설정(설정 전에는 업로드 API가 503 "아직 설정되지 않았습니다"로 안전하게 비활성).

## 설계
- 저장 위치: private bucket `private-uploads`(public=false, 5MB, image/png·jpeg·webp·application/pdf만).
- 경로: `<owner uuid>/<무작위 uuid>.<검증된 확장자>`. 원래 파일명은 경로에 쓰지 않는다.
- **브라우저는 storage에 직접 쓸 수 없다.** insert·update·delete 정책을 두지 않았다.
  - 서버(`/api/uploads`)가 크기, 확장자, **실제 magic bytes**, 선언 MIME 일치, PDF 활성 콘텐츠를 검사한다.
  - 검사를 통과한 파일만 서버 전용 키로 저장하고 참조 행을 기록한다.
  - 참조 행 기록에 실패하면 저장한 객체를 즉시 지운다.
- 차단 대상:
  - HTML·SVG·스크립트·실행 파일은 magic bytes가 맞지 않거나 확장자가 허용 목록에 없어 거부한다.
  - 확장자와 내용이 다르면 `mismatch`로 거부한다.
  - JavaScript·Launch·EmbeddedFile·OpenAction·AA 등이 들어 있는 PDF는 거부한다.
  - bucket 자체도 html/svg Content-Type을 거부한다(서버 키로도 불가).
- **기존 우회 경로 차단**: 0001의 미사용 `portfolios` bucket은 브라우저 직접 업로드를 허용하고 있었다. 0013에서 insert·delete 정책을 제거했다(기존 객체의 소유자 읽기는 유지).
- 다운로드: `/api/uploads/[id]` POST가 **사용자 본인 세션으로** 60초 signed URL을 만든다.
  - storage RLS가 소유자이면서 `uploads.status='ready'`인 경우만 허용하므로 다른 소유자·익명·삭제된 파일은 서명할 수 없다.
  - 첨부 다운로드로 제공한다. 비ASCII 파일명은 storage가 퍼센트 인코딩하므로 `file-<id8>.<ext>`로 바꾼다.
- 삭제: `delete_upload` RPC(소유자만)로 참조를 `deleted` 처리하고, 서버가 객체를 즉시 지운다.
- 정리 job: `sweepUploads`(`/api/admin/uploads`, 관리자만).
  - 삭제된 참조의 객체를 지우고 그 행을 정리한다.
  - 참조 없는 고아 객체는 1시간 유예 뒤 삭제한다(업로드 중인 파일 보호).
- 권리 확인: 업로드 시 "권리 보유" 체크가 필수다(`rights_confirmed` check 제약).
- 계정당 20개 제한. 업로드는 크리에이터 계정만 가능하다.
- D074 개인정보 반출에 업로드 파일 목록(메타데이터)을 포함했다.

## 파일
- `supabase/migrations/202611190013_private_uploads.sql`(bucket, `uploads`, `delete_upload`, storage 정책, portfolios 우회 차단).
- `src/lib/uploads.ts` [신규]: `sniff`, `inspectFile`, `safeName`, `storageAdmin`(서버 전용), `sweepUploads`.
- `src/app/api/uploads/route.ts`, `src/app/api/uploads/[id]/route.ts`, `src/app/api/admin/uploads/route.ts` [신규].
- `src/components/portfolio-files.tsx` [신규]. 크리에이터 설정 화면의 프로필 폼 아래에 배치했다(form 중첩을 피하려고 `profile-form.tsx`와 분리).
- `.env.example`: `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 안내.

## 검증
- `tests/uploads.test.ts`(vitest 4건):
  - 실제 PNG·JPG·WEBP·PDF 허용.
  - png 확장자로 위장한 HTML, SVG, jpg 확장자로 위장한 svg, pdf 확장자로 위장한 MZ 실행 파일 거부.
  - 확장자·MIME 불일치 거부, 활성 PDF 거부, 빈 파일·5MB 초과 거부, 파일명 경로·마크업 제거.
- `tests/uploads.mjs` 직접 storage/REST PASS:
  - 두 bucket 모두 브라우저 직접 업로드 거부. bucket이 html/svg 타입 거부. private 확인, public URL 접근 불가.
  - 경로가 소유자 namespace가 아니거나 권리 미확인이면 행 거부.
  - 소유자만 서명·다운로드 가능하고, 다른 소유자·익명은 서명·다운로드·목록·참조 조회 불가.
  - 1초 URL 만료 확인.
  - 직접 참조 insert·update, 덮어쓰기(upsert), 직접 삭제 모두 무효.
  - 다른 소유자 삭제 RPC 거부, 소유자 삭제 후 서명 거부.
  - 정리 job: 유예 중인 고아 객체는 남기고, 유예 0에서 고아 객체와 삭제된 객체를 지우고 행을 정리한다. 살아 있는 파일은 유지된다.
- `tests/e2e/uploads.spec.ts` desktop·mobile PASS:
  - 익명 401.
  - 위장 HTML은 "허용된 이미지·PDF 형식이 아닙니다", SVG는 "PNG·JPG·WEBP·PDF 파일만".
  - 실제 PNG 업로드 후 내려받은 바이트가 원본과 같다.
  - 브랜드 계정의 링크 발급 404, 삭제 404, 업로드 403, 정리 403.
  - 소유자 삭제 후 목록에서 사라지고 링크 발급 404.
- reset 후 전체 E2E 34/34, 직접 DB 테스트 11종 PASS, vitest 68/68, lint·typecheck·build·secret_scan PASS.
- 빌드된 브라우저 번들(`.next/static`)에 서버 키 값과 변수명이 없음을 확인했다(0건).
- 스크린샷 `settings-uploads-{desktop,mobile}.png`(가로 스크롤 없음).

## 남은 범위
- 정리 job 자동 실행(Vercel Cron)은 연결하지 않았다. 지금은 관리자 API로 실행한다.
- PDF 검사는 평문 스캔이라 압축 스트림 안의 이름은 놓칠 수 있다(코드에 `shortcut:` 표기, 첨부 다운로드로 완화). 인라인 미리보기 전에는 PDF 정제기가 필요하다.
- 바이러스 검사는 없다.

## 상대 담당 인터페이스
- D042/D051(DEV-A): 산출물·포트폴리오 첨부는 `uploads.id`를 참조하고, 열람은 `/api/uploads/[id]` signed URL로 한다. 협업 상대에게 공유하려면 storage select 정책 확장이 필요하다(현재는 소유자만).
- D075(DEV-A): 저장·보관 정책 문서에 5MB·20개·삭제 즉시+1시간 유예 정리를 반영한다.
