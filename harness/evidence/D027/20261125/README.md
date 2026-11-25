# D027 — 안전한 이미지·포트폴리오 업로드 재검증 (2026-11-25, DEV-B)

Base: main `f2bcd3d`. 환경: 격리 로컬 Supabase만(빈 DB에서 마이그레이션 127개). 운영 Storage·배포 미적용. 이전 증빙(`../README.md`, 2026-11-22)과 구분한다.

## 재현 (수정 전 main)
- merge `a5f3326`이 설정 화면에서 `PortfolioFiles`를 제거해 업로드 진입점이 없었다. E2E `uploads.spec.ts`는 `파일 선택`을 찾지 못해 desktop·mobile FAIL(`../../D085/20261125/census-e2e.txt`).
- 복원은 D085 커밋 `f2bcd3d`(설정 화면). API·Storage 정책·마이그레이션은 변경하지 않았다.

## 수용 기준 대조
| 기준 | 근거 |
|---|---|
| 실제 MIME(magic bytes)·확장자 일치·5MB | `src/lib/uploads.ts` `sniff`/검사. E2E: 이미지 확장자로 위장한 HTML 거부, SVG 거부, 실제 PNG만 허용 |
| HTML/SVG 등 실행 가능 파일 차단 | 위 E2E + REST: 서버 키로도 HTML/SVG 타입 객체 저장 거부(버킷 허용 타입) |
| 경로 = owner namespace + 무작위 ID, 표시 이름은 경로에 미사용 | `src/lib/uploads.ts`, 내려받기 파일명 `file-<8hex>.png` |
| 짧은 signed URL·소유자만 서명 | REST: 소유자 서명·다운로드, 타 소유자/익명 서명·읽기 거부, 만료. E2E: 브랜드 계정 404/403 |
| private 우회 없음 | REST: 공개 URL 미동작, 브라우저 직접 쓰기 거부(신·구 버킷) |
| 참조 테이블·삭제 job·고아 정리 | REST: 참조 직접 쓰기/덮어쓰기 거부, 삭제 후 서명 거부, sweep이 삭제·고아 객체 제거 |

## 결과
| 명령 | 결과 |
|---|---|
| `node tests/uploads.mjs` | PASS (`uploads-rest.txt`) |
| `playwright tests/e2e/uploads.spec.ts` desktop+mobile | 2/2 PASS (`e2e.txt`), 스크린샷 `upload-item-*.png` |
| 빈 DB `tests/ci-db.sh` 내 uploads E2E·REST | PASS (`../../D085/20261125/ci-db-after.txt`) |

## 남은 게이트
- 운영 Storage 버킷·정책 적용과 실환경 업로드 검증: **BLOCKED**(U004/U006, 서버 키는 운영자 설정). 운영 검증 안 함.
