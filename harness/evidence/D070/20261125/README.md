# D070 — HOT 독립 슬롯·광고 고지 회귀 수정 (2026-11-25, DEV-B)

Base: origin/main `3f35322`. 격리 로컬만. 티켓은 D069(TODO) 선행으로 완료 처리하지 않는다.

## 재현
- `/creators`는 merge 때 들어온 인라인 "스폰서 · HOT" 영역을 렌더링했다. 이 영역은 노출을 기록하지 않았고(`promotionSlots(false)`) "광고 · TEST HOT" 라벨·`promotion-slot` 표지도 없었다. 그 결과 소유자 대시보드의 HOT 노출 이력이 쌓이지 않았다.
- `promotion.spec.ts`는 내부 `user-<uuid>` ID로 슬롯을 찾았다. 또 DEV-A가 강화한 노출 조건(본인 확인 + 동의·검수 완료된 신선한 YouTube 채널 연결)을 충족하지 못해 슬롯이 비어 있었다.

## 변경
- `src/app/creators/page.tsx`: TEST 결제 기능이 켜졌을 때 `PromotionSlot`(광고 라벨, 렌더당 노출 1회 기록)을 렌더링한다.
- `tests/e2e/promotion.spec.ts`: 슬롯을 공개 참조로 검사한다. 검증된 채널 연결을 로컬 SQL 픽스처로 넣고 finally에서 제거한다.

## 결과
- `promotion.spec.ts` desktop+mobile 2/2 PASS (`e2e.txt`): 슬롯 API 최소 DTO, 일반 결과 불변, 광고 라벨, 소유자 노출 이력.
- 남은 것: D069 이용권 만료·usage 선행, 실제 Toss 결제 HOT 구매는 U015.
