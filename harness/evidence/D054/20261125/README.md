# D054 — 결과물 버전 흐름 golden path 재검증 (2026-11-25, DEV-B)

Base: origin/main `be839f9`. 격리 로컬만. 운영 `delivery_transition`·D054 SQL 적용은 운영자 게이트(U004).

- 재현: `service.spec.ts` "two-role golden path"가 대시보드 인라인 결과물 폼("종류 → 결과물", "결과물 제출 완료")을 찾지 못해 실패했다. DEV-A 설계에서 결과물은 `/collaborations/[id]/deliverables`의 버전형 제출·검토로 옮겨졌다.
- 변경: golden path를 현재 흐름으로 갱신했다. 크리에이터가 새 제출본을 저장(버전 1)하고 현재 버전 제출을 완료한다(검토 대기). 브랜드가 검토 의견과 광고 표시 확인 후 현재 버전을 승인하고, 대시보드에서 "완료"를 확인한다.
- 결과: `service.spec.ts -g "two-role"` desktop+mobile **2/2 PASS** (`e2e-golden.txt`). 결제 검증(409·503 시크릿·403 역할)과 권한 거부 단계가 포함된다.
- 남은 것: 수정 요청 후 새 버전 필수, 다른 탭의 구버전 승인 409 등 세부 수용 테스트(`tests/local-browser/deliverables.spec.ts`, DEV-A 2026-11-20 증빙)를 현재 main에서 다시 돌려야 한다. 운영 적용은 U004.
