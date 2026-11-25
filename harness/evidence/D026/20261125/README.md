# D026 — 크리에이터 프로필 편집 확장 재검증 (2026-11-25, DEV-B)

Base: origin/main `077bab2`. 격리 로컬만. 운영 미검증.

## 재현
- merge `a5f3326` 이후 프로필 폼은 분야·분위기·형식·플랫폼이 단일 선택이었다. 견적은 필수 숫자였고, 협업 의사는 체크박스여서 "견적 미확인", "협업 의사 미확인"을 표현할 수 없었다. E2E `profile-fields.spec.ts`가 FAIL했다.
- 공개 카탈로그 DTO가 null 견적·의사를 거부해 한 행이 캠페인·탐색 화면 전체를 500으로 만들었다. 이는 `6c54993`에서 수정했다.
- REST 스위트는 직접 `published:true` upsert(D073 게시 동의 가드가 거부)와 서비스 키 `moderate_entity`(현재 MFA 관리자 전용)에 의존해 첫 단계부터 FAIL했다.

## 변경
- `src/components/profile-form.tsx`:
  - 분야(최대 5)·분위기(최대 8)·형식·플랫폼을 다중 선택 체크박스로 바꿨다.
  - "견적 미확인 (협의 후 결정)" 토글(null/null), 협업 의사 선택(가능/어려움/미정=null)을 추가했다.
  - D073 게시 동의(`publicationIntent`) 연동은 유지했다.
- `tests/profile-fields.mjs`:
  - `save_publication` RPC로 저장한다.
  - 운영 제한은 D059 `moderation_status`를 owner SQL 픽스처로 적용하고, 소유자 측 보장을 검증한다.

## 결과
| 명령 | 결과 |
|---|---|
| `node tests/profile-fields.mjs` | PASS 아래 4항목 |
| | null 견적·의사 저장 |
| | 반쪽 견적·역전·허용 외 플랫폼·비불리언 의사 거부 |
| | 소유자 잠금 설정·해제 불가 |
| | 제한 프로필은 재공개해도 공개 DTO에 없음, 해제 후 복구 |
| `profile-fields.spec.ts` desktop+mobile | 2/2 PASS (다중 분야, 견적 미확인, 의사 미정 → 재진입 유지 → 공개 상세에 "견적 미확인", "협업 의사 미확인", "0원~" 없음) |
| `creator-public-profile.test.ts` | 7/7 |

## 관찰 (DEV-A 공유)
- `guard_creator_claim`의 레거시 `moderation_locked` 재공개 차단은 `current_user` 조건 때문에 SECURITY DEFINER `save_publication` 경로에서 동작하지 않는다(D062와 같은 유형).
- 공개 노출은 `moderation_status` 카탈로그 게이트로 막혀 있어 노출 우회는 없음을 확인했다.
- 레거시 플래그 정리 여부는 D059/D075에서 결정한다.
