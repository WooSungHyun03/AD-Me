# D048 · 2026-11-25 template fallback contact redaction (new; earlier evidence unchanged)

Base: origin/main `2ad38df`. Scope: local QA server (https://127.0.0.1:3143) + replica `d002-replica`. Model host down (11539/11434 no response), no provider key: every draft is the template path.

## Reproduction (before)
Real `POST /api/ai/draft` as the fictional brand, summary input with `qa@example.test 010-1234-5678`:
`"... 연락처 qa@example.\n\n원문 전체를 확인한 뒤 사용하세요."`, `version template-v2`, `fallback_reason "LLM 공급자 미연결"`.
The provider path redacts contacts (D048 contract), but `template()` echoed input verbatim — the summary leaked a partial email, and concept/proposal/brief echoed full email/phone from `product`/`audience`/`tone`/`name`.

## Change (smallest)
- `src/lib/ai/index.ts`: fallback passes inputs through the existing `redact()` before `template()`; `TEMPLATE_VERSION` → `template-v3` (output contract changed).
- `tests/ai.test.ts`: new case, all 4 kinds, no contact fragments in template output (failed before the fix: concept echoed `qa@example.test`).
- `tests/e2e/ai-studio.spec.ts`: version literal v3.

## Results
| Check | Result |
|---|---|
| `tests/ai.test.ts` + `intelligence-api` + `intelligence` | 26/26 PASS (new case FAIL before fix) |
| `npm test` / lint / typecheck | 96 files 574 tests / PASS / PASS |
| Python `test_local_draft_contract.py`, `test_intelligence_recovery.py` | OK |
| `local-draft-provenance.mjs`, `local-draft-read-security.mjs` (replica) | PASS |
| Real API after fix, desktop+mobile (`model_down_20261125/api-results.json`) | template-v3, `[이메일] [전화번호]`, cross-site Origin 403 |
| `/tools`→`/creators`, `/tools/local`→`/campaigns/new` (308) | PASS; studio route not reintroduced |
| `/recommendations` with model down, 1440/390 | renders, no horizontal overflow (`recommendations-*.png`) |

`tests/ai-usage.mjs` is pinned to the owner stack (`.env.local`, `supabase_db_AD-Me`) and was not run, by rule.

## Remaining gates
- OPERATOR PR-003: real worker/model host start and recovery; real model output acceptance.
- DEV-B D086: TTL/global concurrency, cost alerts.
