# D050 — 협업 조건 변경·합의 이력 (2026-11-26, DEV-B)

환경: 격리 로컬 Supabase만.

## 재현
- 2026-11-22에는 순수 계약 모듈(`src/lib/agreement-versions.ts`)과 단위 테스트만 있었다. 저장소·RLS·API·화면이 없어서 실제 협업에서는 조건 변경과 합의를 기록할 수 없었다.

## 변경
- `supabase/migrations/20261126120000_d050_agreement_versions.sql`(추가만):
  - 테이블 `agreement_offers`(작성자·조건·양측 동의·대체 관계·확정 시각)와 `agreement_events`(버전별 제안·동의 로그)
  - 두 당사자만 읽을 수 있고 클라이언트 쓰기는 없다
  - RPC `agreement_state`, `agreement_propose`, `agreement_accept`:
    - 제안 행 잠금과 기대 버전(40001)
    - 클라이언트 키 멱등(같은 키에 다른 내용이면 거부)
    - 할당량 30/시간
    - 종료·차단·연락 제한 협업은 읽기 전용
    - 50건 상한
- 일방 제안은 상대가 동의하기 전까지 "확정 전"이다. 새 일방 제안은 기존 합의를 대체하지 않고 `replaces`로 관계만 남긴다.
- `src/lib/agreements.ts`(Zod: 예산·산출물·일정·메모, 오류 매핑), `POST /api/agreements`, `/collaborations/[id]/terms`의 `AgreementPanel`(합의된 조건, 대기 중 제안과 동의 버튼, 변경 제안 폼, 이력)을 추가했다. 대시보드와 결과물 화면에서 링크한다.
- 합의 기록은 전자서명이나 정산 보증이 아니라고 화면에 표시한다.
- `tests/ci-db.sh`에 `agreements` 스위트를 추가했다.
- 기존 `src/lib/agreement-versions.ts`는 단위 계약으로 남겨 두었다. 실제 판정 권한은 DB RPC에 있다.

## 결과
- `node tests/agreements.mjs` PASS:
  - 일방 제안은 미확정이고 상대 동의로 확정된다
  - 새 제안 중에도 기존 합의가 보존된다
  - 기대 버전 불일치·키 재사용 거부, 재시도 멱등
  - 동시 제안은 하나만 반영된다
  - 외부인과 직접 쓰기 거부, 잘못된 조건 키 거부
  - 종료된 협업은 읽기 전용이다
- `npx playwright test tests/e2e/agreements.spec.ts`: desktop·mobile 2/2.
  - 브랜드 제안 → 크리에이터 "이 조건에 동의" → 양측 확인
  - 크리에이터의 새 제안 중에도 브랜드 화면의 합의 조건은 500,000원으로 유지된다
  - 외부인은 not-found 화면을 보고 조건 내용이 노출되지 않는다
- `npx vitest run tests/agreement-versions.test.ts` 2/2.

## 남은 것
- 운영 적용(U004)은 운영자 게이트.
- 합의 변경 알림(D052 연동)은 범위 밖이라 붙이지 않았다.
